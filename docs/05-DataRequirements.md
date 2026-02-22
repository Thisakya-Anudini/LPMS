# Data Requirements

## Document Control
- Project: LPMS
- Artifact: Data Requirements
- Version: 1.0
- Date: 2026-02-23

## 1. Purpose
Defines LPMS data domains, entities, constraints, validation rules, data quality requirements, integration mappings, security classification, lifecycle, and retention expectations.

## 2. Data Domains
1. Identity and Access
2. Organization and Employee Master
3. Learning Path and Course Structure
4. Enrollment and Progress
5. Notifications and Certificates
6. Audit and Integration Logs

## 3. Core Entities and Attributes

## 3.1 `auth_principals`
### Description
Stores system login principals for all roles.

### Key Attributes
- `id` (UUID, PK)
- `email` (TEXT, unique, required)
- `password_hash` (TEXT, required)
- `role` (`SUPER_ADMIN | LEARNING_ADMIN | SUPERVISOR | EMPLOYEE`)
- `name` (TEXT, required)
- `principal_type` (`USER | EMPLOYEE`)
- `is_active` (BOOLEAN, default true)
- `must_change_password` (BOOLEAN, default false)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### Data Rules
- Email must be unique and normalized (lowercase recommended).
- No API response must expose `password_hash`.
- Imported ERP employees must be created with `must_change_password = true`.

## 3.2 `employees`
### Description
Employee profile extension linked 1:1 with auth principal.

### Key Attributes
- `id` (UUID, PK)
- `principal_id` (UUID, unique FK -> auth_principals.id)
- `employee_number` (TEXT, unique, required)
- `designation` (TEXT, required)
- `grade_name` (TEXT, required)
- `supervisor_id` (UUID FK -> auth_principals.id, nullable)
- `created_at`, `updated_at`

### Data Rules
- `employee_number` uniqueness is mandatory.
- `supervisor_id` must reference a valid principal (preferably supervisor role).

## 3.3 `refresh_tokens`
### Description
Refresh session token records.

### Key Attributes
- `id` (UUID, PK)
- `principal_id` (UUID FK)
- `token_hash` (TEXT)
- `expires_at` (TIMESTAMPTZ)
- `revoked_at` (TIMESTAMPTZ, nullable)
- `created_at`

### Data Rules
- Token values are never stored raw; only hashed values.
- Expired/revoked tokens are invalid for refresh.

## 3.4 `learning_paths`
### Description
Learning path master records.

### Key Attributes
- `id` (UUID, PK)
- `title` (TEXT, required)
- `description` (TEXT, required)
- `category` (`RESTRICTED | SEMI_RESTRICTED | PUBLIC`)
- `total_duration` (TEXT, required)
- `status` (`ACTIVE | ARCHIVED | DRAFT`)
- `created_by` (UUID FK)
- `is_deleted` (BOOLEAN, soft delete flag)
- `created_at`, `updated_at`

### Data Rules
- Soft delete via `is_deleted=true`; not hard removed.
- Only active paths are enrollable.

## 3.5 `learning_path_stages`
### Description
Optional stage structure under learning paths.

### Key Attributes
- `id` (UUID, PK)
- `learning_path_id` (UUID FK)
- `title` (TEXT)
- `stage_order` (INT)

### Data Rules
- `stage_order` should be positive and unique per path (recommended).

## 3.6 `courses`
### Description
Course catalog entity.

### Key Attributes
- `id` (UUID, PK)
- `code` (TEXT unique)
- `title`, `description`
- `duration` (TEXT)
- `type` (`ONLINE | CLASSROOM | HYBRID`)
- `created_at`

### Data Rules
- `code` should align with ERP course code strategy in future integration.

## 3.7 `stage_courses`
### Description
Mapping between stages and courses.

### Key Attributes
- `stage_id` (FK)
- `course_id` (FK)
- Composite PK (`stage_id`, `course_id`)

## 3.8 `enrollments`
### Description
Tracks assignment and progress state for principal-path pair.

### Key Attributes
- `id` (UUID, PK)
- `principal_id` (UUID FK)
- `learning_path_id` (UUID FK)
- `status` (`NOT_STARTED | IN_PROGRESS | COMPLETED | OVERDUE`)
- `progress` (INT 0-100)
- `enrolled_at`, `completed_at`
- `approval_status` (`PENDING | APPROVED | REJECTED`)
- `approval_updated_by`, `approval_updated_at`
- `enrollment_source` (TEXT, e.g., `LEARNING_ADMIN | SUPERVISOR | SELF`)
- Unique (`principal_id`, `learning_path_id`)

### Data Rules
- `progress` must remain within 0-100.
- Category governance:
  - Public -> self-enrollment allowed
  - Semi-Restricted -> supervisor enrollment allowed (scoped)
  - Restricted -> managed enrollment only

## 3.9 `enrollment_progress`
### Description
Optional detailed progress snapshots.

### Key Attributes
- `id` (UUID, PK)
- `enrollment_id` (UUID FK)
- `stage_id` (UUID FK nullable)
- `progress` (INT 0-100)
- `created_at`

## 3.10 `notifications`
### Description
In-app notifications.

### Key Attributes
- `id` (UUID, PK)
- `principal_id` (UUID FK)
- `title`, `message`
- `type` (`INFO | SUCCESS | WARNING | ERROR`)
- `is_read` (BOOLEAN)
- `created_at`

### Data Rules
- Trigger on enrollment and completion events.

## 3.11 `certificates`
### Description
Completion artifact records.

### Key Attributes
- `id` (UUID, PK)
- `principal_id` (UUID FK)
- `learning_path_id` (UUID FK)
- `scope` (`STAGE | FULL`)
- `issued_at`
- `issued_by` (UUID FK nullable)
- Unique (`principal_id`, `learning_path_id`, `scope`)

### Data Rules
- On full completion (progress=100), insert `FULL` scope certificate if absent.

## 3.12 `audit_logs`
### Description
Critical action audit records.

### Key Attributes
- `id` (UUID, PK)
- `actor_principal_id` (UUID FK nullable)
- `action` (TEXT)
- `resource_type` (TEXT)
- `resource_id` (UUID nullable)
- `metadata` (JSONB)
- `created_at`

### Data Rules
- Must capture administrative/integration/security-sensitive operations.

## 3.13 `schema_migrations`
### Description
Migration execution ledger.

### Key Attributes
- `id` (SERIAL PK)
- `filename` (TEXT unique)
- `executed_at` (TIMESTAMPTZ)

## 4. Enumerations and Controlled Values
1. Role: `SUPER_ADMIN`, `LEARNING_ADMIN`, `SUPERVISOR`, `EMPLOYEE`
2. Principal Type: `USER`, `EMPLOYEE`
3. Path Category: `RESTRICTED`, `SEMI_RESTRICTED`, `PUBLIC`
4. Path Status: `ACTIVE`, `ARCHIVED`, `DRAFT`
5. Enrollment Status: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`
6. Approval Status: `PENDING`, `APPROVED`, `REJECTED`
7. Notification Type: `INFO`, `SUCCESS`, `WARNING`, `ERROR`
8. Certificate Scope: `STAGE`, `FULL`

## 5. Data Quality Requirements
1. `employee_number` must be non-empty and unique.
2. Email uniqueness enforced in `auth_principals`.
3. ERP imports must return row-level skip reasons for duplicates/missing keys.
4. Progress updates must reject out-of-range values.
5. All foreign keys must maintain referential integrity.

## 6. Integration Data Requirements (ERP)
### 6.1 Inbound Fields (current usage)
- `employeeNumber` (required for import)
- `employeeName` / `employeeInitials` + `employeeSurname` (name resolution)
- `designation`
- `gradeName`
- `email` (optional)

### 6.2 Normalization Rules
1. Name:
   - Use `employeeName` if present
   - Else `employeeInitials + employeeSurname`
2. Email:
   - Use ERP email if present
   - Else fallback `<employeeNumber>@<ERP_FALLBACK_EMAIL_DOMAIN>`
3. Password:
   - Imported users get `ERP_IMPORTED_DEFAULT_PASSWORD` and `must_change_password=true`

## 7. Security and Privacy Requirements
1. Passwords stored as bcrypt hashes only.
2. Refresh tokens stored as SHA-256 hashes.
3. Role-protected endpoint access required for sensitive datasets.
4. No credential hash/token secret exposure in API payloads.
5. Audit logs retained for governance/compliance.

## 8. Data Retention and Lifecycle
1. `learning_paths`: soft-delete (`is_deleted`) to preserve history.
2. `enrollments`: retained for analytics and compliance.
3. `certificates`: retained as proof of completion.
4. `notifications`: retention period TBD by policy.
5. `audit_logs`: retention per compliance policy (recommended long-term).
6. `refresh_tokens`: revoke and expire by token lifecycle policy.

## 9. Volume and Performance Expectations (Baseline)
1. Enrollments expected to be highest-growth table.
2. Existing indexes cover principal/path/status lookups.
3. Summary reporting uses aggregate queries; monitor for scale and add materialization if needed.

## 10. Data Ownership
1. Auth and account governance: Super Admin / IT Security
2. Learning path content: Learning Admin
3. Team enrollment/approvals: Supervisor (within scope)
4. Progress/certification: Employee + system automation
5. ERP source data stewardship: ERP owner

## 11. Open Data Decisions
1. Stage-level certificate issuance rule details (currently full completion is enforced).
2. Notification retention/archival policy.
3. PII minimization strategy for optional ERP attributes not currently stored.
4. Supervisor-role referential guard in `employees.supervisor_id` (strict DB constraint vs application-level validation).
