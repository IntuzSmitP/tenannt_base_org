from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum

class RoleEnum(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    is_owner: bool
    status: str
    created_at: datetime
    
    model_config = {"from_attributes": True}

class UserInvitationCreate(BaseModel):
    email: EmailStr
    name: str
    role: RoleEnum = RoleEnum.MEMBER

class UserInvitationResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: str
    status: str
    expires_at: datetime
    
    model_config = {"from_attributes": True}
