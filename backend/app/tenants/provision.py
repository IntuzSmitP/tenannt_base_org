import logging
from sqlalchemy import text
from app.db.session import engine
from app.models.tenant import Base

logger = logging.getLogger(__name__)

async def create_tenant_schema(schema_name: str) -> None:
    """Creates a new PostgreSQL schema for a tenant and initializes its tables."""
    async with engine.begin() as conn:
        # Create schema if it doesn't exist
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
        logger.info(f"Schema {schema_name} created successfully.")
        
        # We need to set the search_path so the tables are created in the right schema
        await conn.execute(text(f'SET search_path TO "{schema_name}", public'))
        
        # Run table creation for all Base.metadata.
        # Note: Since public models have __table_args__ = {'schema': 'public'}, 
        # they will be ignored or safely created/verified in public.
        # The tenant models without explicit schema will be created in `schema_name`.
        await conn.run_sync(Base.metadata.create_all)
        logger.info(f"Tables provisioned in schema {schema_name}.")

async def drop_tenant_schema(schema_name: str) -> None:
    """Drops a tenant schema. USE WITH CAUTION."""
    async with engine.begin() as conn:
        await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        logger.warning(f"Schema {schema_name} dropped.")
