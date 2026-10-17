import os
import secrets
import logging
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("app")

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == "change_me":
    _seed = os.getenv("DB_PASSWORD", "")
    if _seed:
        import hashlib, hmac
        SECRET_KEY = hmac.new(_seed.encode(), b"managing-sentry-app-session-v1", hashlib.sha256).hexdigest()
    else:
        SECRET_KEY = secrets.token_urlsafe(48)
        log.warning("SECRET_KEY is not set - using a random key.")
