from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.models.tenant import Task, User
from app.repositories.task import task_repo
from app.core.exceptions import AppException

class TaskService:
    @staticmethod
    async def create_task(db: AsyncSession, current_user: User, task_in: TaskCreate) -> TaskResponse:
        data = task_in.model_dump()
        data["created_by"] = current_user.id
        task = await task_repo.create(db, obj_in=data)
        return TaskResponse.model_validate(task)
        
    @staticmethod
    async def get_tasks(db: AsyncSession, current_user: User, project_id: UUID, skip: int = 0, limit: int = 100) -> List[TaskResponse]:
        # Would normally check if user has access to project here
        tasks = await task_repo.get_multi_by_project(db, project_id=project_id, skip=skip, limit=limit)
        return [TaskResponse.model_validate(t) for t in tasks]
        
    @staticmethod
    async def get_user_tasks(db: AsyncSession, current_user: User, skip: int = 0, limit: int = 100) -> List[TaskResponse]:
        tasks = await task_repo.get_multi_by_assignee(db, user_id=current_user.id, skip=skip, limit=limit)
        return [TaskResponse.model_validate(t) for t in tasks]
        
    @staticmethod
    async def update_task(db: AsyncSession, current_user: User, task_id: UUID, task_in: TaskUpdate) -> TaskResponse:
        task = await task_repo.get(db, id=task_id)
        if not task:
            raise AppException("Task not found", status_code=404)
            
        updated = await task_repo.update(db, db_obj=task, obj_in=task_in)
        return TaskResponse.model_validate(updated)
        
    @staticmethod
    async def delete_task(db: AsyncSession, current_user: User, task_id: UUID) -> bool:
        task = await task_repo.get(db, id=task_id)
        if not task:
            raise AppException("Task not found", status_code=404)
            
        await task_repo.remove(db, id=task_id, deleted_by=current_user.id)
        return True

task_service = TaskService()
