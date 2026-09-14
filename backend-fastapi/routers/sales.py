from fastapi import APIRouter, HTTPException, Request
from models.sale import SaleCreate, SaleResponse

router = APIRouter(tags=["sales"])


@router.post("/sales", response_model=SaleResponse, status_code=201)
@router.post("/make_sale.php", response_model=SaleResponse, include_in_schema=False)
async def make_sale(sale: SaleCreate, request: Request):
    async with request.app.state.pool.acquire() as conn:
        async with conn.transaction():
            try:
                order_row = await conn.fetchrow(
                    "INSERT INTO orders (user_id, total_amount, amount_tendered, change_given) "
                    "VALUES ($1, $2, $3, $4) RETURNING order_id",
                    sale.user_id, sale.total_amount, sale.amount_tendered, sale.change_given
                )
                order_id = order_row["order_id"]

                for item in sale.items:
                    await conn.execute(
                        "INSERT INTO order_items (order_id, product_id, quantity, cost_snapshot, price_snapshot, line_subtotal) "
                        "VALUES ($1, $2, $3, $4, $5, $6)",
                        order_id, item.product_id, item.quantity,
                        item.cost_snapshot, item.price_snapshot, item.line_subtotal
                    )
                    await conn.execute(
                        "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2",
                        item.quantity, item.product_id
                    )

                status = "COMPLETED"
                await conn.execute(
                    "INSERT INTO histories (order_id, order_status) VALUES ($1, $2)",
                    order_id, status
                )

                await conn.execute(
                    "UPDATE capital_configs SET current_balance = current_balance + $1 "
                    "WHERE config_id = (SELECT config_id FROM capital_configs ORDER BY last_updated_at DESC LIMIT 1)",
                    sale.total_amount
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Transaction failed: {e}")

    return {
        "success": True,
        "order_id": order_id,
        "message": "Sale processed successfully",
    }
