import re

import bcrypt
from fastapi import HTTPException, Request

ALLOWED_ROLES = ("admin", "manager")

BCRYPT_ROUNDS = 10   # PHP's default cost; about 4x faster to check than cost 12


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
    normalized_hash = password_hash or ""
    if normalized_hash.startswith("$2y$"):
        normalized_hash = "$2b$" + normalized_hash[4:]

    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            normalized_hash.encode("utf-8"),
        )
    except ValueError:
        return False


def normalize_role(role) -> str:
    return str(role or "").strip().lower()


def sign_in(request: Request, user: dict) -> None:
    request.session.clear()
    request.session["user"] = {
        "user_id": int(user["user_id"]),
        "full_name": user["full_name"],
        "role": user["role"],
    }


def sign_out(request: Request) -> None:
    request.session.clear()


def require_web_access(request: Request) -> dict:
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to the web portal")
    if normalize_role(user.get("role")) not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="The web portal is only available to Admin and Manager accounts")
    return user
