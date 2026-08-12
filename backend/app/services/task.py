from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.models.tenant import Task, User
from app.repositories.task import task_repo
from app.core.exceptions import AppException
from app.core.websockets import manager
import json
import uuid

# Helper to serialize UUIDs for WebSocket broadcast
class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return json.JSONEncoder.default(self, obj)

class TaskService:
    @staticmethod
    async def create_task(db: AsyncSession, current_user: User, task_in: TaskCreate, tenant_slug: str = None) -> TaskResponse:
        data = task_in.model_dump()
        data["created_by"] = current_user.id
        task = await task_repo.create(db, obj_in=data)
        response = TaskResponse.model_validate(task)
        
        if tenant_slug:
            # Send broadcast
            payload = json.loads(json.dumps(response.model_dump(), cls=UUIDEncoder, default=str))
            await manager.broadcast(tenant_slug, {"type": "TASK_CREATED", "payload": payload})
            
        return response
        
    @staticmethod
    async def get_tasks(db: AsyncSession, current_user: User, project_id: UUID, skip: int = 0, limit: int = 100) -> List[TaskResponse]:
        if current_user.role == "MEMBER":
            # Members only see tasks assigned to them
            tasks = await task_repo.get_multi_by_project_and_assignee(db, project_id=project_id, user_id=current_user.id, skip=skip, limit=limit)
        else:
            tasks = await task_repo.get_multi_by_project(db, project_id=project_id, skip=skip, limit=limit)
        return [TaskResponse.model_validate(t) for t in tasks]
        
    @staticmethod
    async def get_user_tasks(db: AsyncSession, current_user: User, skip: int = 0, limit: int = 100) -> List[TaskResponse]:
        tasks = await task_repo.get_multi_by_assignee(db, user_id=current_user.id, skip=skip, limit=limit)
        return [TaskResponse.model_validate(t) for t in tasks]
        
    @staticmethod
    async def update_task(db: AsyncSession, current_user: User, task_id: UUID, task_in: TaskUpdate, tenant_slug: str = None) -> TaskResponse:
        task = await task_repo.get(db, id=task_id)
        if not task:
            raise AppException("Task not found", status_code=404)
            
        updated = await task_repo.update(db, db_obj=task, obj_in=task_in)
        response = TaskResponse.model_validate(updated)
        
        if tenant_slug:
            payload = json.loads(json.dumps(response.model_dump(), cls=UUIDEncoder, default=str))
            await manager.broadcast(tenant_slug, {"type": "TASK_UPDATED", "payload": payload})
            
        return response
        
    @staticmethod
    async def delete_task(db: AsyncSession, current_user: User, task_id: UUID, tenant_slug: str = None) -> bool:
        task = await task_repo.get(db, id=task_id)
        if not task:
            raise AppException("Task not found", status_code=404)
            
        await task_repo.remove(db, id=task_id, deleted_by=current_user.id)
        
        if tenant_slug:
            await manager.broadcast(tenant_slug, {"type": "TASK_DELETED", "payload": {"id": str(task_id), "project_id": str(task.project_id)}})
            
        return True

task_service = TaskService()
