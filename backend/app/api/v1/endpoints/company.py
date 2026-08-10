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
