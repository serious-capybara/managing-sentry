from pydantic import BaseModel
from datetime import datetime


class HistoryResponse(BaseModel):
    transaction_timestamp: str
    order_id: int
    total_quantity: int
    total_amount: float
    order_status: str
