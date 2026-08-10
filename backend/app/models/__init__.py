from app.db.base_class import Base
from app.models.public import Company, UserDirectory, CompanyRegistrationAudit
from app.models.tenant import User, UserInvitation, EmailTemplate, Project, ProjectMember, Task

# Expose models for Alembic's target_metadata
__all__ = [
    "Base",
    "Company",
    "UserDirectory",
    "CompanyRegistrationAudit",
    "User",
    "UserInvitation",
    "EmailTemplate",
    "Project",
    "ProjectMember",
    "Task",
]
