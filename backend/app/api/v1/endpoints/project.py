from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.common import APIResponse
from app.services.project import project_service
from app.dependencies.tenant import get_tenant_db
from app.dependencies.auth import get_current_user, require_role
from app.models.tenant import User

router = APIRouter()

@router.post("/", response_model=APIResponse[ProjectResponse])
async def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    project = await project_service.create_project(db, current_user, project_in)
    return APIResponse(success=True, message="Project created", data=project)

@router.get("/", response_model=APIResponse[List[ProjectResponse]])
async def get_projects(
    page: int = 1,
    page_size: int = 9,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    skip = (page - 1) * page_size
    projects, total = await project_service.get_projects(db, current_user, skip, page_size)
    return APIResponse(success=True, message="Projects retrieved", data=projects, total=total)

@router.get("/{project_id}", response_model=APIResponse[ProjectResponse])
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    # project_service.update_project verifies existence, but we just want get
    from app.repositories.project import project_repo
    project = await project_repo.get(db, id=project_id)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    return APIResponse(success=True, message="Project retrieved", data=project)

@router.put("/{project_id}", response_model=APIResponse[ProjectResponse])
async def update_project(
    request: Request,
    project_id: UUID,
    project_in: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    tenant_slug = request.headers.get("X-Tenant-Slug")
    project = await project_service.update_project(db, current_user, project_id, project_in, tenant_slug)
    return APIResponse(success=True, message="Project updated", data=project)

@router.delete("/{project_id}", response_model=APIResponse[bool])
async def delete_project(
    request: Request,
    project_id: UUID,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    tenant_slug = request.headers.get("X-Tenant-Slug")
    result = await project_service.delete_project(db, current_user, project_id, tenant_slug)
    return APIResponse(success=True, message="Project deleted", data=result)

@router.get("/{project_id}/impact", response_model=APIResponse[dict])
async def get_project_impact(
    project_id: UUID,
    current_user: User = Depends(require_role(["ADMIN", "OWNER"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    impact = await project_service.get_project_impact(db, current_user, project_id)
    return APIResponse(success=True, message="Project deletion impact retrieved", data=impact)
