import html
from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse
from core.security import require_web_access

router = APIRouter(tags=["maintenance"])


@router.get("/maintenance", response_class=HTMLResponse)
@router.get("/tools/maintenance.php", response_class=HTMLResponse, include_in_schema=False)
async def maintenance(
    request: Request,
    action: str = Query("status", description="`schema` | `add_notes` | `test`"),
    table: str = Query("products", description="Table name (used with action=schema)"),
):
    require_web_access(request)

    async with request.app.state.pool.acquire() as conn:
        if action == "schema":
            rows = await conn.fetch(
                "SELECT column_name FROM information_schema.columns WHERE table_name = $1", table
            )
            body = f"Columns in '{html.escape(table)}': " + ", ".join(r["column_name"] for r in rows)
        elif action == "add_notes":
            try:
                await conn.execute("ALTER TABLE orders ADD COLUMN notes TEXT")
                body = "Notes column added to orders table."
            except Exception as e:
                body = "Error adding column: " + html.escape(str(e).strip())
        elif action == "test":
            body = "Database connection successful."
        else:
            body = "Available actions: schema&amp;table=NAME, add_notes, test"
    return HTMLResponse(f"<pre>{body}</pre>")
