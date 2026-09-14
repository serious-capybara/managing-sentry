from fastapi import APIRouter, HTTPException, Request
from models.user import LoginRequest, LoginResponse
from core.security import verify_password

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=LoginResponse)
@router.post("/login.php", response_model=LoginResponse, include_in_schema=False)
async def login(credentials: LoginRequest, request: Request):
    try:
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT user_id, full_name, username, password_hash, role "
                "FROM users WHERE username = $1",
                credentials.username
            )
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

    if row is None or not verify_password(credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = dict(row)
    del user["password_hash"]
    return user
