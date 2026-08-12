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

    async def search(self, db: AsyncSession, *, q: Optional[str] = None, role: Optional[str] = None, skip: int = 0, limit: int = 10) -> list[User]:
        stmt = select(User).where(User.deleted_at.is_(None))
        if q:
            search_filter = or_(
                User.name.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%")
            )
            stmt = stmt.where(search_filter)
        if role and role != "ALL":
            stmt = stmt.where(User.role == role)
        stmt = stmt.offset(skip).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def count_search(self, db: AsyncSession, *, q: Optional[str] = None, role: Optional[str] = None) -> int:
        from sqlalchemy import func as sqlfunc
        stmt = select(sqlfunc.count()).select_from(User).where(User.deleted_at.is_(None))
        if q:
            search_filter = or_(User.name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%"))
            stmt = stmt.where(search_filter)
        if role and role != "ALL":
            stmt = stmt.where(User.role == role)
        result = await db.execute(stmt)
        return result.scalar() or 0

    async def get_deactivated(self, db: AsyncSession, *, q: Optional[str] = None, role: Optional[str] = None, skip: int = 0, limit: int = 10) -> list[User]:
        stmt = select(User).where(User.deleted_at.is_not(None))
        if q:
            search_filter = or_(
                User.name.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%")
            )
            stmt = stmt.where(search_filter)
        if role and role != "ALL":
            stmt = stmt.where(User.role == role)
        stmt = stmt.offset(skip).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def count_deactivated(self, db: AsyncSession, *, q: Optional[str] = None, role: Optional[str] = None) -> int:
        from sqlalchemy import func as sqlfunc
        stmt = select(sqlfunc.count()).select_from(User).where(User.deleted_at.is_not(None))
        if q:
            search_filter = or_(User.name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%"))
            stmt = stmt.where(search_filter)
        if role and role != "ALL":
            stmt = stmt.where(User.role == role)
        result = await db.execute(stmt)
        return result.scalar() or 0

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

    async def search_latest_invitations(self, db: AsyncSession, *, q: Optional[str] = None, status: Optional[str] = None, page: int = 1, page_size: int = 10) -> list[UserInvitation]:
        from sqlalchemy import func as sqlfunc
        stmt = select(UserInvitation)
        if q:
            search_filter = or_(
                UserInvitation.name.ilike(f"%{q}%"),
                UserInvitation.email.ilike(f"%{q}%")
            )
            stmt = stmt.where(search_filter)
        if status and status != "ALL":
            stmt = stmt.where(UserInvitation.status == status)
        skip = (page - 1) * page_size
        stmt = stmt.distinct(UserInvitation.email).order_by(UserInvitation.email, UserInvitation.created_at.desc()).offset(skip).limit(page_size)
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

    async def count_invitations(self, db: AsyncSession, *, q: Optional[str] = None, status: Optional[str] = None) -> int:
        from sqlalchemy import func as sqlfunc
        stmt = select(sqlfunc.count(UserInvitation.email.distinct()))
        if q:
            search_filter = or_(UserInvitation.name.ilike(f"%{q}%"), UserInvitation.email.ilike(f"%{q}%"))
            stmt = stmt.where(search_filter)
        if status and status != "ALL":
            stmt = stmt.where(UserInvitation.status == status)
        result = await db.execute(stmt)
        return result.scalar() or 0

    async def get_all_by_email(self, db: AsyncSession, *, email: str) -> list[UserInvitation]:
        stmt = select(UserInvitation).where(UserInvitation.email == email).order_by(UserInvitation.created_at.desc())
        result = await db.execute(stmt)
        return result.scalars().all()

user_repo = UserRepository(User)
user_invitation_repo = UserInvitationRepository(UserInvitation)
