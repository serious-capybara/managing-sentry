import asyncpg


async def _insert_with_fallback(conn, primary_sql, primary_args, fallback_sql_builder):
    """
    Run an INSERT inside a SAVEPOINT. If it fails (e.g. the id column has no default),
    only the savepoint is rolled back, so the surrounding transaction stays usable and
    the fallback INSERT (with an explicit id) can run.
    """
    try:
        async with conn.transaction():
            return await conn.fetchval(primary_sql, *primary_args)
    except asyncpg.PostgresError:
        return await fallback_sql_builder()


async def insert_product(conn, name, category, cost, markup, price, stock, expiry, alert_level) -> int:
    async def fallback():
        next_id = await conn.fetchval("SELECT COALESCE(MAX(product_id), 0) + 1 FROM products")
        await conn.execute(
            "INSERT INTO products (product_id, name, category, base_cost, markup_amount, retail_price, "
            "stock_quantity, expiration_date, low_stock_alert_level) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            next_id, name, category, cost, markup, price, stock, expiry, alert_level
        )
        return next_id

    return await _insert_with_fallback(
        conn,
        "INSERT INTO products (name, category, base_cost, markup_amount, retail_price, "
        "stock_quantity, expiration_date, low_stock_alert_level) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING product_id",
        (name, category, cost, markup, price, stock, expiry, alert_level),
        fallback,
    )


async def insert_stock_adjustment(conn, product_id, user_id, adj_type, qty_changed, unit_cost, notes) -> None:
    """Record a stock movement. This is what the History page reads, so it must not fail silently."""
    notes = notes or None

    async def fallback():
        next_id = await conn.fetchval("SELECT COALESCE(MAX(adjustment_id), 0) + 1 FROM stock_adjustments")
        await conn.execute(
            "INSERT INTO stock_adjustments "
            "(adjustment_id, product_id, user_id, adjustment_type, quantity_changed, unit_cost, "
            "transaction_date, audit_notes) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)",
            next_id, product_id, user_id, adj_type, qty_changed, unit_cost, notes
        )
        return next_id

    await _insert_with_fallback(
        conn,
        "INSERT INTO stock_adjustments "
        "(product_id, user_id, adjustment_type, quantity_changed, unit_cost, transaction_date, audit_notes) "
        "VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING adjustment_id",
        (product_id, user_id, adj_type, qty_changed, unit_cost, notes),
        fallback,
    )
