import asyncpg
from fastapi import APIRouter, HTTPException, Request
from models.history import HistoryResponse
from core.security import require_web_access

router = APIRouter(tags=["history"])

HISTORY_SQL = """
    SELECT
        o.order_id AS entry_id,
        o.order_id,
        o.user_id,
        o.transaction_timestamp AS created_at,
        'SALE' AS type,
        COALESCE(
            string_agg(p.name || ' (x' || oi.quantity || ')', ', '),
            'Order #' || o.order_id
        ) AS name,
        COALESCE(SUM(oi.quantity), 0) AS qty,
        o.total_amount AS amount,
        COALESCE(
            SUM(oi.cost_snapshot * oi.quantity) / NULLIF(SUM(oi.quantity), 0),
            0
        ) AS cost_per_unit,
        COALESCE(SUM(oi.cost_snapshot * oi.quantity), 0) AS cogs,
        o.notes,
        COALESCE(h.order_status, 'COMPLETED') AS order_status
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN products p ON p.product_id = oi.product_id
    LEFT JOIN histories h ON h.order_id = o.order_id
    GROUP BY o.order_id, o.user_id, o.transaction_timestamp, o.total_amount, o.notes, h.order_status

    UNION ALL

    SELECT
        sa.adjustment_id AS entry_id,
        NULL AS order_id,
        sa.user_id,
        sa.transaction_date AS created_at,
        sa.adjustment_type AS type,
        p.name,
        sa.quantity_changed AS qty,
        (sa.unit_cost * ABS(sa.quantity_changed)) AS amount,
        sa.unit_cost AS cost_per_unit,
        (sa.unit_cost * ABS(sa.quantity_changed)) AS cogs,
        sa.audit_notes AS notes,
        'COMPLETED' AS order_status
    FROM stock_adjustments sa
    LEFT JOIN products p ON p.product_id = sa.product_id

    ORDER BY created_at DESC, entry_id DESC
"""


@router.get("/history", response_model=list[HistoryResponse])
@router.get("/api/get_history.php", response_model=list[HistoryResponse], include_in_schema=False)
async def get_history(request: Request):
    require_web_access(request)

    try:
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(HISTORY_SQL)
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Database error")

    return [
        {
            "entry_id": row["entry_id"],
            "order_id": row["order_id"],
            "user_id": row["user_id"],
            "type": row["type"],
            "name": row["name"],
            "qty": int(row["qty"] or 0),
            "amount": float(row["amount"] or 0),
            "cogs": float(row["cogs"] or 0),
            "notes": row["notes"] or "",
            "order_status": row["order_status"] or "COMPLETED",
            "costPerUnit": float(row["cost_per_unit"] or 0),
            "date": row["created_at"],
            "total_quantity": int(row["qty"] or 0),
            "total_amount": float(row["amount"] or 0),
            "transaction_timestamp": row["created_at"],
            "ref": "",
        }
        for row in rows
    ]
