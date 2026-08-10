from fastapi import Header, HTTPException, status
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
from app.repositories.company import company_repo

async def get_tenant_db(x_tenant_slug: str = Header(..., alias="X-Tenant-Slug")) -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that resolves the tenant based on the X-Tenant-Slug header,
    creates a session, and sets the PostgreSQL search_path for that session.
    """
    async with AsyncSessionLocal() as session:
        company = await company_repo.get_by_slug(session, slug=x_tenant_slug)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
        # Set search_path for the session
        schema_name = company.schema_name
        await session.execute(text(f'SET search_path TO "{schema_name}", public'))
        
        # Store company info in the session info (useful if needed later)
        session.info['company_id'] = company.id
        session.info['schema_name'] = schema_name
        
        yield session
