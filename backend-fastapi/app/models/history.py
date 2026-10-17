from pydantic import BaseModel
from datetime import datetime


class HistoryResponse(BaseModel):
    transaction_timestamp: str
    order_id: int
    total_quantity: int
    total_amount: float
    order_status: str
    notes: str = ""
    items_json: str = "[]"
    amount_tendered: float = 0.0
    change_given: float = 0.0
    cashier: str = ""
