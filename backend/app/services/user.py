import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.user import UserInvitationCreate, UserInvitationResponse
from app.models.tenant import UserInvitation, User
from app.core.exceptions import AppException
from app.repositories.user import user_repo, user_invitation_repo
from app.repositories.company import user_directory_repo
from app.db.session import AsyncSessionLocal
from app.core.security import get_password_hash
from app.emails.sender import send_email, replace_template
from app.core.config import settings

class UserService:
    @staticmethod
    async def invite_user(db: AsyncSession, current_user: User, invitation_in: UserInvitationCreate) -> UserInvitationResponse:
        # Check if user already exists
        existing_user = await user_repo.get_by_email(db, email=invitation_in.email)
        if existing_user:
            raise AppException("User already exists in this company.")
            
        # Create invitation token
        token = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        invitation_data = {
            "company_id": current_user.company_id,
            "email": invitation_in.email,
            "name": invitation_in.name,
            "role": invitation_in.role.value,
            "invitation_token": token,
            "expires_at": expires_at,
            "invited_by": current_user.id
        }
        
        invitation = await user_invitation_repo.create(db, obj_in=invitation_data)
        
        # Extract slug from the session's schema name
        schema_name = db.info.get("schema_name", "")
        slug = schema_name.replace("tenant_", "") if schema_name.startswith("tenant_") else ""
        
        # Send email (In real app, we would load template from EmailTemplate table)
        invite_link = f"{settings.FRONTEND_URL}/accept-invite?token={token}&slug={slug}"
        body = f"<p>Hello {invitation.name}, you have been invited to join the workspace '{slug}'.</p><p><a href='{invite_link}'>Click here to accept the invitation</a></p>"
        email_sent = await send_email(invitation.email, f"You are invited to {slug}!", body)
        if not email_sent:
            raise AppException("Failed to send invitation email.")
        
        return UserInvitationResponse.model_validate(invitation)

    @staticmethod
    async def cancel_invitation(db: AsyncSession, invitation_id: str) -> bool:
        invitation = await user_invitation_repo.get(db, id=invitation_id)
        if not invitation:
            raise AppException("Invitation not found.")
            
        if invitation.status != "pending":
            raise AppException(f"Cannot cancel a {invitation.status} invitation.")
            
        invitation.status = "canceled"
        await db.commit()
        return True

    @staticmethod
    async def accept_invitation(db: AsyncSession, token: str, password: str) -> bool:
        invitation = await user_invitation_repo.get_by_token(db, token=token)
        if not invitation:
            raise AppException("Invalid invitation token.")
            
        if invitation.status != "pending":
            raise AppException("Invitation already processed.")
            
        if invitation.expires_at < datetime.now(timezone.utc):
            raise AppException("Invitation expired.")
            
        # Check if user already exists (even if soft-deleted)
        existing_user = await user_repo.get_by_email_include_deleted(db, email=invitation.email)
        
        if existing_user:
            # Reactivate soft-deleted user
            existing_user.deleted_at = None
            existing_user.deleted_by = None
            existing_user.password_hash = get_password_hash(password)
            existing_user.name = invitation.name
            existing_user.role = invitation.role
            existing_user.status = "active"
            existing_user.invited_by = invitation.invited_by
            tenant_user_id = existing_user.id
            user = existing_user
        else:
            # Create User in tenant
            tenant_user_id = uuid.uuid4()
            user_data = {
                "id": tenant_user_id,
                "company_id": invitation.company_id,
                "name": invitation.name,
                "email": invitation.email,
                "password_hash": get_password_hash(password),
                "role": invitation.role,
                "status": "active",
                "invited_by": invitation.invited_by
            }
            user = await user_repo.create(db, obj_in=user_data)
        
        # Update invitation
        invitation.status = "accepted"
        invitation.accepted_at = datetime.now(timezone.utc)
        await db.commit()
        
        # Handle UserDirectory in public schema using the same DB session
        dir_entry = await user_directory_repo.get_by_email(db, email=invitation.email)
        if dir_entry:
            dir_entry.deleted_at = None
            dir_entry.deleted_by = None
            dir_entry.status = "active"
            dir_entry.company_id = invitation.company_id
            dir_entry.tenant_user_id = tenant_user_id
            await db.commit()
        else:
            dir_data = {
                "email": invitation.email,
                "company_id": invitation.company_id,
                "tenant_user_id": tenant_user_id,
                "status": "active"
            }
            await user_directory_repo.create(db, obj_in=dir_data)
        
        # Auto-expire all other pending invitations for this email in this tenant
        from sqlalchemy import update
        await db.execute(
            update(UserInvitation)
            .where(
                UserInvitation.email == invitation.email, 
                UserInvitation.status == 'pending',
                UserInvitation.id != invitation.id
            )
            .values(status='expired')
        )
        await db.commit()
        
        return True

    @staticmethod
    async def update_user_role(db: AsyncSession, current_user: User, user_id: str, new_role: str) -> bool:
        user = await user_repo.get(db, id=user_id)
        if not user:
            raise AppException("User not found", status_code=404)
        if user.is_owner:
            raise AppException("Cannot change the role of the workspace owner.", status_code=400)
        
        user.role = new_role
        await db.commit()
        return True

    @staticmethod
    async def remove_user(db: AsyncSession, current_user: User, user_id: str) -> bool:
        user = await user_repo.get(db, id=user_id)
        if not user:
            raise AppException("User not found", status_code=404)
        if user.is_owner:
            raise AppException("Cannot remove the workspace owner.", status_code=400)
            
        await user_repo.remove(db, id=user_id, deleted_by=current_user.id)
        # We also should deactivate them in user_directory
        dir_entry = await user_directory_repo.get_by_email(db, email=user.email)
        if dir_entry:
            dir_entry.status = "inactive"
            await db.commit()
            
        return True

user_service = UserService()
