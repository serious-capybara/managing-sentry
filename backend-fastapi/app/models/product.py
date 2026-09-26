from pydantic import BaseModel
from datetime import date


class ProductResponse(BaseModel):
    product_id: int
    name: str
    category: str
    base_cost: float
    markup_amount: float
    retail_price: float
    stock_quantity: int
    expiration_date: date | None
    low_stock_alert_level: int
