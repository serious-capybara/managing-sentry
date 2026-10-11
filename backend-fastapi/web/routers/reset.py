import asyncpg
from fastapi import APIRouter, HTTPException, Request
from models.user import MessageResponse
from core.security import require_web_access

router = APIRouter(tags=["reset"])


@router.post("/reset", response_model=MessageResponse)
@router.post("/api/reset.php", response_model=MessageResponse, include_in_schema=False)
async def reset_dashboard(request: Request):
    require_web_access(request)

    try:
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("DELETE FROM histories")
                await conn.execute("DELETE FROM order_items")
                await conn.execute("DELETE FROM orders")
                await conn.execute("DELETE FROM stock_adjustments")
                await conn.execute("UPDATE products SET stock_quantity = 0")

                config_id = await conn.fetchval(
                    "SELECT config_id FROM capital_configs ORDER BY config_id DESC LIMIT 1"
                )
                if config_id:
                    await conn.execute(
                        "UPDATE capital_configs SET current_balance = starting_capital, "
                        "last_updated_at = NOW() WHERE config_id = $1",
                        config_id
                    )
                else:
                    await conn.execute(
                        "INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) "
                        "VALUES (20000, 20000, NOW())"
                    )
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {e}")

    return {"success": True, "message": "Dashboard data reset"}
