from typing import Union
from fastapi import APIRouter, HTTPException, Request, Query
from models.product import ProductResponse
from core.security import require_app_access

router = APIRouter(tags=["products"])


@router.get("/products", response_model=list[ProductResponse] | list[str])
@router.get("/api/products.php", response_model=list[ProductResponse] | list[str], include_in_schema=False)
async def get_products_api(request: Request, action: Union[str, None] = Query(None)):
    require_app_access(request)
    if action == "categories":
        return await get_categories(request)

    try:
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM products")
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    products = []
    for row in rows:
        row_dict = dict(row)
        exp = row_dict.get("expiration_date")
        products.append({
            "product_id": row_dict.get("product_id", 0),
            "name": row_dict.get("name") or "Unknown",
            "category": row_dict.get("category") or "General",
            "base_cost": float(row_dict.get("base_cost") or 0),
            "markup_amount": float(row_dict.get("markup_amount") or 0),
            "retail_price": float(row_dict.get("retail_price") or row_dict.get("srp") or 0),
            "stock_quantity": int(row_dict.get("stock_quantity") or 0),
            "expiration_date": str(exp) if exp else None,
            "low_stock_alert_level": int(row_dict.get("low_stock_alert_level") or 5),
        })
    return products


@router.get("/categories", response_model=list[str])
@router.get("/get_categories.php", response_model=list[str], include_in_schema=False)
async def get_categories(request: Request):
    require_app_access(request)
    try:
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT DISTINCT category FROM products ORDER BY category ASC"
            )
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    return [row["category"] for row in rows]
