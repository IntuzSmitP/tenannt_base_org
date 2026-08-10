from fastapi import Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

class AppException(Exception):
    def __init__(self, message: str, status_code: int = 400, data: dict = None, errors: list = None):
        self.message = message
        self.status_code = status_code
        self.data = data
        self.errors = errors
        super().__init__(self.message)

async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "data": exc.data,
            "errors": exc.errors
        }
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error.",
            "data": None,
            "errors": [str(exc)]
        }
    )
