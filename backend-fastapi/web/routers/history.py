from fastapi import APIRouter, HTTPException, Request, Response
from models.history import HistoryResponse
from core.security import require_web_access
from core.utils import iso_ts, parse_ts

router = APIRouter(tags=["history"])

ITEMS_SQL = """
    SELECT oi.order_id, oi.product_id, oi.quantity, oi.cost_snapshot, oi.price_snapshot,
           oi.line_subtotal, p.name
    FROM order_items oi
    LEFT JOIN products p ON p.product_id = oi.product_id
    ORDER BY oi.order_id, oi.order_item_id
"""

ADJUSTMENTS_SQL = """
    SELECT sa.adjustment_id, sa.product_id, sa.user_id, sa.adjustment_type, sa.quantity_changed,
           sa.unit_cost, sa.transaction_date::text AS transaction_date, sa.audit_notes, p.name
    FROM stock_adjustments sa
    LEFT JOIN products p ON p.product_id = sa.product_id
"""


def _num(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


async def load_sales(conn) -> list[dict]:
    orders = await conn.fetch("SELECT *, transaction_timestamp::text AS ts_text FROM orders")
    item_rows = await conn.fetch(ITEMS_SQL)

    by_order: dict[int, list] = {}
    for r in item_rows:
        by_order.setdefault(r["order_id"], []).append(r)

    sales = []
    for o in orders:
        order_id = o["order_id"]
        lines = by_order.get(order_id, [])
        items = [
            {
                "product_id": r["product_id"],
                "name": r["name"] or "Deleted product",
                "qty": int(r["quantity"] or 0),
                "price": _num(r["price_snapshot"]),
                "cost": _num(r["cost_snapshot"]),
                "subtotal": _num(r["line_subtotal"], _num(r["price_snapshot"]) * int(r["quantity"] or 0)),
            }
            for r in lines
        ]
        qty = sum(i["qty"] for i in items)
        cogs = sum(i["cost"] * i["qty"] for i in items)
        names = ", ".join(f"{i['name']} (x{i['qty']})" if i["qty"] > 1 else i["name"] for i in items)
        ts = iso_ts(o["ts_text"])
        sales.append({
            "entry_id": order_id,
            "order_id": order_id,
            "user_id": o.get("user_id"),
            "type": "SALE",
            "name": names or f"Order #{order_id}",
            "qty": qty,
            "amount": _num(o.get("total_amount")),
            "cogs": cogs,
            "notes": o.get("notes") or "",
            "order_status": "COMPLETED",
            "costPerUnit": (cogs / qty) if qty else 0.0,
            "date": ts,
            "total_quantity": qty,
            "total_amount": _num(o.get("total_amount")),
            "transaction_timestamp": ts,
            "ref": "",
            "items": items,
            "amount_received": _num(o.get("amount_tendered")),
            "change_given": _num(o.get("change_given")),
        })
    return sales


async def load_adjustments(conn) -> list[dict]:
    rows = await conn.fetch(ADJUSTMENTS_SQL)
    entries = []
    for sa in rows:
        qty = int(sa["quantity_changed"] or 0)
        cost = _num(sa["unit_cost"])
        kind = str(sa["adjustment_type"] or "STOCK IN").strip().upper().replace("_", " ")
        ts = iso_ts(sa["transaction_date"])
        amount = abs(qty) * cost
        entries.append({
            "entry_id": int(sa["adjustment_id"]) + 100000,
            "order_id": None,
            "user_id": sa["user_id"],
            "type": kind,
            "name": sa["name"] or "Product Adjustment",
            "qty": qty,
            "amount": amount,
            "cogs": amount,
            "notes": sa["audit_notes"] or "",
            "order_status": "COMPLETED",
            "costPerUnit": cost,
            "date": ts,
            "total_quantity": qty,
            "total_amount": amount,
            "transaction_timestamp": ts,
            "ref": "",
            "items": [],
        })
    return entries


@router.get("/history", response_model=list[HistoryResponse])
@router.get("/get_history.php", response_model=list[HistoryResponse], include_in_schema=False)
@router.get("/api/history", response_model=list[HistoryResponse], include_in_schema=False)
@router.get("/api/get_history.php", response_model=list[HistoryResponse], include_in_schema=False)
async def get_history(request: Request, response: Response):
    require_web_access(request)

    entries: list[dict] = []
    errors: list[str] = []

    async with request.app.state.pool.acquire() as conn:
        for label, loader in (("sales", load_sales), ("stock movements", load_adjustments)):
            try:
                entries.extend(await loader(conn))
            except Exception as err:
                print(f"History: could not load {label}: {err}")
                errors.append(f"{label}: {err}")

    if errors and not entries:
        raise HTTPException(status_code=500, detail="Could not load history — " + "; ".join(errors))

    def sort_key(e):
        dt = parse_ts(e["date"])
        return (dt.timestamp() if dt else 0, e["entry_id"])

    entries.sort(key=sort_key, reverse=True)

    if errors:
        warning = " | ".join(errors).encode("ascii", "replace").decode("ascii")[:400]
        response.headers["X-History-Warnings"] = " ".join(warning.split())
    return entries
