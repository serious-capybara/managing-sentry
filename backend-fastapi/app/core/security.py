import re
import bcrypt
from fastapi import HTTPException, Request
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from core import config

BCRYPT_ROUNDS = 10   # PHP's default cost; about 4x faster to check than cost 12

serializer = URLSafeTimedSerializer(config.SECRET_KEY, salt="app-session")


def hash_password(plain_password: str) -> str:
    hashed = bcrypt.hashpw(
        plain_password.encode("utf-8")[:72],
        bcrypt.gensalt(rounds=BCRYPT_ROUNDS),
    ).decode("utf-8")
    # "$2y$" is the prefix PHP writes, so the old PHP code can still verify these hashes.
    return "$2y$" + hashed[4:]


def needs_rehash(password_hash: str) -> bool:
    """True for a bcrypt hash that is slower than we need (cost above BCRYPT_ROUNDS).
    Old PHP hashes (cost 10) are left exactly as they are."""
    match = re.match(r"^\$2[abxy]\$(\d{2})\$", password_hash or "")
    return bool(match) and int(match.group(1)) > BCRYPT_ROUNDS


def verify_password(plain_password: str, password_hash: str) -> bool:
    normalized_hash = password_hash
    if normalized_hash.startswith("$2y$"):
        normalized_hash = "$2b$" + normalized_hash[4:]

    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            normalized_hash.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(user: dict) -> str:
    data = {
        "user_id": int(user["user_id"]),
        "full_name": user.get("full_name") or "",
        "username": user.get("username") or "",
        "role": user.get("role") or "",
    }
    return serializer.dumps(data)


def decode_access_token(token: str, max_age: int = 86400 * 365) -> dict | None:
    try:
        data = serializer.loads(token, max_age=max_age)
        if isinstance(data, dict) and "user_id" in data:
            return data
    except (BadSignature, SignatureExpired, Exception):
        pass
    return None


def sign_in(request: Request, user: dict) -> str:
    token = create_access_token(user)
    try:
        request.session.clear()
        request.session["user"] = {
            "user_id": int(user["user_id"]),
            "full_name": user.get("full_name"),
            "username": user.get("username"),
            "role": user.get("role"),
        }
    except Exception:
        pass
    return token


def require_app_access(request: Request) -> dict:
    # 1. Check active session if available
    try:
        user = request.session.get("user")
        if user and isinstance(user, dict) and user.get("user_id"):
            return user
    except Exception:
        pass

    # 2. Check token in Authorization header, X-Token header, or query param
    token = None
    auth_header = request.headers.get("Authorization") or ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif request.headers.get("X-Token"):
        token = request.headers.get("X-Token").strip()
    elif request.query_params.get("token"):
        token = request.query_params.get("token").strip()

    if token:
        user = decode_access_token(token)
        if user:
            return user

    raise HTTPException(status_code=401, detail="Authentication token required. Please sign in.")
