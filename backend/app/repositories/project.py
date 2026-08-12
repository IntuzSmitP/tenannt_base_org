from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.base import BaseRepository
from app.models.tenant import Project, ProjectMember
from app.schemas.project import ProjectCreate, ProjectUpdate
from typing import Optional, List
from uuid import UUID

class ProjectRepository(BaseRepository[Project, ProjectCreate, ProjectUpdate]):
    async def get_by_name(self, db: AsyncSession, *, name: str) -> Optional[Project]:
        stmt = select(Project).where(
            Project.name == name,
            Project.deleted_at.is_(None)
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_multi_by_user(
        self, db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Project]:
        from sqlalchemy import exists
        from app.models.tenant import Task
        # Only include projects where the member has at least 1 active (non-deleted) task assigned
        has_task = (
            select(Task.id)
            .where(
                Task.project_id == Project.id,
                Task.assigned_to == user_id,
                Task.deleted_at.is_(None)
            )
            .correlate(Project)
            .exists()
        )
        stmt = (
            select(Project)
            .where(Project.deleted_at.is_(None))
            .where(has_task)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def count_by_user(self, db: AsyncSession, *, user_id: UUID) -> int:
        from sqlalchemy import exists, func as sqlfunc
        from app.models.tenant import Task
        has_task = (
            select(Task.id)
            .where(
                Task.project_id == Project.id,
                Task.assigned_to == user_id,
                Task.deleted_at.is_(None)
            )
            .correlate(Project)
            .exists()
        )
        stmt = select(sqlfunc.count()).select_from(Project).where(Project.deleted_at.is_(None)).where(has_task)
        result = await db.execute(stmt)
        return result.scalar() or 0

class ProjectMemberRepository(BaseRepository[ProjectMember, dict, dict]):
    async def get_by_project_and_user(self, db: AsyncSession, *, project_id: UUID, user_id: UUID) -> Optional[ProjectMember]:
        stmt = select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id
        )
        result = await db.execute(stmt)
        return result.scalars().first()

project_repo = ProjectRepository(Project)
project_member_repo = ProjectMemberRepository(ProjectMember)
