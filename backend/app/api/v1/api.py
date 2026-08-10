from fastapi import APIRouter

from app.api.v1.endpoints import auth, company, user, project, task

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(company.router, prefix="/company", tags=["company"])
api_router.include_router(user.router, prefix="/users", tags=["users"])
api_router.include_router(project.router, prefix="/projects", tags=["projects"])
api_router.include_router(task.router, prefix="/tasks", tags=["tasks"])
