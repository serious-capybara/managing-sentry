import asyncpg
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from core.security import require_app_access


class CapitalUpdate(BaseModel):
    capital: float = Field(ge=0)


class CapitalResponse(BaseModel):
    capital: float
    starting_capital: float
    current_balance: float
    last_updated_at: str | None = None


router = APIRouter(tags=["capital"])

DEFAULT_CAPITAL = 0.0


@router.get("/capital", response_model=CapitalResponse)
@router.get("/capital.php", response_model=CapitalResponse, include_in_schema=False)
@router.get("/api/capital", response_model=CapitalResponse, include_in_schema=False)
@router.get("/api/capital.php", response_model=CapitalResponse, include_in_schema=False)
async def get_capital(request: Request):
    require_app_access(request)

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
    updated_at = str(row["last_updated_at"]) if row["last_updated_at"] else None
    return {"capital": current, "starting_capital": starting, "current_balance": current,
            "last_updated_at": updated_at}


@router.post("/capital")
@router.post("/capital.php", include_in_schema=False)
@router.post("/api/capital", include_in_schema=False)
@router.post("/api/capital.php", include_in_schema=False)
async def set_capital(data: CapitalUpdate, request: Request):
    require_app_access(request)

    try:
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT starting_capital, current_balance FROM capital_configs ORDER BY config_id DESC LIMIT 1"
            )
            if row:
                old_starting = float(row["starting_capital"] or 0)
                old_current = float(row["current_balance"] or 0)
                diff = data.capital - old_starting
                new_balance = round(old_current + diff, 2)
                await conn.execute(
                    "INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) "
                    "VALUES ($1, $2, NOW())",
                    data.capital, new_balance
                )
            else:
                new_balance = round(data.capital, 2)
                await conn.execute(
                    "INSERT INTO capital_configs (starting_capital, current_balance, last_updated_at) "
                    "VALUES ($1, $2, NOW())",
                    data.capital, new_balance
                )
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Could not save capital data")

    return {"success": True, "message": "Capital saved", "capital": new_balance,
            "starting_capital": data.capital, "current_balance": new_balance}
