from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum
from app.core.security import validate_password_strength

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

class AcceptInvitationRequest(BaseModel):
    token: str
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'AcceptInvitationRequest':
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        return self

class TimelineEvent(BaseModel):
    event_type: str
    date: datetime
    description: str
    status: Optional[str] = None
    
class MemberProfileResponse(BaseModel):
    name: str
    email: str
    current_status: str
    role: str
    timeline: list[TimelineEvent]

class UserDeletionImpactResponse(BaseModel):
    assigned_tasks_count: int
    project_memberships_count: int
