import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Date, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
from app.db.mixins import SoftDeleteMixin, TimestampMixin


class User(Base, SoftDeleteMixin, TimestampMixin):
    __tablename__ = "users"
    # No explicit schema; relies on PostgreSQL search_path

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)  # FK enforced at app layer
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="MEMBER")
    is_owner = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="active")
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    projects_created = relationship("Project", back_populates="creator", foreign_keys="Project.created_by")
    tasks_created = relationship("Task", back_populates="creator", foreign_keys="Task.created_by")
    tasks_assigned = relationship("Task", back_populates="assignee", foreign_keys="Task.assigned_to")


class UserInvitation(Base, TimestampMixin):
    __tablename__ = "user_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    email = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    invitation_token = Column(String, unique=True, nullable=False)
    status = Column(String, nullable=False, default="pending")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        Index('ix_user_invitations_email_status', "email", "status"),
    )


class EmailTemplate(Base, TimestampMixin):
    __tablename__ = "email_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_type = Column(String, unique=True, nullable=False)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class Project(Base, SoftDeleteMixin, TimestampMixin):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="active")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    creator = relationship("User", back_populates="projects_created", foreign_keys=[created_by])
    members = relationship("ProjectMember", back_populates="project")
    tasks = relationship("Task", back_populates="project")


class ProjectMember(Base, SoftDeleteMixin):
    __tablename__ = "project_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False, default="contributor")
    added_at = Column(DateTime(timezone=True), default=func.now())

    project = relationship("Project", back_populates="members")
    user = relationship("User")

    __table_args__ = (
        Index('ix_project_members_project_id_user_id', "project_id", "user_id", unique=True),
    )


class Task(Base, SoftDeleteMixin, TimestampMixin):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="todo")
    priority = Column(String, nullable=False, default="medium")
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    due_date = Column(Date, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    project = relationship("Project", back_populates="tasks")
    creator = relationship("User", back_populates="tasks_created", foreign_keys=[created_by])
    assignee = relationship("User", back_populates="tasks_assigned", foreign_keys=[assigned_to])
