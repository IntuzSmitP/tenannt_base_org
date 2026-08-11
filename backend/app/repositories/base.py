from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func
from pydantic import BaseModel

from app.db.base_class import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        stmt = select(self.model).where(self.model.id == id)
        
        # Soft delete filtering if applicable
        if hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
            
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        stmt = select(self.model).offset(skip).limit(limit)
        
        if hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
            
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType | Dict[str, Any]) -> ModelType:
        from sqlalchemy import text
        obj_in_data = obj_in.model_dump() if isinstance(obj_in, BaseModel) else obj_in
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        
        # When commit() finishes, the transaction ends and the connection is returned to the pool.
        # The next query (refresh) gets a fresh connection with the default search_path.
        # We must restore it if we are in a tenant context.
        schema_name = db.info.get("schema_name")
        if schema_name:
            await db.execute(text(f'SET search_path TO "{schema_name}", public'))
            
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: ModelType, obj_in: UpdateSchemaType | Dict[str, Any]
    ) -> ModelType:
        from sqlalchemy import text
        obj_data = {c.name: getattr(db_obj, c.name) for c in db_obj.__table__.columns}
        update_data = obj_in.model_dump(exclude_unset=True) if isinstance(obj_in, BaseModel) else obj_in
        
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
                
        db.add(db_obj)
        await db.commit()
        
        schema_name = db.info.get("schema_name")
        if schema_name:
            await db.execute(text(f'SET search_path TO "{schema_name}", public'))
            
        await db.refresh(db_obj)
        return db_obj

    async def remove(self, db: AsyncSession, *, id: UUID, deleted_by: Optional[UUID] = None) -> Optional[ModelType]:
        obj = await self.get(db, id)
        if obj:
            if hasattr(obj, "deleted_at"):
                # Soft delete
                from datetime import datetime, timezone
                obj.deleted_at = datetime.now(timezone.utc)
                if hasattr(obj, "deleted_by") and deleted_by:
                    obj.deleted_by = deleted_by
                db.add(obj)
            else:
                # Hard delete
                await db.delete(obj)
            await db.commit()
        return obj
