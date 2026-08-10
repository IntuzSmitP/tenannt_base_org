from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.base import BaseRepository
from app.models.tenant import Project, ProjectMember
from app.schemas.project import ProjectCreate, ProjectUpdate
from typing import Optional, List
from uuid import UUID

class ProjectRepository(BaseRepository[Project, ProjectCreate, ProjectUpdate]):
    async def get_multi_by_user(
        self, db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Project]:
        from app.models.tenant import Task
        # User can access project if they created it, they are a member, or assigned a task in it
        stmt = select(Project).outerjoin(ProjectMember, Project.id == ProjectMember.project_id)\
            .outerjoin(Task, Project.id == Task.project_id)\
            .where(
                (Project.created_by == user_id) | 
                (ProjectMember.user_id == user_id) |
                (Task.assigned_to == user_id)
            )\
            .where(Project.deleted_at.is_(None))\
            .distinct()\
            .offset(skip).limit(limit)
        
        result = await db.execute(stmt)
        return list(result.scalars().all())

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
