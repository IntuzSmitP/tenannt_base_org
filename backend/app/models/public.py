import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
from app.db.mixins import SoftDeleteMixin, TimestampMixin


class Company(Base, SoftDeleteMixin, TimestampMixin):
    __tablename__ = "companies"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    owner_email = Column(String, unique=True, nullable=False)
    schema_name = Column(String, unique=True, nullable=False)
    status = Column(String, nullable=False, default="active")


class UserDirectory(Base, SoftDeleteMixin, TimestampMixin):
    __tablename__ = "user_directory"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("public.companies.id"), nullable=False)
    tenant_user_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(String, nullable=False, default="active")

    company = relationship("Company")


class CompanyRegistrationAudit(Base):
    __tablename__ = "company_registrations_audit"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("public.companies.id"))
    event = Column(String, nullable=False)
    metadata_ = Column("metadata", JSONB)
    created_at = Column(DateTime(timezone=True), default=func.now())

    company = relationship("Company")
