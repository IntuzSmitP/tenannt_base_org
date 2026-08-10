from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime
from typing import Optional
from enum import Enum

class TaskStatusEnum(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    review = "review"
    done = "done"

class TaskPriorityEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"

class TaskCreate(BaseModel):
    project_id: UUID
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    priority: TaskPriorityEnum = TaskPriorityEnum.medium
    assigned_to: Optional[UUID] = None
    due_date: Optional[date] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    status: Optional[TaskStatusEnum] = None
    priority: Optional[TaskPriorityEnum] = None
    assigned_to: Optional[UUID] = None
    due_date: Optional[date] = None

class TaskResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    assigned_to: Optional[UUID] = None
    due_date: Optional[date] = None
    created_by: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}
