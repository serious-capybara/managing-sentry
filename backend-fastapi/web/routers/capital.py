import asyncpg
from fastapi import APIRouter, HTTPException, Request
from models.capital import CapitalUpdate, CapitalResponse
from core.security import require_web_access

router = APIRouter(tags=["capital"])

DEFAULT_CAPITAL = 20000.0


@router.get("/capital", response_model=CapitalResponse)
@router.get("/api/capital.php", response_model=CapitalResponse, include_in_schema=False)
async def get_capital(request: Request):
    require_web_access(request)

    try:
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT starting_capital, current_balance, last_updated_at "
                "FROM capital_configs ORDER BY config_id DESC LIMIT 1"
            )
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Database error")

    if row is None:
        return {"capital": DEFAULT_CAPITAL, "starting_capital": DEFAULT_CAPITAL,
                "current_balance": DEFAULT_CAPITAL, "last_updated_at": None}

    starting = float(row["starting_capital"]) if row["starting_capital"] is not None else DEFAULT_CAPITAL
    current = float(row["current_balance"]) if row["current_balance"] is not None else starting
    return {"capital": current, "starting_capital": starting, "current_balance": current,
            "last_updated_at": row["last_updated_at"]}


@router.post("/capital")
@router.post("/api/capital.php", include_in_schema=False)
async def set_capital(data: CapitalUpdate, request: Request):
    require_web_access(request)

    try:
        async with request.app.state.pool.acquire() as conn:
            config_id = await conn.fetchval(
                "SELECT config_id FROM capital_configs ORDER BY config_id DESC LIMIT 1"
            )
            if config_id:
                await conn.execute(
                    "UPDATE capital_configs SET current_balance = $1, starting_capital = $1, "
                    "last_updated_at = NOW() WHERE config_id = $2",
                    data.capital, config_id
                )
            else:
                await conn.execute(
                    "INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) "
                    "VALUES ($1, $1, NOW())",
                    data.capital
                )
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Could not save capital data")

    return {"success": True, "message": "Capital saved", "capital": data.capital,
            "starting_capital": data.capital, "current_balance": data.capital}
