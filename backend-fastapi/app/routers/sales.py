import re
from fastapi import APIRouter, HTTPException, Request
from models.sale import SaleCreate, SaleResponse
from core.security import require_app_access


def round_money(value: float) -> float:
    return round(float(value), 2)


router = APIRouter(tags=["sales"])


@router.post("/sales", response_model=SaleResponse, status_code=201)
@router.post("/api/make_sale.php", response_model=SaleResponse, include_in_schema=False)
async def make_sale(sale: SaleCreate, request: Request):
    auth_user = require_app_access(request)
    user_id = auth_user["user_id"]

    requested: dict[int, int] = {}
    for item in sale.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Item quantity must be greater than zero")
        requested[item.product_id] = requested.get(item.product_id, 0) + item.quantity

    async with request.app.state.pool.acquire() as conn:
        async with conn.transaction():
            try:
                # 1. Fetch official products from DB, verify stock, and recompute prices & totals from database
                lines = []
                computed_total = 0.0
                for product_id, quantity in requested.items():
                    product = await conn.fetchrow(
                        "SELECT product_id, name, retail_price, base_cost, stock_quantity "
                        "FROM products WHERE product_id = $1 FOR UPDATE",
                        product_id
                    )
                    if product is None:
                        raise HTTPException(status_code=404, detail="A product in this sale no longer exists")
                    if quantity > int(product["stock_quantity"]):
                        raise HTTPException(status_code=409, detail=f"Not enough stock for {product['name']}")

                    unit_price = round_money(float(product["retail_price"] or 0))
                    unit_cost = round_money(float(product["base_cost"] or 0))
                    line_subtotal = round_money(unit_price * quantity)
                    computed_total += line_subtotal
                    lines.append({
                        "product": product,
                        "quantity": quantity,
                        "unit_price": unit_price,
                        "unit_cost": unit_cost,
                        "line_subtotal": line_subtotal,
                    })

                computed_total = round_money(computed_total)

                # 2. Validate amount_tendered against server-computed total & recompute change
                tendered = round_money(sale.amount_tendered)
                if tendered < computed_total:
                    tendered = max(tendered, computed_total)
                change_given = round_money(max(0.0, tendered - computed_total))

                # 3. Format notes with cashier name and reference code
                full_name = await conn.fetchval("SELECT full_name FROM users WHERE user_id = $1", user_id)
                code = (sale.client_ref or "").strip().upper()
                code = code if re.fullmatch(r"[0-9A-Z]{12}", code) else None
                cashier_name = full_name or auth_user.get("full_name") or auth_user.get("username") or "Unknown user"
                first_line = f"By {cashier_name}" + (f" ({code})" if code else "")
                notes_text = first_line + (f"\n{sale.notes.strip()}" if sale.notes and sale.notes.strip() else "")

                # 4. Insert order with server-recomputed total, tendered, and change
                order_row = await conn.fetchrow(
                    "INSERT INTO orders (user_id, total_amount, amount_tendered, change_given, notes) "
                    "VALUES ($1, $2, $3, $4, $5) RETURNING order_id",
                    user_id, computed_total, tendered, change_given, notes_text
                )
                order_id = order_row["order_id"]

                # 5. Insert order items with server-verified cost_snapshot, price_snapshot, line_subtotal & deduct stock
                for line in lines:
                    p = line["product"]
                    qty = line["quantity"]
                    await conn.execute(
                        "INSERT INTO order_items (order_id, product_id, quantity, cost_snapshot, price_snapshot, line_subtotal) "
                        "VALUES ($1, $2, $3, $4, $5, $6)",
                        order_id, p["product_id"], qty,
                        line["unit_cost"], line["unit_price"], line["line_subtotal"]
                    )
                    await conn.execute(
                        "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2",
                        qty, p["product_id"]
                    )

                # 6. Record history status
                await conn.execute(
                    "INSERT INTO histories (order_id, order_status) VALUES ($1, $2)",
                    order_id, "COMPLETED"
                )

                # 7. Update capital config balance with recomputed total
                config_id = await conn.fetchval(
                    "SELECT config_id FROM capital_configs ORDER BY config_id DESC LIMIT 1"
                )
                if config_id:
                    await conn.execute(
                        "UPDATE capital_configs SET current_balance = current_balance + $1, "
                        "last_updated_at = NOW() WHERE config_id = $2",
                        computed_total, config_id
                    )
                else:
                    await conn.execute(
                        "INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) "
                        "VALUES (0, $1, NOW())",
                        computed_total
                    )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Transaction failed: {e}")

    return {
        "success": True,
        "order_id": order_id,
        "message": "Sale processed successfully",
    }


@router.get("/api/check_sale.php", include_in_schema=False)
@router.get("/sales/check")
async def check_sale(ref: str, request: Request):
    """Has a sale carrying this private reference already been saved? Used by the phone app
    so a sale is never saved twice after a connection drops."""
    require_app_access(request)
    if not re.fullmatch(r"[0-9A-Z]{12}", ref or ""):
        raise HTTPException(status_code=400, detail="Invalid reference")
    async with request.app.state.pool.acquire() as conn:
        order_id = await conn.fetchval(
            "SELECT order_id FROM orders WHERE position($1 in COALESCE(notes, '')) > 0 LIMIT 1",
            f"({ref})"
        )
    return {"exists": order_id is not None, "order_id": order_id}
