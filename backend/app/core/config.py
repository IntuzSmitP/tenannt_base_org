from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import EmailStr, PostgresDsn
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Multi-Tenant Project Management SaaS"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "saas_db"
    POSTGRES_PORT: str = "5432"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        
    @property
    def SQLALCHEMY_DATABASE_URI_SYNC(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Email / SMTP
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = "smtp.example.com"
    SMTP_USER: str = "user@example.com"
    SMTP_PASSWORD: str = "smtp_password"
    EMAILS_FROM_EMAIL: EmailStr = "noreply@example.com"
    EMAILS_FROM_NAME: str = PROJECT_NAME
    
    # Frontend URLs
    FRONTEND_URL: str = "http://localhost:3000"
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()
