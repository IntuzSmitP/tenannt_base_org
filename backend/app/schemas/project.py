from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime
from typing import Optional, List
from enum import Enum

class ProjectStatusEnum(str, Enum):
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    archived = "archived"

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    status: Optional[ProjectStatusEnum] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    status: str
    created_by: UUID
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}

class ProjectMemberCreate(BaseModel):
    user_id: UUID
    role: str = "contributor"

class ProjectMemberResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    role: str
    added_at: datetime
    
    model_config = {"from_attributes": True}
