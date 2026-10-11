from pydantic import BaseModel, Field, AliasChoices


class CapitalUpdate(BaseModel):
    capital: float = Field(ge=0, validation_alias=AliasChoices("capital", "starting_capital", "current_balance"))


class CapitalResponse(BaseModel):
    capital: float
    starting_capital: float
    current_balance: float
    last_updated_at: str | None = None
