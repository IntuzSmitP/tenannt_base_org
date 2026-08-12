from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)

class AppException(Exception):
    def __init__(self, message: str, status_code: int = 400, data: dict = None):
        self.message = message
        self.status_code = status_code
        self.data = data
        super().__init__(self.message)

def create_error_response(message: str, status_code: int, data: dict = None):
    # Always include all parameters so the frontend has a consistent, predictable contract
    return JSONResponse(
        status_code=status_code, 
        content={
            "success": False,
            "message": message,
            "data": data,
        }
    )

async def app_exception_handler(request: Request, exc: AppException):
    return create_error_response(
        message=exc.message,
        status_code=exc.status_code,
        data=exc.data
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Parse Pydantic validation errors into structured objects for the frontend
    formatted_errors = []
    first_error_msg = "Validation failed. Please check your inputs."
    
    for i, err in enumerate(exc.errors()):
        field = str(err.get("loc", ["unknown"])[-1])
        msg = err.get("msg", "").replace("Value error, ", "")
        
        # Make the generic regex error more user friendly
        if "String should match pattern" in msg:
            msg = f"{field.replace('_', ' ').title()} must contain at least one alphabet letter."
            
        formatted_errors.append({
            "field": field,
            "message": msg
        })
        
        if i == 0:
            first_error_msg = msg
            
    return create_error_response(
        message=first_error_msg,
        status_code=422,
        data={"validation_errors": formatted_errors}
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception: {exc}")
    return create_error_response(
        message="An unexpected internal server error occurred.",
        status_code=500
    )
