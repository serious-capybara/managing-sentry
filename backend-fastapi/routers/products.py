from fastapi import APIRouter, HTTPException, Request
from models.product import ProductResponse

router = APIRouter(tags=["products"])


@router.get("/products", response_model=list[ProductResponse])
@router.get("/get_products.php", response_model=list[ProductResponse], include_in_schema=False)
async def get_products(request: Request):
    try:
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM products")
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    products = []
    for row in rows:
        row_dict = dict(row)
        products.append({
            "product_id": row_dict.get("product_id", 0),
            "name": row_dict.get("name", "Unknown"),
            "category": row_dict.get("category", "General"),
            "base_cost": row_dict.get("base_cost", 0),
            "markup_amount": row_dict.get("markup_amount", 0),
            "retail_price": row_dict.get("retail_price") or row_dict.get("srp") or 0,
            "stock_quantity": row_dict.get("stock_quantity", 0),
            "expiration_date": row_dict.get("expiration_date"),
            "low_stock_alert_level": row_dict.get("low_stock_alert_level") or 5,
        })
    return products


@router.get("/categories", response_model=list[str])
@router.get("/get_categories.php", response_model=list[str], include_in_schema=False)
async def get_categories(request: Request):
    try:
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT DISTINCT category FROM products ORDER BY category ASC"
            )
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    return [row["category"] for row in rows]
