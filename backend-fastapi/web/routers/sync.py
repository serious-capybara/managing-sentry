import hashlib

import asyncpg
from fastapi import APIRouter, HTTPException, Request
from core.security import require_web_access

router = APIRouter(tags=["sync"])

SYNC_SQL = """
SELECT
  (SELECT COALESCE(MAX(order_id), 0) FROM orders) AS max_order,
  (SELECT COUNT(*) FROM orders) AS orders_count,
  (SELECT COALESCE(MAX(adjustment_id), 0) FROM stock_adjustments) AS max_adjustment,
  (SELECT COUNT(*) FROM stock_adjustments) AS adjustments_count,
  (SELECT COUNT(*) FROM products) AS products_count,
  (SELECT COALESCE(SUM(stock_quantity), 0) FROM products) AS stock_total,
  (SELECT COALESCE(SUM(hashtext(
      COALESCE(name, '') || '|' || COALESCE(category, '') || '|' ||
      COALESCE(retail_price::text, '') || '|' || COALESCE(base_cost::text, '') || '|' ||
      COALESCE(expiration_date::text, ''))), 0) FROM products) AS products_hash,
  (SELECT COALESCE(current_balance::text, '') || '|' || COALESCE(last_updated_at::text, '')
     FROM capital_configs ORDER BY config_id DESC LIMIT 1) AS capital_state
"""


@router.get("/sync_status")
@router.get("/sync_status.php", include_in_schema=False)
@router.get("/api/sync_status", include_in_schema=False)
@router.get("/api/sync_status.php", include_in_schema=False)
async def sync_status(request: Request):
    require_web_access(request)

    try:
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(SYNC_SQL)
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Database error")

    raw = "|".join(str(value) for value in (row.values() if row else ()))
    return {"version": hashlib.md5(raw.encode("utf-8")).hexdigest()}
