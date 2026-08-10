import uuid
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.schemas.company import CompanyCreate, CompanyResponse
from app.models.public import Company, UserDirectory, CompanyRegistrationAudit
from app.models.tenant import User
from app.core.security import get_password_hash
from app.tenants.provision import create_tenant_schema
from app.core.exceptions import AppException
from app.repositories.company import company_repo, user_directory_repo
from app.db.session import AsyncSessionLocal

class CompanyService:
    @staticmethod
    async def register_company(db: AsyncSession, company_in: CompanyCreate) -> CompanyResponse:
        slug = re.sub(r'[^a-z0-9]', '', company_in.company_name.lower())
        if not slug:
            slug = f"company{uuid.uuid4().hex[:8]}"
            
        existing_company = await company_repo.get_by_slug(db, slug=slug)
        if existing_company:
            slug = f"{slug}{uuid.uuid4().hex[:4]}"
            
        schema_name = f"tenant_{slug}"
        
        # Check if email is already in companies
        existing_company_email = await company_repo.get_by_owner_email(db, owner_email=company_in.owner_email)
        if existing_company_email:
            raise AppException("A company with this owner email is already registered.")
            
        # Check if email is already in user directory
        existing_user = await user_directory_repo.get_by_email(db, email=company_in.owner_email)
        if existing_user:
            raise AppException("Email already registered.")
            
        # 1. Create company in public schema
        company_data = {
            "name": company_in.company_name,
            "slug": slug,
            "owner_email": company_in.owner_email,
            "schema_name": schema_name,
            "status": "active"
        }
        company = await company_repo.create(db, obj_in=company_data)
        
        # 2. Audit log
        audit = CompanyRegistrationAudit(
            company_id=company.id,
            event="registered",
            metadata_={"email": company_in.owner_email}
        )
        db.add(audit)
        await db.commit()
        
        # 3. Create Tenant Schema and Tables
        await create_tenant_schema(schema_name)
        
        # 4. Insert Owner in Tenant Schema
        tenant_user_id = uuid.uuid4()
        async with AsyncSessionLocal() as tenant_db:
            await tenant_db.execute(text(f'SET search_path TO "{schema_name}", public'))
            
            owner_user = User(
                id=tenant_user_id,
                company_id=company.id,
                name=company_in.owner_name,
                email=company_in.owner_email,
                password_hash=get_password_hash(company_in.owner_password),
                role="OWNER",
                is_owner=True,
                status="active"
            )
            tenant_db.add(owner_user)
            await tenant_db.commit()
            
        # 5. Insert UserDirectory in Public Schema
        user_dir_data = {
            "email": company_in.owner_email,
            "company_id": company.id,
            "tenant_user_id": tenant_user_id,
            "status": "active"
        }
        await user_directory_repo.create(db, obj_in=user_dir_data)
        
        audit_provision = CompanyRegistrationAudit(
            company_id=company.id,
            event="schema_provisioned"
        )
        db.add(audit_provision)
        await db.commit()
        
        return CompanyResponse.model_validate(company)

company_service = CompanyService()
