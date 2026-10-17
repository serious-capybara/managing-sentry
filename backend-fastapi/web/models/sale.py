from pydantic import BaseModel, Field, ConfigDict, AliasChoices


class SaleItem(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class SaleRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    items: list[SaleItem] = Field(min_length=1)
    method: str | None = "Cash"
    reference: str | None = None
    notes: str | None = None
    client_ref: str | None = None
    amount_received: float = Field(default=0, ge=0, validation_alias=AliasChoices("amount_received", "amount_tendered"))


class SaleResponse(BaseModel):
    success: bool
    message: str
    order_id: int
    transaction_id: int
    total_amount: float
