from pydantic import BaseModel, Field, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional

class CompanyCreate(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=100)
    owner_name: str = Field(..., min_length=2, max_length=100)
    owner_email: EmailStr
    owner_password: str = Field(..., min_length=8)

class CompanyResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    owner_email: str
    status: str
    created_at: datetime
    
    model_config = {"from_attributes": True}
