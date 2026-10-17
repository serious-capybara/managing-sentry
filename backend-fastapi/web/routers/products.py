import asyncpg
from datetime import datetime
from fastapi import APIRouter, Body, HTTPException, Query, Request, Response
from pydantic import ValidationError
from models.product import ProductResponse, ProductCreate, StockMovement, ProductDelete
from core.security import require_web_access
from core.utils import round_money, build_audit_notes
from database.queries import insert_product, insert_stock_adjustment

router = APIRouter(tags=["products"])

LIST_SQL = """
    SELECT p.product_id, p.name, p.category, p.base_cost, p.markup_amount,
           p.retail_price, p.stock_quantity, p.expiration_date,
           p.low_stock_alert_level,
           COALESCE(SUM(oi.quantity), 0) AS sold,
           COALESCE(SUM(oi.quantity * oi.price_snapshot), 0) AS sold_revenue,
           COALESCE(SUM(oi.quantity * oi.cost_snapshot), 0) AS sold_cogs
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.product_id
    GROUP BY p.product_id, p.name, p.category, p.base_cost, p.markup_amount,
             p.retail_price, p.stock_quantity, p.expiration_date, p.low_stock_alert_level
    ORDER BY p.name ASC, p.product_id ASC
"""


@router.get("/products", response_model=list[ProductResponse] | list[str])
@router.get("/products.php", response_model=list[ProductResponse] | list[str], include_in_schema=False)
@router.get("/api/products", response_model=list[ProductResponse] | list[str], include_in_schema=False)
@router.get("/api/products.php", response_model=list[ProductResponse] | list[str], include_in_schema=False)
async def get_products(
    request: Request,
    response: Response,
    action: str = Query("list", description="`list` (default) or `categories`"),
    limit: int | None = Query(None, ge=1, le=2000, description="Page size (omit to get everything)"),
    offset: int = Query(0, ge=0),
):
    require_web_access(request)

    try:
        async with request.app.state.pool.acquire() as conn:
            if action == "categories":
                rows = await conn.fetch(
                    "SELECT DISTINCT category FROM products "
                    "WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC"
                )
                return [row["category"] for row in rows]
            if limit is None:
                rows = await conn.fetch(LIST_SQL)
            else:
                rows = await conn.fetch(LIST_SQL + " LIMIT $1 OFFSET $2", limit, offset)
                response.headers["X-Total-Count"] = str(await conn.fetchval("SELECT COUNT(*) FROM products"))
    except asyncpg.PostgresError:
        raise HTTPException(status_code=500, detail="Database error")

    products = []
    for row in rows:
        base_cost = float(row["base_cost"] or 0)
        retail_price = float(row["retail_price"] or 0)
        stock = int(row["stock_quantity"] or 0)
        expiry = row["expiration_date"]
        alert = int(row["low_stock_alert_level"]) if row["low_stock_alert_level"] is not None else 20
        products.append({
            "product_id": row["product_id"],
            "id": row["product_id"],
            "name": row["name"],
            "category": row["category"],
            "base_cost": base_cost,
            "cost": base_cost,
            "markup_amount": float(row["markup_amount"] or 0),
            "retail_price": retail_price,
            "price": retail_price,
            "srp": retail_price,
            "stock_quantity": stock,
            "stock": stock,
            "stockBaseline": stock,
            "expiration_date": expiry,
            "expiry": expiry or "",
            "expiryBatches": (
                [{"expiry": expiry, "qty": stock,
                  "addedAt": datetime.now().astimezone().isoformat(timespec="seconds")}]
                if expiry else []
            ),
            "low_stock_alert_level": alert,
            "lowStockAlertLevel": alert,
            "sold": int(row["sold"] or 0),
            "sold_revenue": float(row["sold_revenue"] or 0),
            "sold_cogs": float(row["sold_cogs"] or 0),
        })
    return products


@router.post("/products")
@router.post("/products.php", include_in_schema=False)
@router.post("/api/products", include_in_schema=False)
@router.post("/api/products.php", include_in_schema=False)
async def products_action(
    request: Request,
    action: str | None = Query(None, description="`add` | `edit` | `stock` | `delete`"),
    data: dict = Body(default={}),
):
    resolved_action = action or request.query_params.get("action") or data.get("action")
    user = require_web_access(request)
    user_id = user["user_id"]
    full_name = user.get("full_name") or user.get("username")

    if data.get("product_id") or data.get("id"):
        if resolved_action == "add":
            resolved_action = "edit"

    if resolved_action not in ("add", "edit", "stock", "delete"):
        raise HTTPException(status_code=400, detail="Unknown product action")

    try:
        async with request.app.state.pool.acquire() as conn:
            if resolved_action == "add":
                return await add_product(conn, user_id, full_name, data)
            if resolved_action == "edit":
                return await edit_product(conn, user_id, full_name, data)
            if resolved_action == "stock":
                return await move_stock(conn, user_id, full_name, data)
            return await delete_product(conn, user_id, full_name, data)
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


async def edit_product(conn, user_id: int, full_name, data: dict):
    raw_id = data.get("product_id") or data.get("id")
    try:
        product_id = int(raw_id)
        if product_id <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="A valid product ID is required")

    try:
        p = ProductCreate(**data)
    except (ValidationError, TypeError):
        raise HTTPException(status_code=400, detail="Valid name, category, stock, and prices are required")

    markup = max(0.0, round_money(p.price - p.cost))
    alert_level = p.low_stock_alert_level or 20
    expiry = p.expiry or None

    async with conn.transaction():
        current = await conn.fetchrow("SELECT * FROM products WHERE product_id = $1 FOR UPDATE", product_id)
        if not current:
            raise HTTPException(status_code=404, detail="Product not found")

        # Stock is changed only from the Stock section, never while editing a product.
        new_stock = int(current["stock_quantity"])

        await conn.execute(
            "UPDATE products SET name = $1, category = $2, base_cost = $3, markup_amount = $4, "
            "retail_price = $5, expiration_date = $6, low_stock_alert_level = $7 "
            "WHERE product_id = $8",
            p.name, p.category, p.cost, markup, p.price, expiry, alert_level, product_id
        )

        await insert_stock_adjustment(
            conn, product_id, user_id, "PRODUCT EDITED", 0, p.cost,
            build_audit_notes(full_name, data.get("notes"), client_ref=data.get("client_ref"))
        )

    return {"success": True, "message": "Product updated", "product_id": product_id}


async def add_product(conn, user_id: int, full_name, data: dict):
    try:
        p = ProductCreate(**data)
    except (ValidationError, TypeError):
        raise HTTPException(status_code=400, detail="Valid name, category, stock, and prices are required")

    markup = max(0.0, round_money(p.price - p.cost))
    alert_level = p.low_stock_alert_level or 20
    expiry = p.expiry or None

    async with conn.transaction():
        existing = await conn.fetchrow(
            "SELECT product_id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))",
            p.name
        )
        if existing:
            product_id = existing["product_id"]
            await conn.execute(
                "UPDATE products SET category = $1, base_cost = $2, markup_amount = $3, retail_price = $4, "
                "stock_quantity = stock_quantity + $5, expiration_date = $6, low_stock_alert_level = $7 "
                "WHERE product_id = $8",
                p.category, p.cost, markup, p.price, p.stock, expiry, alert_level, product_id
            )
            await insert_stock_adjustment(conn, product_id, user_id, "STOCK IN", p.stock, p.cost,
                                          build_audit_notes(full_name, data.get("notes"), client_ref=data.get("client_ref")))
        else:
            product_id = await insert_product(conn, p.name, p.category, p.cost, markup, p.price,
                                              p.stock, expiry, alert_level)
            await insert_stock_adjustment(conn, product_id, user_id, "NEW PRODUCT", p.stock, p.cost,
                                          build_audit_notes(full_name, data.get("notes"), client_ref=data.get("client_ref")))
    return {"success": True, "message": "Product added", "product_id": product_id}


async def move_stock(conn, user_id: int, full_name, data: dict):
    try:
        m = StockMovement(**data)
    except (ValidationError, TypeError):
        raise HTTPException(status_code=400, detail="Valid product, quantity, and stock movement type are required")

    notes = build_audit_notes(
        full_name,
        ((f"Ref: {m.reference}. " if m.reference else "") + (m.notes or "")).strip(),
        client_ref=m.client_ref
    )

    async with conn.transaction():
        product = await conn.fetchrow("SELECT * FROM products WHERE product_id = $1 FOR UPDATE", m.product_id)
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")

        old_stock = int(product["stock_quantity"])
        if m.type == "STOCK OUT" and m.quantity > old_stock:
            raise HTTPException(status_code=400, detail="Stock out quantity exceeds available stock")
        new_stock = old_stock + m.quantity if m.type == "STOCK IN" else old_stock - m.quantity

        if m.type == "STOCK IN" and m.expiry:
            await conn.execute(
                "UPDATE products SET stock_quantity = $1, expiration_date = $2 WHERE product_id = $3",
                new_stock, m.expiry, m.product_id
            )
        else:
            await conn.execute(
                "UPDATE products SET stock_quantity = $1 WHERE product_id = $2",
                new_stock, m.product_id
            )

        await insert_stock_adjustment(
            conn, m.product_id, user_id, m.type,
            -m.quantity if m.type == "STOCK OUT" else m.quantity,
            float(product["base_cost"]), notes
        )
    return {"success": True, "message": "Stock updated"}


async def delete_product(conn, user_id: int, full_name, data: dict):
    raw_id = data.get("product_id") or data.get("id")
    try:
        product_id = int(raw_id)
        if product_id <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="A valid product ID is required")

    async with conn.transaction():
        removed_name = await conn.fetchval("SELECT name FROM products WHERE product_id = $1", product_id)
        removed_cost = await conn.fetchval("SELECT base_cost FROM products WHERE product_id = $1", product_id)
        await conn.execute("DELETE FROM stock_adjustments WHERE product_id = $1", product_id)
        await conn.execute("DELETE FROM order_items WHERE product_id = $1", product_id)
        await conn.execute("DELETE FROM products WHERE product_id = $1", product_id)

        if removed_name:
            # Keep a record that it happened. The product row is gone, so its name is kept in the notes.
            try:
                async with conn.transaction():
                    await insert_stock_adjustment(
                        conn, None, user_id, "PRODUCT REMOVED", 0, float(removed_cost or 0),
                        build_audit_notes(full_name, data.get("notes"), removed_name, data.get("client_ref"))
                    )
            except asyncpg.PostgresError as err:
                print(f"Could not record the removal of '{removed_name}': {err}")

    return {"success": True, "message": "Product removed"}
