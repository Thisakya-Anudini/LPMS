# Low-Level Design (LLD) - API and DB Design

## Document Control
- Project: LPMS
- Artifact: Low-Level Design (LLD)
- Version: 1.0
- Date: 2026-02-23

## 1. Scope
Implementation-level design details for API routing, middleware, controller responsibilities, and persistence model alignment.

## 2. Backend Module Structure
1. `middlewares/`
   - `authMiddleware.js`: bearer parsing + JWT validation + principal context
   - role guards (`requireRole`)
2. `controllers/`
   - `authController.js`
   - `superAdminController.js`
   - `learningAdminController.js`
   - `supervisorController.js`
   - `employeeController.js`
   - `integrationController.js`
3. `routes/`
   - `authRoutes.js`
   - `superAdminRoutes.js`
   - `learningAdminRoutes.js`
   - `supervisorRoutes.js`
   - `employeeRoutes.js`
   - `integrationRoutes.js`
4. `db/`
   - `migrations/*.sql`
   - DB pool/connection helper

## 3. Auth and Session Flow (Low-Level)
1. `POST /api/auth/login`
   - lookup `auth_principals` by email and active status
   - bcrypt compare password
   - issue access token + refresh token
   - persist hashed refresh token
2. `POST /api/auth/refresh`
   - hash input refresh token
   - validate token row (`revoked_at IS NULL`, `expires_at > now()`)
   - issue new access token
3. `POST /api/auth/logout`
   - hash token and set `revoked_at`
4. `GET /api/auth/me`
   - return sanitized profile from principal context
5. `POST /api/auth/change-password`
   - verify old password
   - set new bcrypt hash
   - clear `must_change_password`

## 4. RBAC Matrix (Enforcement)
1. Super Admin routes: `SUPER_ADMIN`
2. Learning Admin routes: `SUPER_ADMIN`, `LEARNING_ADMIN`
3. Supervisor routes: `SUPER_ADMIN`, `SUPERVISOR`
4. Employee routes: `EMPLOYEE`
5. Shared read endpoints may include broader allowlists where needed.

## 5. Data Access Patterns
1. Always parameterized SQL queries.
2. Explicit selected columns (no `RETURNING *` for sensitive entities).
3. Logical delete for selected entities (`learning_paths.is_deleted`).
4. Upsert patterns for idempotent enrollment creation where applicable.

## 6. Learning Path + Enrollment LLD
1. Learning path create/update validates category/status.
2. Enrollment assignment validates:
   - target principal eligibility
   - no duplicate enrollment (`principal_id`, `learning_path_id`)
   - category governance
3. Progress update logic:
   - enforce `0 <= progress <= 100`
   - set completion metadata when progress reaches 100
   - issue certificate on completion if absent

## 7. ERP Integration LLD
1. Endpoint accepts `employeeNo`.
2. Service invokes ERP API with configured headers/credentials.
3. Response mapping:
   - normalize name/email/designation/grade
   - return parsed list for UI preview
4. Import path:
   - create auth principal + employee row per valid record
   - fallback email and default password policy
   - report imported/skipped counts and reasons

## 8. Error Contract
Every error follows:
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## 9. DB Migration Design
1. Ordered migration execution from `db/migrations`.
2. Ledger table `schema_migrations` tracks applied files.
3. Current key migrations include:
   - role/auth principal base
   - learning/enrollment domain
   - `must_change_password`
   - certificates and enrollment source

## 10. Testing Targets
1. Auth lifecycle tests (login/refresh/logout/change password).
2. RBAC tests per route group.
3. ERP integration tests with failure-path assertions.
4. Enrollment/progress/certificate behavior tests.
