from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    user_id: int
    full_name: str | None = None
    username: str
    role: str


class MessageResponse(BaseModel):
    success: bool
    message: str
