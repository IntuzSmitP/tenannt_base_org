from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.base import BaseRepository
from app.models.tenant import User, UserInvitation
from typing import Optional

class UserRepository(BaseRepository[User, dict, dict]):
    async def get_by_email(self, db: AsyncSession, *, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email).where(User.deleted_at.is_(None))
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_by_email_include_deleted(self, db: AsyncSession, *, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        return result.scalars().first()

class UserInvitationRepository(BaseRepository[UserInvitation, dict, dict]):
    async def get_by_token(self, db: AsyncSession, *, token: str) -> Optional[UserInvitation]:
        stmt = select(UserInvitation).where(UserInvitation.invitation_token == token)
        result = await db.execute(stmt)
        return result.scalars().first()
        
    async def get_by_email(self, db: AsyncSession, *, email: str) -> Optional[UserInvitation]:
        stmt = select(UserInvitation).where(UserInvitation.email == email, UserInvitation.status == 'pending')
        result = await db.execute(stmt)
        return result.scalars().first()

user_repo = UserRepository(User)
user_invitation_repo = UserInvitationRepository(UserInvitation)
