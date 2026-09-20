from pydantic import BaseModel, Field, ConfigDict


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1)

class LoginResponse(BaseModel):
    user_id: int
    full_name: str
    username: str
    role: str
