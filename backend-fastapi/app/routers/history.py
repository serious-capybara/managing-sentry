import json
import re
from fastapi import APIRouter, HTTPException, Request
from models.history import HistoryResponse
from core.security import require_app_access

router = APIRouter(tags=["history"])


@router.get("/history", response_model=list[HistoryResponse])
@router.get("/api/get_history.php", response_model=list[HistoryResponse], include_in_schema=False)
async def get_history(request: Request):
    require_app_access(request)
    query = """
        SELECT o.transaction_timestamp, o.order_id, o.total_amount, o.amount_tendered, o.change_given,
               o.notes, u.full_name AS cashier, h.order_status
        FROM orders o
        LEFT JOIN users u ON u.user_id = o.user_id
        LEFT JOIN histories h ON h.order_id = o.order_id
        ORDER BY o.transaction_timestamp DESC
    """
    items_query = """
        SELECT oi.order_id, COALESCE(p.name, 'Deleted product') AS name, oi.quantity, oi.price_snapshot
        FROM order_items oi
        LEFT JOIN products p ON p.product_id = oi.product_id
        ORDER BY oi.order_id, oi.order_item_id
    """
    try:
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(query)
            item_rows = await conn.fetch(items_query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    items_by_order = {}
    for item in item_rows:
        items_by_order.setdefault(item["order_id"], []).append(
            {"name": item["name"], "qty": int(item["quantity"] or 0), "price": float(item["price_snapshot"] or 0)}
        )

    result, seen = [], set()
    for row in rows:
        if row["order_id"] in seen:
            continue
        seen.add(row["order_id"])
        items = items_by_order.get(row["order_id"], [])

        ts_raw = row["transaction_timestamp"]
        if hasattr(ts_raw, "strftime"):
            ts_str = ts_raw.strftime("%Y-%m-%d %H:%M")
        elif ts_raw:
            ts_str = str(ts_raw)[:16]
        else:
            ts_str = ""

        result.append({
            "transaction_timestamp": ts_str,
            "order_id": row["order_id"],
            "total_quantity": sum(i["qty"] for i in items),
            "total_amount": float(row["total_amount"] or 0),
            "order_status": str(row["order_status"] or "COMPLETED"),
            "notes": re.sub(r"\s*\[(?:web|app)-[a-z0-9]+\]", "", row["notes"] or "").strip(),
            "items_json": json.dumps(items),
            "amount_tendered": float(row["amount_tendered"] or 0),
            "change_given": float(row["change_given"] or 0),
            "cashier": str(row["cashier"] or ""),
        })
    return result
