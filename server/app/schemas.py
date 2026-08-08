from pydantic import BaseModel, Field

ID_PATTERN = r"^[A-Za-z0-9]{2,16}$"


class RegisterRequest(BaseModel):
    id: str = Field(pattern=ID_PATTERN)
    password: str = Field(min_length=4, max_length=16)


class LoginRequest(BaseModel):
    id: str
    password: str


class ResetPasswordRequest(BaseModel):
    id: str
    new_password: str = Field(min_length=4, max_length=16)


class SendMessageRequest(BaseModel):
    from_id: str
    to_id: str
    code: str


class AccountOut(BaseModel):
    id: str
    known_senders: list[str]


class MessageOut(BaseModel):
    id: int
    from_id: str
    to_id: str
    code: str
    meaning: str
    time: str
    read: bool
