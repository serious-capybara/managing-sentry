from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, HTTPException, Request
from models.user import LoginRequest, LoginResponse
from core.security import verify_password, hash_password, needs_rehash, sign_in

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=LoginResponse)
@router.post("/api/login.php", response_model=LoginResponse, include_in_schema=False)
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

    if row is None or not await run_in_threadpool(verify_password, credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # One-time speed-up: a slow (cost 12) hash is replaced by a cost-10 PHP-compatible one.
    if needs_rehash(row["password_hash"]):
        try:
            faster = await run_in_threadpool(hash_password, credentials.password)
            async with request.app.state.pool.acquire() as conn:
                await conn.execute("UPDATE users SET password_hash = $1 WHERE user_id = $2", faster, row["user_id"])
        except Exception as err:
            print(f"Could not upgrade the password hash: {err}")

    user = dict(row)
    user["full_name"] = user.get("full_name") or ""
    del user["password_hash"]
    token = sign_in(request, user)
    user["token"] = token
    return user
