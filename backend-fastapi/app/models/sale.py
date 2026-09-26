from pydantic import BaseModel, Field, ConfigDict


class SaleItem(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    product_id: int
    quantity: int = Field(gt=0)
    cost_snapshot: float = Field(ge=0)
    price_snapshot: float = Field(ge=0)
    line_subtotal: float = Field(ge=0)


class SaleCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_id: int
    total_amount: float = Field(ge=0)
    amount_tendered: float = Field(ge=0)
    change_given: float = Field(ge=0)
    notes: str = ""
    items: list[SaleItem] = Field(min_length=1)
    # CHANGE THIS! PHP doesn't validate items is non-empty until the array
    # check at the top — min_length=1 here enforces it earlier via 422.


class SaleResponse(BaseModel):
    success: bool
    order_id: int
    message: str
