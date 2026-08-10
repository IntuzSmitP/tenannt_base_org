from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.schemas.auth import LoginRequest, Token
from app.repositories.company import user_directory_repo
from app.repositories.user import user_repo
from app.core.security import verify_password, create_access_token, create_refresh_token
from app.core.exceptions import AppException
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

class AuthService:
    @staticmethod
    async def login(db: AsyncSession, login_data: LoginRequest) -> Token:
        # 1. Find user in global user directory
        directory_entry = await user_directory_repo.get_by_email(db, email=login_data.email)
        if not directory_entry:
            raise AppException("Invalid email or password", status_code=401)
            
        if directory_entry.status != "active":
            raise AppException("Account is inactive", status_code=403)
            
        # 2. Get company to find the schema
        await db.refresh(directory_entry, ["company"])
        company = directory_entry.company
        
        # 3. Verify password in tenant schema
        async with AsyncSessionLocal() as tenant_db:
            await tenant_db.execute(text(f'SET search_path TO "{company.schema_name}", public'))
            user = await user_repo.get_by_email(tenant_db, email=login_data.email)
            
            if not user or not verify_password(login_data.password, user.password_hash):
                raise AppException("Invalid email or password", status_code=401)
                
            # Create tokens
            access_token = create_access_token(subject=user.id)
            refresh_token = create_refresh_token(subject=user.id)
            
            return Token(access_token=access_token, refresh_token=refresh_token, tenant_slug=company.slug)

auth_service = AuthService()
