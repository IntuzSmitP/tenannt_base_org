from sqlalchemy.ext.asyncio import AsyncSession
import json
from typing import List, Optional
from uuid import UUID
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.models.tenant import Project, User
from app.repositories.project import project_repo
from app.core.exceptions import AppException
from app.core.websockets import manager
from app.services.task import UUIDEncoder

class ProjectService:
    @staticmethod
    async def create_project(db: AsyncSession, current_user: User, project_in: ProjectCreate) -> ProjectResponse:
        existing_project = await project_repo.get_by_name(db, name=project_in.name)
        if existing_project:
            raise AppException("A project with this name already exists.", status_code=400)
            
        data = project_in.model_dump()
        data["created_by"] = current_user.id
        project = await project_repo.create(db, obj_in=data)
        return ProjectResponse.model_validate(project)
        
    @staticmethod
    async def get_projects(db: AsyncSession, current_user: User, skip: int = 0, limit: int = 10) -> tuple[List[ProjectResponse], int]:
        if current_user.role in ["OWNER", "ADMIN"]:
            projects = await project_repo.get_multi(db, skip=skip, limit=limit)
            total = await project_repo.count_all(db)
        else:
            projects = await project_repo.get_multi_by_user(db, user_id=current_user.id, skip=skip, limit=limit)
            total = await project_repo.count_by_user(db, user_id=current_user.id)
        return [ProjectResponse.model_validate(p) for p in projects], total
        
    @staticmethod
    async def update_project(db: AsyncSession, current_user: User, project_id: UUID, project_in: ProjectUpdate, tenant_slug: Optional[str] = None) -> ProjectResponse:
        project = await project_repo.get(db, id=project_id)
        if not project:
            raise AppException("Project not found", status_code=404)
            
        if current_user.role == "MEMBER" and project.created_by != current_user.id:
            # Requires further checking for project manager role in project_members
            raise AppException("Not enough permissions to update project.", status_code=403)
            
        if project_in.name and project_in.name != project.name:
            existing_project = await project_repo.get_by_name(db, name=project_in.name)
            if existing_project:
                raise AppException("A project with this name already exists.", status_code=400)
            
        updated = await project_repo.update(db, db_obj=project, obj_in=project_in)
        response = ProjectResponse.model_validate(updated)
        
        if tenant_slug:
            payload = json.loads(json.dumps(response.model_dump(), cls=UUIDEncoder, default=str))
            await manager.broadcast(tenant_slug, {"type": "PROJECT_UPDATED", "payload": payload})
            
        return response
        
    @staticmethod
    async def delete_project(db: AsyncSession, current_user: User, project_id: UUID, tenant_slug: Optional[str] = None) -> bool:
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
        
        if tenant_slug:
            await manager.broadcast(tenant_slug, {"type": "PROJECT_DELETED", "payload": {"id": str(project_id)}})
        
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
