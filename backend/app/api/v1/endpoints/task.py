from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.schemas.common import APIResponse
from app.services.task import task_service
from app.dependencies.tenant import get_tenant_db
from app.dependencies.auth import get_current_user
from app.models.tenant import User

router = APIRouter()

@router.post("/", response_model=APIResponse[TaskResponse])
async def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    task = await task_service.create_task(db, current_user, task_in)
    return APIResponse(success=True, message="Task created", data=task)

@router.get("/me", response_model=APIResponse[List[TaskResponse]])
async def get_my_tasks(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    tasks = await task_service.get_user_tasks(db, current_user, skip, limit)
    return APIResponse(success=True, message="My tasks retrieved", data=tasks)

@router.get("/project/{project_id}", response_model=APIResponse[List[TaskResponse]])
async def get_tasks(
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    tasks = await task_service.get_tasks(db, current_user, project_id, skip, limit)
    return APIResponse(success=True, message="Tasks retrieved", data=tasks)

@router.put("/{task_id}", response_model=APIResponse[TaskResponse])
async def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    task = await task_service.update_task(db, current_user, task_id, task_in)
    return APIResponse(success=True, message="Task updated", data=task)

@router.delete("/{task_id}", response_model=APIResponse[bool])
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    result = await task_service.delete_task(db, current_user, task_id)
    return APIResponse(success=True, message="Task deleted", data=result)
