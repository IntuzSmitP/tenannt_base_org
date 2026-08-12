from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.schemas.user import UserInvitationCreate, UserInvitationResponse, AcceptInvitationRequest, MemberProfileResponse
from app.schemas.common import APIResponse
from app.services.user import user_service
from app.dependencies.tenant import get_tenant_db
from app.dependencies.auth import get_current_user, require_role
from app.models.tenant import User
from app.db.session import get_db

from app.repositories.user import user_repo

router = APIRouter()

@router.get("/", response_model=APIResponse[list[dict]])
async def get_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    List all active users in the tenant, optionally filtered by name/email and role.
    """
    skip = (page - 1) * page_size
    users = await user_repo.search(db, q=q, role=role, skip=skip, limit=page_size)
    total = await user_repo.count_search(db, q=q, role=role)
    user_list = [
        {
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "status": u.status
        }
        for u in users
    ]
    return APIResponse(success=True, message="Users retrieved", data=user_list, total=total)

@router.get("/deactivated", response_model=APIResponse[list[dict]])
async def get_deactivated_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    List all deactivated users in the tenant, optionally filtered by name/email and role.
    """
    skip = (page - 1) * page_size
    users = await user_repo.get_deactivated(db, q=q, role=role, skip=skip, limit=page_size)
    total = await user_repo.count_deactivated(db, q=q, role=role)
    user_list = [
        {
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "status": "deactivated"
        }
        for u in users
    ]
    return APIResponse(success=True, message="Deactivated users retrieved", data=user_list, total=total)

from app.repositories.user import user_invitation_repo

@router.get("/invitations", response_model=APIResponse[list[UserInvitationResponse]])
async def get_invitations(
    q: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    List all invitations in the tenant, optionally filtered by name/email and status.
    """
    invitations = await user_invitation_repo.search_latest_invitations(db, q=q, status=status, page=page, page_size=page_size)
    total = await user_invitation_repo.count_invitations(db, q=q, status=status)
    return APIResponse(success=True, message="Invitations retrieved", data=invitations, total=total)

@router.post("/invite", response_model=APIResponse[UserInvitationResponse])
async def invite_user(
    invitation_in: UserInvitationCreate,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Invite a user to the company. Requires ADMIN or OWNER role.
    """
    invitation = await user_service.invite_user(db, current_user, invitation_in)
    return APIResponse(success=True, message="Invitation sent", data=invitation)

@router.post("/invitations/{invitation_id}/resend", response_model=APIResponse[bool])
async def resend_invitation(
    invitation_id: str,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Resend a pending invitation.
    """
    result = await user_service.resend_invitation(db, current_user, invitation_id)
    return APIResponse(success=True, message="Invitation resent successfully", data=result)

@router.post("/invitations/{invitation_id}/cancel", response_model=APIResponse[bool])
async def cancel_invitation(
    invitation_id: str,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Cancel a pending invitation. Requires ADMIN or OWNER role.
    """
    result = await user_service.cancel_invitation(db, invitation_id)
    return APIResponse(success=True, message="Invitation canceled", data=result)

@router.get("/profile", response_model=APIResponse[MemberProfileResponse])
async def get_member_profile(
    email: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Get detailed member profile and chronological history.
    """
    profile = await user_service.get_member_profile(db, email)
    return APIResponse(success=True, message="Profile retrieved", data=profile)

@router.get("/invitations/validate", response_model=APIResponse[bool])
async def validate_invitation(
    token: str,
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Validate an invitation token before accepting.
    """
    result = await user_service.validate_invitation(db, token)
    return APIResponse(success=True, message="Token is valid", data=result)

@router.post("/accept-invite", response_model=APIResponse[bool])
async def accept_invitation(
    req: AcceptInvitationRequest,
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Accept an invitation using token and create password.
    Note: X-Tenant-Slug header is required to resolve tenant db.
    """
    result = await user_service.accept_invitation(db, req.token, req.password)
    return APIResponse(success=True, message="Invitation accepted", data=result)

from pydantic import BaseModel
class RoleUpdate(BaseModel):
    role: str

@router.put("/{user_id}/role", response_model=APIResponse[bool])
async def update_user_role(
    user_id: str,
    role_in: RoleUpdate,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Update a user's role. Requires ADMIN or OWNER.
    """
    result = await user_service.update_user_role(db, current_user, user_id, role_in.role)
    return APIResponse(success=True, message="User role updated", data=result)

@router.delete("/{user_id}", response_model=APIResponse[bool])
async def remove_user(
    user_id: str,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Remove a user from the workspace. Requires ADMIN or OWNER.
    """
    result = await user_service.remove_user(db, current_user, user_id)
    return APIResponse(success=True, message="User removed from workspace", data=result)

@router.get("/{user_id}/impact", response_model=APIResponse[dict])
async def get_user_impact(
    user_id: str,
    current_user: User = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Get the impact of removing a user.
    """
    impact = await user_service.get_user_impact(db, current_user, user_id)
    return APIResponse(success=True, message="User deletion impact retrieved", data=impact)

@router.get("/me", response_model=APIResponse[dict])
async def read_users_me(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user profile.
    """
    return APIResponse(
        success=True, 
        message="User profile retrieved", 
        data={
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "company_id": str(current_user.company_id)
        }
    )
