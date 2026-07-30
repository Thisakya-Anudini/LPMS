# ER Diagram - Database Structure

## Document Control
- Project: LPMS
- Artifact: ER Diagram
- Version: 1.0
- Date: 2026-02-23

## 1. ER Diagram (Mermaid)
```mermaid
erDiagram
  AUTH_PRINCIPALS ||--o| EMPLOYEES : has_profile
  AUTH_PRINCIPALS ||--o{ REFRESH_TOKENS : owns
  AUTH_PRINCIPALS ||--o{ LEARNING_PATHS : creates
  AUTH_PRINCIPALS ||--o{ ENROLLMENTS : has
  AUTH_PRINCIPALS ||--o{ NOTIFICATIONS : receives
  AUTH_PRINCIPALS ||--o{ CERTIFICATES : receives
  AUTH_PRINCIPALS ||--o{ AUDIT_LOGS : performs

  LEARNING_PATHS ||--o{ LEARNING_PATH_STAGES : contains
  LEARNING_PATH_STAGES ||--o{ STAGE_COURSES : maps
  COURSES ||--o{ STAGE_COURSES : maps

  LEARNING_PATHS ||--o{ ENROLLMENTS : assigned_in
  ENROLLMENTS ||--o{ ENROLLMENT_PROGRESS : tracks
  LEARNING_PATH_STAGES ||--o{ ENROLLMENT_PROGRESS : optional_stage

  LEARNING_PATHS ||--o{ CERTIFICATES : certifies

  AUTH_PRINCIPALS {
    uuid id PK
    text email UK
    text password_hash
    enum role
    text name
    enum principal_type
    boolean is_active
    boolean must_change_password
    timestamptz created_at
    timestamptz updated_at
  }

  EMPLOYEES {
    uuid id PK
    uuid principal_id FK UK
    text employee_number UK
    text designation
    text grade_name
    uuid supervisor_id FK
    timestamptz created_at
    timestamptz updated_at
  }

  REFRESH_TOKENS {
    uuid id PK
    uuid principal_id FK
    text token_hash
    timestamptz expires_at
    timestamptz revoked_at
    timestamptz created_at
  }

  LEARNING_PATHS {
    uuid id PK
    text title
    text description
    enum category
    text total_duration
    enum status
    uuid created_by FK
    boolean is_deleted
    timestamptz created_at
    timestamptz updated_at
  }

  LEARNING_PATH_STAGES {
    uuid id PK
    uuid learning_path_id FK
    text title
    int stage_order
  }

  COURSES {
    uuid id PK
    text code UK
    text title
    text description
    text duration
    enum type
    timestamptz created_at
  }

  STAGE_COURSES {
    uuid stage_id FK
    uuid course_id FK
  }

  ENROLLMENTS {
    uuid id PK
    uuid principal_id FK
    uuid learning_path_id FK
    enum status
    int progress
    enum approval_status
    text enrollment_source
    uuid approval_updated_by FK
    timestamptz approval_updated_at
    timestamptz enrolled_at
    timestamptz completed_at
  }

  ENROLLMENT_PROGRESS {
    uuid id PK
    uuid enrollment_id FK
    uuid stage_id FK
    int progress
    timestamptz created_at
  }

  NOTIFICATIONS {
    uuid id PK
    uuid principal_id FK
    text title
    text message
    enum type
    boolean is_read
    timestamptz created_at
  }

  CERTIFICATES {
    uuid id PK
    uuid principal_id FK
    uuid learning_path_id FK
    enum scope
    uuid issued_by FK
    timestamptz issued_at
  }

  AUDIT_LOGS {
    uuid id PK
    uuid actor_principal_id FK
    text action
    text resource_type
    uuid resource_id
    jsonb metadata
    timestamptz created_at
  }
```

## 2. Cardinality Notes
1. One principal can have many enrollments, notifications, certificates.
2. One employee row belongs to exactly one principal.
3. One learning path can have many stages and enrollments.
4. Stage-course is many-to-many via mapping table.
5. Enrollment can have many progress snapshots.

## 3. Constraint Highlights
1. Unique email in `auth_principals`.
2. Unique employee number in `employees`.
3. Unique `(principal_id, learning_path_id)` in `enrollments`.
4. Unique `(principal_id, learning_path_id, scope)` in `certificates`.
