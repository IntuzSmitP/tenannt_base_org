from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from app.core.config import settings
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

conf = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER,
    MAIL_PASSWORD=settings.SMTP_PASSWORD,
    MAIL_FROM=settings.EMAILS_FROM_EMAIL,
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.SMTP_HOST,
    MAIL_STARTTLS=settings.SMTP_TLS,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    MAIL_FROM_NAME=settings.EMAILS_FROM_NAME
)

async def send_email(email_to: EmailStr, subject: str, body: str) -> bool:
    try:
        message = MessageSchema(
            subject=subject,
            recipients=[email_to],
            body=body,
            subtype=MessageType.html
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info(f"Email sent to {email_to} - Subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {email_to}: {e}")
        return False

def replace_template(template: str, context: Dict[str, Any]) -> str:
    result = template
    for key, value in context.items():
        result = result.replace(f"{{{{{key}}}}}", str(value))
    return result
