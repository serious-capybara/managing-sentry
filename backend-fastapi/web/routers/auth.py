import asyncpg
from fastapi import APIRouter, Body, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError
from models.user import LoginRequest, LoginResponse, MessageResponse
from core.security import ALLOWED_ROLES, normalize_role, sign_in, sign_out, verify_password

router = APIRouter(tags=["auth"])


@router.api_route("/login", methods=["GET", "POST"], response_model=LoginResponse | MessageResponse)
@router.api_route("/login.php", methods=["GET", "POST"], response_model=LoginResponse | MessageResponse, include_in_schema=False)
@router.api_route("/api/login", methods=["GET", "POST"], response_model=LoginResponse | MessageResponse, include_in_schema=False)
@router.api_route("/api/login.php", methods=["GET", "POST"], response_model=LoginResponse | MessageResponse, include_in_schema=False)
async def login(
    request: Request,
    action: str = Query("login", description="`login` (default) or `logout`"),
    data: dict = Body(default={}),
):
    if action == "logout":
        sign_out(request)
        return {"success": True, "message": "Signed out"}

    try:
        credentials = LoginRequest(**data)
    except (ValidationError, TypeError):
        raise HTTPException(status_code=400, detail="Username and password are required")

    try:
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT user_id, full_name, username, password_hash, role "
                "FROM users WHERE username = $1",
                credentials.username
            )
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Internal server error")

    if row is None or not await run_in_threadpool(verify_password, credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if normalize_role(row["role"]) not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="The web portal is only available to Admin, Manager, and Developer accounts")

    user = dict(row)
    del user["password_hash"]
    sign_in(request, user)
    return user
