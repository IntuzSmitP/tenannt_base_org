from pydantic import BaseModel, EmailStr
from uuid import UUID

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
