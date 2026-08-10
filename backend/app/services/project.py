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
            
        await project_repo.remove(db, id=project_id, deleted_by=current_user.id)
        return True

project_service = ProjectService()
