import os
import hashlib
import hmac
import logging
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("app")

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == "change_me":
    _seed = (
        os.getenv("DB_PASSWORD")
        or os.getenv("F_DB_PASSWORD")
        or os.getenv("DB_HOST")
        or os.getenv("F_DB_HOST")
        or "managing-sentry-fixed-secret-seed-key"
    )
    SECRET_KEY = hmac.new(
        _seed.encode("utf-8"),
        b"managing-sentry-app-session-v1",
        hashlib.sha256
    ).hexdigest()
