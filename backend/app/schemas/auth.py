from pydantic import BaseModel, EmailStr, field_validator, model_validator
from uuid import UUID
from app.core.security import validate_password_strength

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    tenant_slug: str | None = None
    
class TokenPayload(BaseModel):
    sub: str
    exp: int
    type: str = "access"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'ResetPasswordRequest':
        if self.new_password != self.confirm_password:
            raise ValueError('Passwords do not match')
        return self
