from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.company import CompanyCreate, CompanyResponse
from app.schemas.common import APIResponse
from app.services.company import company_service
from app.db.session import get_db

router = APIRouter()

@router.post("/register", response_model=APIResponse[CompanyResponse])
async def register_company(
    company_in: CompanyCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new company and provision their tenant schema.
    """
    company = await company_service.register_company(db, company_in)
    return APIResponse(success=True, message="Company registered successfully", data=company)

from app.models.tenant import User
from app.dependencies.auth import require_role, get_current_user
from app.dependencies.tenant import get_tenant_db
from app.schemas.company import CompanyDeleteRequest, CompanyImpactResponse

@router.get("/impact", response_model=APIResponse[CompanyImpactResponse])
async def get_company_impact(
    current_user: User = Depends(require_role(["OWNER"])),
    tenant_db: AsyncSession = Depends(get_tenant_db)
):
    """
    Get the impact of deleting the organization.
    """
    impact = await company_service.get_company_impact(tenant_db, current_user)
    return APIResponse(success=True, message="Organization deletion impact retrieved", data=impact)

from app.repositories.company import company_repo
from app.core.exceptions import AppException

@router.get("/info", response_model=APIResponse[CompanyResponse])
async def get_company_info(
    current_user: User = Depends(get_current_user),
    public_db: AsyncSession = Depends(get_db)
):
    """
    Get the current company information.
    """
    company = await company_repo.get(public_db, id=current_user.company_id)
    if not company:
        raise AppException("Company not found", status_code=404)
    return APIResponse(success=True, message="Company info retrieved", data=company)

@router.delete("/", response_model=APIResponse[bool])
async def delete_organization(
    delete_request: CompanyDeleteRequest,
    current_user: User = Depends(require_role(["OWNER"])),
    public_db: AsyncSession = Depends(get_db)
):
    """
    Delete the entire organization.
    """
    result = await company_service.delete_company(public_db, current_user, delete_request.password, delete_request.email)
    return APIResponse(success=True, message="Organization deleted successfully", data=result)
