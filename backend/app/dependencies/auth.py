from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Callable, Any
from app.core.config import settings
from app.core.security import decode_token
from app.models.tenant import User
from app.repositories.user import user_repo
from app.dependencies.tenant import get_tenant_db
import jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_tenant_db)
) -> User:
    try:
        token = credentials.credentials
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await user_repo.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Inactive user")
        
    return user

def require_role(allowed_roles: list[str]) -> Callable:
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles and current_user.role != "OWNER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker
