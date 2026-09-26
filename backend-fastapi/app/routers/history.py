from fastapi import APIRouter, HTTPException, Request
from models.history import HistoryResponse

router = APIRouter(tags=["history"])


@router.get("/history", response_model=list[HistoryResponse])
@router.get("/api/get_history.php", response_model=list[HistoryResponse], include_in_schema=False)
async def get_history(request: Request):
    query = """
        SELECT
            o.transaction_timestamp,
            o.order_id,
            COALESCE(SUM(oi.quantity), 0) as total_quantity,
            o.total_amount,
            o.notes,
            h.order_status
        FROM orders o
        LEFT JOIN histories h ON o.order_id = h.order_id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        GROUP BY o.order_id, o.transaction_timestamp, o.total_amount, o.notes, h.order_status
        ORDER BY o.transaction_timestamp DESC
    """
    try:
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(query)
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    return [
        {
            "transaction_timestamp": row["transaction_timestamp"].strftime("%Y-%m-%d %H:%M"),
            "order_id": row["order_id"],
            "total_quantity": row["total_quantity"],
            "total_amount": float(row["total_amount"]),
            "order_status": row["order_status"] or "PENDING",
            "notes": row["notes"] or "",
        }
        for row in rows
    ]
