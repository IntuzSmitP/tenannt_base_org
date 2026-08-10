from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.auth import LoginRequest, Token
from app.schemas.common import APIResponse
from app.services.auth import auth_service
from app.db.session import get_db

router = APIRouter()

@router.post("/login", response_model=APIResponse[Token])
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Login user across any tenant using their global email.
    """
    token = await auth_service.login(db, login_data)
    return APIResponse(success=True, message="Login successful", data=token)
