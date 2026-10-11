import os
import secrets
import logging
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("app")

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == "change_me":
    SECRET_KEY = secrets.token_urlsafe(48)
    log.warning("SECRET_KEY is not set - using a random key. Sessions are lost on restart. Set SECRET_KEY in your env.")

SESSION_HTTPS_ONLY = os.getenv("SESSION_HTTPS_ONLY", "false").lower() in ("1", "true", "yes", "on")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://127.0.0.1:8002,http://localhost:8002,http://127.0.0.1:8003,http://localhost:8003,http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8000,http://localhost:8000").split(",") if o.strip()]
