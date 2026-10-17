import os
import asyncpg
from contextlib import asynccontextmanager
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST") or os.getenv("F_DB_HOST")
DB_PORT = os.getenv("DB_PORT") or os.getenv("F_DB_PORT") or "5432"
DB_NAME = os.getenv("DB_NAME") or os.getenv("F_DB_NAME")
DB_USER = os.getenv("DB_USER") or os.getenv("F_DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("F_DB_PASSWORD")

if not all([DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD]):
    raise RuntimeError("Database configuration is incomplete. Please set DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD in Vercel environment variables.")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


async def init_connection(conn: asyncpg.Connection):
    for pg_type in ("date", "time", "timetz", "timestamp", "timestamptz", "interval"):
        await conn.set_type_codec(pg_type, encoder=str, decoder=str, schema="pg_catalog", format="text")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            statement_cache_size=0,
            init=init_connection,
            ssl="require" if "pooler" in (DB_HOST or "").lower() or "supabase" in (DB_HOST or "").lower() else None
        )
    except Exception as e:
        raise RuntimeError(f"Connection failed: {e}")
    yield
    await app.state.pool.close()
