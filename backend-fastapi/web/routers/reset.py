import asyncpg
from fastapi import APIRouter, Body, HTTPException, Request, status
from pydantic import BaseModel, Field
from models.user import MessageResponse
from core.security import require_web_access


class ResetRequest(BaseModel):
    confirm: bool = Field(
        default=False,
        description="Set to true to explicitly confirm resetting all system data.",
        json_schema_extra={"example": {"confirm": True}}
    )


router = APIRouter(tags=["reset"])


@router.post(
    "/reset",
    response_model=MessageResponse,
    summary="Reset System Dashboard Data",
    description=(
        "Deletes all orders, histories, and stock adjustments, sets all product stock "
        "quantities to 0, and resets the capital balance to the starting capital. "
        "**Requires Admin or Manager role** and explicit confirmation via `confirm: true`."
    ),
    responses={
        200: {
            "description": "Dashboard data successfully reset.",
            "content": {
                "application/json": {
                    "example": {"success": True, "message": "Dashboard data reset"}
                }
            },
        },
        400: {
            "description": "Bad Request — Explicit confirmation missing or false.",
            "content": {
                "application/json": {
                    "example": {"detail": "Explicit confirmation required. Send 'confirm': true in the request body to reset dashboard data."}
                }
            },
        },
        401: {
            "description": "Unauthorized — Missing or invalid session.",
            "content": {
                "application/json": {
                    "example": {"detail": "Please sign in to the web portal"}
                }
            },
        },
        403: {
            "description": "Forbidden — Restricted to Admin and Manager accounts.",
            "content": {
                "application/json": {
                    "example": {"detail": "The web portal is only available to Admin and Manager accounts"}
                }
            },
        },
        500: {
            "description": "Internal Server Error — Database transaction error.",
            "content": {
                "application/json": {
                    "example": {"detail": "Reset failed: database transaction error"}
                }
            },
        },
    },
)
@router.post("/reset.php", response_model=MessageResponse, include_in_schema=False)
@router.post("/api/reset", response_model=MessageResponse, include_in_schema=False)
@router.post("/api/reset.php", response_model=MessageResponse, include_in_schema=False)
async def reset_dashboard(
    request: Request,
    payload: ResetRequest = Body(
        ...,
        openapi_examples={
            "confirmed": {
                "summary": "Confirmed Reset",
                "description": "Sends confirm: true to authorize resetting all data.",
                "value": {"confirm": True},
            },
            "unconfirmed": {
                "summary": "Unconfirmed Attempt (Fails with 400)",
                "description": "Sends confirm: false or omits confirmation.",
                "value": {"confirm": False},
            },
        },
    ),
):
    user = require_web_access(request)

    role = str(user.get("role") or "").strip().lower()
    if role not in ("admin", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The web portal is only available to Admin and Manager accounts"
        )

    if not payload.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit confirmation required. Send 'confirm': true in the request body to reset dashboard data."
        )

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
                        "VALUES (0, 0, NOW())"
                    )
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {e}")

    return {"success": True, "message": "Dashboard data reset"}
