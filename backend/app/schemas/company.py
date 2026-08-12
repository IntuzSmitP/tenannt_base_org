from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.core.security import validate_password_strength

class CompanyCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}
    company_name: str = Field(..., min_length=2, max_length=50, pattern=r'.*[a-zA-Z].*')
    owner_name: str = Field(..., min_length=2, max_length=50, pattern=r'.*[a-zA-Z].*')
    owner_email: EmailStr
    owner_password: str = Field(..., min_length=8, max_length=72)
    owner_confirm_password: str = Field(..., max_length=72)

    @field_validator("owner_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'CompanyCreate':
        if self.owner_password != self.owner_confirm_password:
            raise ValueError('Passwords do not match')
        return self

class CompanyResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    owner_email: str
    status: str
    created_at: datetime
    
    model_config = {"from_attributes": True}

class CompanyDeleteRequest(BaseModel):
    email: EmailStr
    password: str

class CompanyImpactResponse(BaseModel):
    projects_count: int
    tasks_count: int
    users_count: int
