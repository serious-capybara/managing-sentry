from pydantic import BaseModel


class HistoryResponse(BaseModel):
    entry_id: int
    order_id: int | None
    user_id: int | None
    type: str | None
    name: str | None
    qty: int
    amount: float
    cogs: float
    notes: str
    order_status: str
    costPerUnit: float
    date: str | None
    total_quantity: int
    total_amount: float
    transaction_timestamp: str | None
    ref: str = ""
