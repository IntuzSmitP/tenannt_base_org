# Database Architecture & ER Diagram

This document contains the Entity-Relationship (ER) diagram for the SaaS platform. Since the application uses a **schema-per-tenant** architecture, the database is split into two logical areas: the **Public Schema** (for global routing and company management) and the **Tenant Schema** (which is replicated for each registered company workspace).

```mermaid
erDiagram
    %% ==========================================
    %% PUBLIC SCHEMA (Global Data)
    %% ==========================================
    
    COMPANIES ||--o{ USER_DIRECTORY : "has many"
    COMPANIES ||--o{ COMPANY_REGISTRATION_AUDIT : "audits"
    
    COMPANIES {
        UUID id PK
        String name
        String slug UK "Tenant Identifier"
        String owner_email UK
        String schema_name UK "e.g., tenant_slug"
        String status
        DateTime created_at
        DateTime updated_at
        DateTime deleted_at
    }

    USER_DIRECTORY {
        UUID id PK
        String email UK
        UUID company_id FK
        UUID tenant_user_id "ID of user in tenant schema"
        String status
        DateTime created_at
        DateTime updated_at
        DateTime deleted_at
    }

    COMPANY_REGISTRATION_AUDIT {
        UUID id PK
        UUID company_id FK
        String event
        JSONB metadata
        DateTime created_at
    }

    %% ==========================================
    %% TENANT SCHEMA (Isolated per workspace)
    %% ==========================================
    
    USERS ||--o{ PROJECTS : "creates"
    USERS ||--o{ TASKS : "creates / assigned_to"
    USERS ||--o{ PROJECT_MEMBERS : "belongs to"
    USERS ||--o{ USER_INVITATIONS : "invites"
    USERS ||--o{ EMAIL_TEMPLATES : "manages"
    
    PROJECTS ||--o{ TASKS : "contains"
    PROJECTS ||--o{ PROJECT_MEMBERS : "has"

    USERS {
        UUID id PK
        UUID company_id "Links back to Public.COMPANIES"
        String name
        String email UK
        String password_hash
        String role "OWNER, ADMIN, MEMBER"
        Boolean is_owner
        String status
        UUID invited_by FK "Self-referencing"
        DateTime created_at
        DateTime updated_at
        DateTime deleted_at
    }

    USER_INVITATIONS {
        UUID id PK
        UUID company_id
        String email
        String name
        String role
        String invitation_token UK
        String status "pending, accepted, canceled"
        DateTime expires_at
        DateTime accepted_at
        UUID invited_by FK
        DateTime created_at
        DateTime updated_at
    }

    PROJECTS {
        UUID id PK
        String name
        Text description
        String status
        UUID created_by FK
        Date start_date
        Date end_date
        DateTime created_at
        DateTime updated_at
        DateTime deleted_at
    }

    TASKS {
        UUID id PK
        UUID project_id FK
        String title
        Text description
        String status "todo, in_progress, done"
        String priority "low, medium, high"
        UUID assigned_to FK
        UUID created_by FK
        Date due_date
        DateTime created_at
        DateTime updated_at
        DateTime deleted_at
    }

    PROJECT_MEMBERS {
        UUID id PK
        UUID project_id FK
        UUID user_id FK
        String role "contributor, admin"
        DateTime added_at
        DateTime deleted_at
    }

    EMAIL_TEMPLATES {
        UUID id PK
        String template_type UK
        String subject
        Text body
        Boolean is_active
        UUID created_by FK
        DateTime created_at
        DateTime updated_at
    }
```
