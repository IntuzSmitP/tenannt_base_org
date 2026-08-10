from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.user import UserInvitationCreate, UserInvitationResponse
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    List all users in the tenant.
    """
    users = await user_repo.get_multi(db)
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
    return APIResponse(success=True, message="Users retrieved", data=user_list)

from app.repositories.user import user_invitation_repo
from app.schemas.user import UserInvitationResponse

@router.get("/invitations", response_model=APIResponse[list[UserInvitationResponse]])
async def get_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    List all invitations in the tenant.
    """
    invitations = await user_invitation_repo.get_multi(db)
    return APIResponse(success=True, message="Invitations retrieved", data=invitations)

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

@router.post("/accept-invite", response_model=APIResponse[bool])
async def accept_invitation(
    token: str = Body(...),
    password: str = Body(...),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Accept an invitation using token and create password.
    Note: X-Tenant-Slug header is required to resolve tenant db.
    """
    result = await user_service.accept_invitation(db, token, password)
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
