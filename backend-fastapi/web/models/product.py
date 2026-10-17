from pydantic import BaseModel, Field, ConfigDict, AliasChoices


class ExpiryBatch(BaseModel):
    expiry: str
    qty: int
    addedAt: str


class ProductResponse(BaseModel):
    product_id: int
    id: int
    name: str | None
    category: str | None
    base_cost: float
    cost: float
    markup_amount: float
    retail_price: float
    price: float
    srp: float
    stock_quantity: int
    stock: int
    stockBaseline: int
    expiration_date: str | None
    expiry: str
    expiryBatches: list[ExpiryBatch]
    low_stock_alert_level: int
    lowStockAlertLevel: int
    sold: int
    sold_revenue: float
    sold_cogs: float


class ProductCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    stock: int = Field(ge=0, validation_alias=AliasChoices("stock", "stock_quantity"))
    price: float = Field(ge=0, validation_alias=AliasChoices("price", "retail_price"))
    cost: float = Field(ge=0, validation_alias=AliasChoices("cost", "base_cost"))
    expiry: str | None = Field(default=None, validation_alias=AliasChoices("expiry", "expiration_date"))
    low_stock_alert_level: int | None = Field(
        default=None, validation_alias=AliasChoices("low_stock_alert_level", "lowStockAlertLevel")
    )


class StockMovement(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    product_id: int = Field(gt=0, validation_alias=AliasChoices("product_id", "id"))
    quantity: int = Field(gt=0, validation_alias=AliasChoices("quantity", "qty"))
    type: str = Field(pattern=r"^(STOCK IN|STOCK OUT)$")
    expiry: str | None = None
    reference: str | None = Field(default=None, validation_alias=AliasChoices("reference", "ref"))
    notes: str | None = None
    client_ref: str | None = None


class ProductDelete(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: int = Field(gt=0, validation_alias=AliasChoices("product_id", "id"))
