import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.user import UserInvitationCreate, UserInvitationResponse, MemberProfileResponse, TimelineEvent
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
    async def _send_invitation_email(invitation: UserInvitation, current_user: User, token: str, slug: str, db: AsyncSession):
        from app.repositories.company import company_repo
        company = await company_repo.get(db, id=current_user.company_id)
        company_name = company.name if company else slug
        
        invite_link = f"{settings.FRONTEND_URL}/accept-invite?token={token}&slug={slug}"
        
        body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Inter', sans-serif; background: #f3f4f6; color: #1f2937; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 40px 20px; text-align: center; color: #fff; }}
                .content {{ padding: 40px 30px; line-height: 1.6; }}
                .button-container {{ text-align: center; margin: 40px 0; }}
                .button {{ background: #4f46e5; color: #fff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; }}
                .footer {{ background: #f9fafb; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header"><h1>Welcome to {company_name}</h1></div>
                <div class="content">
                    <p>Hi <strong>{invitation.name}</strong>,</p>
                    <p>You have been invited by <strong>{current_user.name}</strong> to join the <strong>{company_name}</strong> workspace.</p>
                    <div class="button-container"><a href="{invite_link}" class="button">Accept Invitation</a></div>
                    <p style="font-size: 14px;">If the button above doesn't work, copy and paste the following link into your web browser:</p>
                    <p style="word-break: break-all; font-size: 14px; color: #6b7280; background: #f3f4f6; padding: 12px; border-radius: 6px;">{invite_link}</p>
                </div>
                <div class="footer">&copy; {datetime.now().year} {company_name}. All rights reserved.<br>This is an automated message, please do not reply.</div>
            </div>
        </body>
        </html>
        """
        email_sent = await send_email(invitation.email, f"You are invited to join {company_name}!", body)
        if not email_sent:
            raise AppException("Failed to send invitation email.")

    @staticmethod
    async def invite_user(db: AsyncSession, current_user: User, invitation_in: UserInvitationCreate) -> UserInvitationResponse:
        # Check if user already exists
        existing_user = await user_repo.get_by_email(db, email=invitation_in.email)
        if existing_user:
            raise AppException("User already exists in this company.")
            
        # Check if pending invitation exists
        pending_invitation = await user_invitation_repo.get_pending_by_email(db, email=invitation_in.email)
        if pending_invitation:
            raise AppException("An invitation has already been sent to this email.")
            
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
        
        schema_name = db.info.get("schema_name", "")
        slug = schema_name.replace("tenant_", "") if schema_name.startswith("tenant_") else ""
        
        await UserService._send_invitation_email(invitation, current_user, token, slug, db)
        
        return UserInvitationResponse.model_validate(invitation)

    @staticmethod
    async def resend_invitation(db: AsyncSession, current_user: User, invitation_id: str) -> bool:
        invitation = await user_invitation_repo.get(db, id=invitation_id)
        if not invitation:
            raise AppException("Invitation not found.")
            
        if invitation.status == "accepted":
            raise AppException("Cannot resend an accepted invitation.")
            
        # Expire the old invitation
        invitation.status = "expired"
        
        # Create a new invitation record
        token = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        new_invitation_data = {
            "company_id": invitation.company_id,
            "email": invitation.email,
            "name": invitation.name,
            "role": invitation.role,
            "invitation_token": token,
            "expires_at": expires_at,
            "invited_by": current_user.id
        }
        
        # update the old invitation status
        db.add(invitation)
        # Use repo.create to handle tenant schema search_path correctly
        new_invitation = await user_invitation_repo.create(db, obj_in=new_invitation_data)
        
        schema_name = db.info.get("schema_name", "")
        slug = schema_name.replace("tenant_", "") if schema_name.startswith("tenant_") else ""
        
        await UserService._send_invitation_email(new_invitation, current_user, token, slug, db)
        return True

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
    async def validate_invitation(db: AsyncSession, token: str) -> bool:
        invitation = await user_invitation_repo.get_by_token(db, token=token)
        if not invitation:
            raise AppException("Invalid invitation token.", status_code=404)
            
        if invitation.expires_at < datetime.now(timezone.utc) or invitation.status == "expired":
            raise AppException("This invitation link has expired.")
            
        if invitation.status == "canceled":
            raise AppException("This invitation has been canceled by the administrator.")
            
        if invitation.status != "pending":
            raise AppException("Invitation already processed.")
            
        return True

    @staticmethod
    async def accept_invitation(db: AsyncSession, token: str, password: str) -> bool:
        # First validate the token
        await UserService.validate_invitation(db, token)
        
        invitation = await user_invitation_repo.get_by_token(db, token=token)
            
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
    async def get_member_profile(db: AsyncSession, email: str) -> MemberProfileResponse:
        user = await user_repo.get_by_email_include_deleted(db, email=email)
        invitations = await user_invitation_repo.get_all_by_email(db, email=email)
        
        if not user and not invitations:
            raise AppException("Profile not found for this email", status_code=404)
            
        timeline = []
        
        for inv in invitations:
            inviter = await user_repo.get(db, id=inv.invited_by)
            inviter_name = inviter.name if inviter else "an Administrator"
            
            timeline.append(TimelineEvent(
                event_type="invited",
                date=inv.created_at,
                description=f"Invited to workspace by {inviter_name} (as {inv.name})",
                status=inv.status
            ))
            
        timeline.sort(key=lambda x: x.date, reverse=True)
        
        latest_inv = invitations[0] if invitations else None
        
        if user:
            if user.deleted_at and latest_inv and latest_inv.created_at > user.deleted_at:
                name = latest_inv.name
                role = latest_inv.role
                current_status = latest_inv.status
            else:
                name = user.name
                role = user.role
                current_status = "deactivated" if user.deleted_at else user.status
        else:
            name = latest_inv.name if latest_inv else "Unknown"
            role = latest_inv.role if latest_inv else "MEMBER"
            current_status = latest_inv.status if latest_inv else "unknown"
        
        return MemberProfileResponse(
            name=name,
            email=email,
            current_status=current_status,
            role=role,
            timeline=timeline
        )

    @staticmethod
    async def update_user_role(db: AsyncSession, current_user: User, user_id: str, new_role: str) -> bool:
        if str(current_user.id) == str(user_id):
            raise AppException("Cannot change your own role.", status_code=400)
            
        user = await user_repo.get(db, id=user_id)
        if not user:
            raise AppException("User not found", status_code=404)
        if user.is_owner:
            raise AppException("Cannot change the role of the workspace owner.", status_code=400)
            
        if current_user.role != "OWNER" and user.role == "ADMIN" and new_role != "ADMIN":
            raise AppException("Only the workspace owner can demote an admin.", status_code=403)
        
        user.role = new_role
        await db.commit()
        return True

    @staticmethod
    async def remove_user(db: AsyncSession, current_user: User, user_id: str) -> bool:
        if str(current_user.id) == str(user_id):
            raise AppException("You cannot remove yourself from the workspace.", status_code=400)
            
        user = await user_repo.get(db, id=user_id)
        if not user:
            raise AppException("User not found", status_code=404)
        if user.is_owner:
            raise AppException("Cannot remove the workspace owner.", status_code=400)
            
        if current_user.role != "OWNER" and user.role == "ADMIN":
            raise AppException("Only the workspace owner can remove another admin.", status_code=403)
            
        # Clean up associations
        from sqlalchemy import update
        from app.models.tenant import Task, ProjectMember
        import uuid
        
        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        
        # Unassign tasks
        await db.execute(
            update(Task)
            .where(Task.assigned_to == user_uuid)
            .values(assigned_to=None)
        )
        
        # Soft-delete project memberships
        await db.execute(
            update(ProjectMember)
            .where(ProjectMember.user_id == user_uuid)
            .where(ProjectMember.deleted_at.is_(None))
            .values(deleted_at=datetime.now(timezone.utc))
        )
            
        await user_repo.remove(db, id=user_id, deleted_by=current_user.id)
        # We also should deactivate them in user_directory
        dir_entry = await user_directory_repo.get_by_email(db, email=user.email)
        if dir_entry:
            dir_entry.status = "inactive"
            
        await db.commit()
            
        return True

    @staticmethod
    async def get_user_impact(db: AsyncSession, current_user: User, user_id: str) -> dict:
        from app.models.tenant import Task, ProjectMember
        from sqlalchemy import select, func
        import uuid
        
        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        
        # Check user exists
        user = await user_repo.get(db, id=user_uuid)
        if not user:
            raise AppException("User not found", status_code=404)
            
        assigned_tasks_count = await db.scalar(
            select(func.count()).select_from(Task).where(Task.assigned_to == user_uuid, Task.deleted_at.is_(None))
        )
        
        project_memberships_count = await db.scalar(
            select(func.count()).select_from(ProjectMember).where(ProjectMember.user_id == user_uuid, ProjectMember.deleted_at.is_(None))
        )
        
        return {
            "assigned_tasks_count": assigned_tasks_count or 0,
            "project_memberships_count": project_memberships_count or 0
        }
            
        # Clean up associations
        from sqlalchemy import update
        from app.models.tenant import Task, ProjectMember
        import uuid
        
        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        
        # Unassign tasks
        await db.execute(
            update(Task)
            .where(Task.assigned_to == user_uuid)
            .values(assigned_to=None)
        )
        
        # Soft-delete project memberships
        await db.execute(
            update(ProjectMember)
            .where(ProjectMember.user_id == user_uuid)
            .where(ProjectMember.deleted_at.is_(None))
            .values(deleted_at=datetime.now(timezone.utc))
        )
            
        await user_repo.remove(db, id=user_id, deleted_by=current_user.id)
        # We also should deactivate them in user_directory
        dir_entry = await user_directory_repo.get_by_email(db, email=user.email)
        if dir_entry:
            dir_entry.status = "inactive"
            
        await db.commit()
            
        return True

user_service = UserService()
