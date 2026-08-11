from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.models.tenant import Project, User
from app.repositories.project import project_repo
from app.core.exceptions import AppException

class ProjectService:
    @staticmethod
    async def create_project(db: AsyncSession, current_user: User, project_in: ProjectCreate) -> ProjectResponse:
        data = project_in.model_dump()
        data["created_by"] = current_user.id
        project = await project_repo.create(db, obj_in=data)
        return ProjectResponse.model_validate(project)
        
    @staticmethod
    async def get_projects(db: AsyncSession, current_user: User, skip: int = 0, limit: int = 100) -> List[ProjectResponse]:
        if current_user.role in ["OWNER", "ADMIN"]:
            projects = await project_repo.get_multi(db, skip=skip, limit=limit)
        else:
            projects = await project_repo.get_multi_by_user(db, user_id=current_user.id, skip=skip, limit=limit)
        return [ProjectResponse.model_validate(p) for p in projects]
        
    @staticmethod
    async def update_project(db: AsyncSession, current_user: User, project_id: UUID, project_in: ProjectUpdate) -> ProjectResponse:
        project = await project_repo.get(db, id=project_id)
        if not project:
            raise AppException("Project not found", status_code=404)
            
        if current_user.role == "MEMBER" and project.created_by != current_user.id:
            # Requires further checking for project manager role in project_members
            raise AppException("Not enough permissions to update project.", status_code=403)
            
        updated = await project_repo.update(db, db_obj=project, obj_in=project_in)
        return ProjectResponse.model_validate(updated)
        
    @staticmethod
    async def delete_project(db: AsyncSession, current_user: User, project_id: UUID) -> bool:
        project = await project_repo.get(db, id=project_id)
        if not project:
            raise AppException("Project not found", status_code=404)
            
        if current_user.role == "MEMBER" and project.created_by != current_user.id:
            raise AppException("Not enough permissions to delete project.", status_code=403)
        # Cascade soft-delete to Tasks and ProjectMembers
        from sqlalchemy import update
        from app.models.tenant import Task, ProjectMember
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        
        # Soft-delete all tasks in the project
        await db.execute(
            update(Task)
            .where(Task.project_id == project_id)
            .where(Task.deleted_at.is_(None))
            .values(deleted_at=now, deleted_by=current_user.id)
        )
        
        # Soft-delete all project members in the project
        await db.execute(
            update(ProjectMember)
            .where(ProjectMember.project_id == project_id)
            .where(ProjectMember.deleted_at.is_(None))
            .values(deleted_at=now, deleted_by=current_user.id)
        )
        
        await project_repo.remove(db, id=project_id, deleted_by=current_user.id)
        
        # Commit the cascade changes
        await db.commit()
        
        return True

    @staticmethod
    async def get_project_impact(db: AsyncSession, current_user: User, project_id: UUID) -> dict:
        from app.models.tenant import Task, ProjectMember
        from sqlalchemy import select, func
        
        # Check project exists
        project = await project_repo.get(db, id=project_id)
        if not project:
            raise AppException("Project not found", status_code=404)
            
        tasks_count = await db.scalar(
            select(func.count()).select_from(Task).where(Task.project_id == project_id, Task.deleted_at.is_(None))
        )
        
        members_count = await db.scalar(
            select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.deleted_at.is_(None))
        )
        
        return {
            "tasks_count": tasks_count or 0,
            "members_count": members_count or 0
        }

project_service = ProjectService()
