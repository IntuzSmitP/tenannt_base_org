from fastapi import Header, HTTPException, status
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import AsyncSessionLocal, engine
from app.repositories.company import company_repo

async def get_tenant_db(x_tenant_slug: str = Header(..., alias="X-Tenant-Slug")) -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that resolves the tenant based on the X-Tenant-Slug header,
    creates a session bound to a specific connection, and sets the PostgreSQL search_path.
    """
    # First, lookup the company using a normal pooled session
    async with AsyncSessionLocal() as public_session:
        company = await company_repo.get_by_slug(public_session, slug=x_tenant_slug)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        schema_name = company.schema_name

    # Now, acquire a dedicated connection and bind a new session to it.
    # This prevents SQLAlchemy from returning the connection to the pool on commit,
    # which would otherwise lose the search_path for subsequent queries in the same request.
    #
    # IMPORTANT: engine.connect() wraps the connection in a CONNECTABLE transaction.
    # If we don't explicitly call conn.commit(), the transaction is rolled back on exit,
    # which silently undoes any session.commit() calls made during the request.
    async with engine.connect() as conn:
        await conn.execute(text(f'SET search_path TO "{schema_name}", public'))
        
        async with AsyncSession(conn, expire_on_commit=False) as session:
            session.info['company_id'] = company.id
            session.info['schema_name'] = schema_name
            yield session
        
        # Commit the connection-level transaction to persist all session commits.
        # Without this, engine.connect().__aexit__ rolls back, losing all data!
        await conn.commit()
            
        # Reset search_path before returning the connection to the pool
        await conn.execute(text('SET search_path TO public'))
