import asyncpg
from fastapi import APIRouter, HTTPException, Request
from models.sale import SaleRequest, SaleResponse
from core.security import require_web_access
from core.utils import round_money

router = APIRouter(tags=["sales"])


@router.post("/sales", response_model=SaleResponse)
@router.post("/make_sale.php", response_model=SaleResponse, include_in_schema=False)
@router.post("/api/sales", response_model=SaleResponse, include_in_schema=False)
@router.post("/api/make_sale.php", response_model=SaleResponse, include_in_schema=False)
async def make_sale(sale: SaleRequest, request: Request):
    user = require_web_access(request)

    requested: dict[int, int] = {}
    for item in sale.items:
        requested[item.product_id] = requested.get(item.product_id, 0) + item.quantity

    method = sale.method or "Cash"
    notes = (
        (f"Payment: {method}. " if method != "Cash" else "")
        + (f"Ref: {sale.reference}. " if sale.reference else "")
        + (sale.notes or "")
    ).strip()

    try:
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                lines = []
                total = 0.0
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
                    line_total = round_money(float(product["retail_price"]) * quantity)
                    total += line_total
                    lines.append((product, quantity, line_total))
                total = round_money(total)

                if method == "Cash" and sale.amount_received < total:
                    raise HTTPException(status_code=400, detail="Amount received is less than the sale total")
                received = max(sale.amount_received, total)
                change = max(0.0, received - total)

                try:
                    async with conn.transaction():
                        order_id = await conn.fetchval(
                            "INSERT INTO orders (user_id, transaction_timestamp, total_amount, amount_tendered, "
                            "change_given, notes) VALUES ($1, NOW(), $2, $3, $4, $5) RETURNING order_id",
                            user["user_id"], total, received, change, notes or None
                        )
                except asyncpg.PostgresError:
                    order_id = await conn.fetchval("SELECT COALESCE(MAX(order_id), 0) + 1 FROM orders")
                    await conn.execute(
                        "INSERT INTO orders (order_id, user_id, transaction_timestamp, total_amount, "
                        "amount_tendered, change_given, notes) VALUES ($1, $2, NOW(), $3, $4, $5, $6)",
                        order_id, user["user_id"], total, received, change, notes or None
                    )

                for product, quantity, line_total in lines:
                    try:
                        async with conn.transaction():
                            await conn.execute(
                                "INSERT INTO order_items (order_id, product_id, quantity, cost_snapshot, "
                                "price_snapshot, line_subtotal) VALUES ($1, $2, $3, $4, $5, $6)",
                                order_id, product["product_id"], quantity,
                                float(product["base_cost"]), float(product["retail_price"]), line_total
                            )
                    except asyncpg.PostgresError:
                        next_item_id = await conn.fetchval("SELECT COALESCE(MAX(order_item_id), 0) + 1 FROM order_items")
                        await conn.execute(
                            "INSERT INTO order_items (order_item_id, order_id, product_id, quantity, cost_snapshot, "
                            "price_snapshot, line_subtotal) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                            next_item_id, order_id, product["product_id"], quantity,
                            float(product["base_cost"]), float(product["retail_price"]), line_total
                        )

                    await conn.execute(
                        "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2",
                        quantity, product["product_id"]
                    )

                for sql, args in (
                    ("INSERT INTO histories (order_id, status_timestamp, order_status) "
                     "VALUES ($1, NOW(), 'COMPLETED')", (order_id,)),
                    ("INSERT INTO histories (history_id, order_id, status_timestamp, order_status) "
                     "SELECT COALESCE(MAX(history_id), 0) + 1, $1, NOW(), 'COMPLETED' FROM histories", (order_id,)),
                ):
                    try:
                        async with conn.transaction():
                            await conn.execute(sql, *args)
                        break
                    except asyncpg.PostgresError:
                        continue

                config_id = await conn.fetchval(
                    "SELECT config_id FROM capital_configs ORDER BY config_id DESC LIMIT 1"
                )
                if config_id:
                    await conn.execute(
                        "UPDATE capital_configs SET current_balance = current_balance + $1, "
                        "last_updated_at = NOW() WHERE config_id = $2",
                        total, config_id
                    )
                else:
                    await conn.execute(
                        "INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) "
                        "VALUES (20000, $1, NOW())",
                        20000 + total
                    )
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Transaction failed: {e}")

    return {
        "success": True,
        "message": "Sale recorded",
        "order_id": order_id,
        "transaction_id": order_id,
        "total_amount": total,
    }
