import os
import asyncio
import logging
import asyncpg
from contextlib import asynccontextmanager
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("app")

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not all([DB_HOST, DB_PORT, DB_NAME, DB_USER]) or DB_PASSWORD is None:
    raise RuntimeError("Database configuration is incomplete. Please check your env file.")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


async def init_connection(conn: asyncpg.Connection):
    # Dates/times come back as plain strings ("2026-01-31", "2026-01-31 10:00:00.123456"),
    # which is the format the web frontend already reads.
    for pg_type in ("date", "time", "timetz", "timestamp", "timestamptz", "interval"):
        await conn.set_type_codec(pg_type, encoder=str, decoder=str, schema="pg_catalog", format="text")


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = None
    last_error = None
    for attempt in range(1, 11):  # the db container may still be starting
        try:
            pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=1,
                max_size=10,
                statement_cache_size=0,
                init=init_connection,
                ssl="require" if "pooler" in DB_HOST.lower() or "supabase" in DB_HOST.lower() else None
            )
            break
        except Exception as e:
            last_error = e
            log.warning("Database not ready (attempt %s/10): %s", attempt, e)
            await asyncio.sleep(2)

    if pool is None:
        raise RuntimeError(f"Connection failed: {last_error}")

    app.state.pool = pool
    yield
    await pool.close()
