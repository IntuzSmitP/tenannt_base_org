from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
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

    async def search(self, db: AsyncSession, *, q: Optional[str] = None) -> list[User]:
        stmt = select(User).where(User.deleted_at.is_(None))
        if q:
            search_filter = or_(
                User.name.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%")
            )
            stmt = stmt.where(search_filter)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_deactivated(self, db: AsyncSession, *, q: Optional[str] = None) -> list[User]:
        stmt = select(User).where(User.deleted_at.is_not(None))
        if q:
            search_filter = or_(
                User.name.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%")
            )
            stmt = stmt.where(search_filter)
        result = await db.execute(stmt)
        return result.scalars().all()

class UserInvitationRepository(BaseRepository[UserInvitation, dict, dict]):
    async def get_by_token(self, db: AsyncSession, *, token: str) -> Optional[UserInvitation]:
        stmt = select(UserInvitation).where(UserInvitation.invitation_token == token)
        result = await db.execute(stmt)
        return result.scalars().first()
        
    async def get_by_email(self, db: AsyncSession, *, email: str) -> Optional[UserInvitation]:
        stmt = select(UserInvitation).where(UserInvitation.email == email, UserInvitation.status == 'pending')
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_pending_by_email(self, db: AsyncSession, *, email: str) -> Optional[UserInvitation]:
        stmt = select(UserInvitation).where(UserInvitation.email == email, UserInvitation.status == 'pending')
        result = await db.execute(stmt)
        return result.scalars().first()

    async def search(self, db: AsyncSession, *, q: Optional[str] = None) -> list[UserInvitation]:
        stmt = select(UserInvitation)
        if q:
            search_filter = or_(
                UserInvitation.name.ilike(f"%{q}%"),
                UserInvitation.email.ilike(f"%{q}%")
            )
            stmt = stmt.where(search_filter)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def search_latest_invitations(self, db: AsyncSession, *, q: Optional[str] = None) -> list[UserInvitation]:
        stmt = select(UserInvitation)
        if q:
            search_filter = or_(
                UserInvitation.name.ilike(f"%{q}%"),
                UserInvitation.email.ilike(f"%{q}%")
            )
            stmt = stmt.where(search_filter)
        stmt = stmt.distinct(UserInvitation.email).order_by(UserInvitation.email, UserInvitation.created_at.desc())
        result = await db.execute(stmt)
        invitations = result.scalars().all()
        
        if not invitations:
            return []
            
        # Find deactivated users to exclude their accepted invitations
        accepted_emails = [inv.email for inv in invitations if inv.status == 'accepted']
        deactivated_emails = set()
        
        if accepted_emails:
            user_stmt = select(User.email).where(User.email.in_(accepted_emails), User.deleted_at.is_not(None))
            user_result = await db.execute(user_stmt)
            deactivated_emails = set(user_result.scalars().all())
            
        return [
            inv for inv in invitations 
            if not (inv.status == 'accepted' and inv.email in deactivated_emails)
        ]

    async def get_all_by_email(self, db: AsyncSession, *, email: str) -> list[UserInvitation]:
        stmt = select(UserInvitation).where(UserInvitation.email == email).order_by(UserInvitation.created_at.desc())
        result = await db.execute(stmt)
        return result.scalars().all()

user_repo = UserRepository(User)
user_invitation_repo = UserInvitationRepository(UserInvitation)
