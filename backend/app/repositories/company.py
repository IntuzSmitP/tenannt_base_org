from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.base import BaseRepository
from app.models.public import Company, UserDirectory
from app.schemas.company import CompanyCreate
from typing import Optional

class CompanyRepository(BaseRepository[Company, CompanyCreate, CompanyCreate]):
    async def get_by_slug(self, db: AsyncSession, *, slug: str) -> Optional[Company]:
        stmt = select(Company).where(Company.slug == slug)
        result = await db.execute(stmt)
        return result.scalars().first()
        
    async def get_by_schema(self, db: AsyncSession, *, schema_name: str) -> Optional[Company]:
        stmt = select(Company).where(Company.schema_name == schema_name)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_by_owner_email(self, db: AsyncSession, *, owner_email: str) -> Optional[Company]:
        stmt = select(Company).where(Company.owner_email == owner_email)
        result = await db.execute(stmt)
        return result.scalars().first()

class UserDirectoryRepository(BaseRepository[UserDirectory, dict, dict]):
    async def get_by_email(self, db: AsyncSession, *, email: str) -> Optional[UserDirectory]:
        stmt = select(UserDirectory).where(
            UserDirectory.email == email,
            UserDirectory.deleted_at.is_(None)
        )
        result = await db.execute(stmt)
        return result.scalars().first()

company_repo = CompanyRepository(Company)
user_directory_repo = UserDirectoryRepository(UserDirectory)
