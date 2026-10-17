import os
import secrets
import logging
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("app")

IS_VERCEL = bool(os.getenv("VERCEL"))

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == "change_me":
    _seed = os.getenv("DB_PASSWORD", "")
    if _seed:
        import hashlib, hmac
        SECRET_KEY = hmac.new(_seed.encode(), b"managing-sentry-web-session-v1", hashlib.sha256).hexdigest()
        log.warning("SECRET_KEY is not set - using a key derived from DB_PASSWORD. Set SECRET_KEY in your env.")
    else:
        SECRET_KEY = secrets.token_urlsafe(48)
        log.warning("SECRET_KEY is not set - using a random key. Sessions are lost on restart. Set SECRET_KEY in your env.")

SESSION_HTTPS_ONLY = os.getenv("SESSION_HTTPS_ONLY", "true" if IS_VERCEL else "false").lower() in ("1", "true", "yes", "on")
SESSION_SAME_SITE = os.getenv("SESSION_SAME_SITE", "none" if SESSION_HTTPS_ONLY else "lax")

DEFAULT_CORS_ORIGINS = [
    "http://localhost:8002",
    "http://127.0.0.1:8002",
    "http://localhost:8003",
    "http://127.0.0.1:8003",
    "https://managing-sentry-web.vercel.app",
    "https://managing-sentry-alekos-admin.vercel.app",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

env_cors = os.getenv("CORS_ORIGINS", "")
if env_cors:
    extra_origins = [o.strip() for o in env_cors.split(",") if o.strip()]
    CORS_ORIGINS = list(dict.fromkeys(DEFAULT_CORS_ORIGINS + extra_origins))
else:
    CORS_ORIGINS = DEFAULT_CORS_ORIGINS
