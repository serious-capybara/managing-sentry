async def is_identity_or_sequence_column(conn, table: str, column: str) -> bool:
    row = await conn.fetchrow(
        "SELECT is_identity, column_default FROM information_schema.columns "
        "WHERE table_name = $1 AND column_name = $2",
        table, column
    )
    if row is None:
        return False
    return row["is_identity"] == "YES" or "nextval" in (row["column_default"] or "")


async def insert_product(conn, name, category, cost, markup, price, stock, expiry, alert_level) -> int:
    if await is_identity_or_sequence_column(conn, "products", "product_id"):
        return await conn.fetchval(
            "INSERT INTO products (name, category, base_cost, markup_amount, retail_price, "
            "stock_quantity, expiration_date, low_stock_alert_level) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING product_id",
            name, category, cost, markup, price, stock, expiry, alert_level
        )

    next_id = await conn.fetchval("SELECT COALESCE(MAX(product_id), 0) + 1 FROM products")
    await conn.execute(
        "INSERT INTO products (product_id, name, category, base_cost, markup_amount, retail_price, "
        "stock_quantity, expiration_date, low_stock_alert_level) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        next_id, name, category, cost, markup, price, stock, expiry, alert_level
    )
    return next_id


async def insert_stock_adjustment(conn, product_id, user_id, adj_type, qty_changed, unit_cost, notes) -> None:
    notes = notes or None
    if await is_identity_or_sequence_column(conn, "stock_adjustments", "adjustment_id"):
        await conn.execute(
            "INSERT INTO stock_adjustments "
            "(product_id, user_id, adjustment_type, quantity_changed, unit_cost, transaction_date, audit_notes) "
            "VALUES ($1, $2, $3, $4, $5, NOW(), $6)",
            product_id, user_id, adj_type, qty_changed, unit_cost, notes
        )
    else:
        next_id = await conn.fetchval("SELECT COALESCE(MAX(adjustment_id), 0) + 1 FROM stock_adjustments")
        await conn.execute(
            "INSERT INTO stock_adjustments "
            "(adjustment_id, product_id, user_id, adjustment_type, quantity_changed, unit_cost, "
            "transaction_date, audit_notes) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)",
            next_id, product_id, user_id, adj_type, qty_changed, unit_cost, notes
        )
