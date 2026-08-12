from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.base import BaseRepository
from app.models.tenant import Task
from app.schemas.task import TaskCreate, TaskUpdate
from typing import List
from uuid import UUID

class TaskRepository(BaseRepository[Task, TaskCreate, TaskUpdate]):
    async def get_multi_by_project(
        self, db: AsyncSession, *, project_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Task]:
        stmt = select(Task).where(
            Task.project_id == project_id,
            Task.deleted_at.is_(None)
        ).offset(skip).limit(limit)
        
        result = await db.execute(stmt)
        return list(result.scalars().all())
        
    async def get_multi_by_assignee(
        self, db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Task]:
        stmt = select(Task).where(
            Task.assigned_to == user_id,
            Task.deleted_at.is_(None)
        ).offset(skip).limit(limit)
        
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_multi_by_project_and_assignee(
        self, db: AsyncSession, *, project_id: UUID, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Task]:
        stmt = select(Task).where(
            Task.project_id == project_id,
            Task.assigned_to == user_id,
            Task.deleted_at.is_(None)
        ).offset(skip).limit(limit)
        
        result = await db.execute(stmt)
        return list(result.scalars().all())

task_repo = TaskRepository(Task)
