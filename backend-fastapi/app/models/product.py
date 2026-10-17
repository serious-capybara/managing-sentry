from pydantic import BaseModel


class ProductResponse(BaseModel):
    product_id: int
    name: str = "Unknown"
    category: str = "General"
    base_cost: float = 0.0
    markup_amount: float = 0.0
    retail_price: float = 0.0
    stock_quantity: int = 0
    expiration_date: str | None = None
    low_stock_alert_level: int = 5
