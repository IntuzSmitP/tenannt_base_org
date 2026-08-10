from sqlalchemy import Column, DateTime, func, String
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone

class SoftDeleteMixin:
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), nullable=True)
    
class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
