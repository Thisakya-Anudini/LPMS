# Functional Requirements Document (FRD)

## Document Control
- Project: Learning Path Management System (LPMS)
- Document Type: Functional Requirements Document (FRD)
- Version: 1.0
- Date: 2026-02-23
- Status: Baseline
- Owner: LPMS Product/Engineering

## 1. Purpose
This document defines the functional behavior of LPMS in implementation-ready detail, including role-specific operations, data interactions, API-backed workflows, validations, and expected outcomes.

## 2. Functional Scope
### 2.1 Included Modules
1. Authentication and session lifecycle
2. Role-Based Access Control (RBAC)
3. User and employee administration
4. ERP integration (subordinates lookup + selective import)
5. Learning path management
6. Enrollment management by category policy
7. Progress tracking and completion lifecycle
8. Certificate issuance and retrieval
9. Notifications (in-app)
10. Role dashboards and summary reporting

### 2.2 Excluded in this FRD baseline
1. External LMS delivery integration
2. Production-grade email/SMS gateway delivery
3. SSO federation
4. Advanced BI analytics warehouse

## 3. User Roles and Capabilities
### 3.1 Super Admin
- Create/deactivate user accounts
- Create employee accounts
- Access system-wide user management views

### 3.2 Learning Admin
- Create/update/delete learning paths
- Assign employees to paths
- View summary reports
- Lookup ERP subordinates and import employees

### 3.3 Supervisor
- View supervised team progress
- Approve/reject enrollments
- Enroll supervised team into **Semi-Restricted** paths

### 3.4 Employee
- View assigned paths and progress
- Update own progress
- Self-enroll in **Public** paths only
- View notifications and certificates
- Change password when required

## 4. Functional Requirements

## 4.1 Authentication and Password Policy
### FR-AUTH-001 Login
- System shall authenticate using email + password.
- System shall return access/refresh tokens and user profile.
- On invalid credentials, system shall return 401.

### FR-AUTH-002 Session Refresh
- System shall issue new access token using valid refresh token.
- Revoked/expired refresh token shall be rejected with 401.

### FR-AUTH-003 Logout
- System shall revoke refresh token on logout.

### FR-AUTH-004 Profile Endpoint
- System shall return current authenticated user profile.

### FR-AUTH-005 Forced Password Change
- If `must_change_password=true`, user shall be redirected to change-password flow.
- User shall be blocked from role dashboards until password is updated.

### FR-AUTH-006 Change Password
- System shall validate current password.
- New password minimum length: 8.
- On success, system shall clear `must_change_password`.
- Existing refresh tokens shall be revoked.

## 4.2 RBAC Enforcement
### FR-RBAC-001
- Every protected endpoint shall require valid bearer token.

### FR-RBAC-002
- Endpoint access shall be restricted by role policy:
  - Super Admin routes: `SUPER_ADMIN`
  - Learning Admin routes: `LEARNING_ADMIN`
  - Supervisor routes: `SUPERVISOR`
  - Employee routes: `EMPLOYEE`

### FR-RBAC-003
- Unauthorized access attempts shall return 403 with structured error payload.

## 4.3 User and Employee Administration
### FR-ADM-001 Create System User
- Super Admin shall create user for roles:
  - `SUPER_ADMIN`, `LEARNING_ADMIN`, `SUPERVISOR`
- Employee role is not allowed via this endpoint.

### FR-ADM-002 List Users
- Super Admin shall view sanitized user list (no password hash exposure).

### FR-ADM-003 Deactivate User
- Super Admin can deactivate users except self-deactivation.

### FR-ADM-004 Create Employee
- Super Admin shall create employee profile + auth principal linkage.
- Required fields:
  - employee number, email, password, designation, grade

## 4.4 ERP Integration
### FR-ERP-001 Fetch Subordinates
- Learning Admin/Supervisor/Super Admin can fetch ERP subordinate list by `employeeNo`.
- Request must be server-side proxied (credentials not exposed to frontend).

### FR-ERP-002 Import ERP Employees
- Learning Admin/Super Admin can import selected ERP rows into LPMS.
- System shall:
  - Create auth principal with role `EMPLOYEE`
  - Create employee record
  - Set `must_change_password = true`
  - Skip duplicates by employee number or email
  - Return imported/skipped summary

### FR-ERP-003 Fallback Email
- If ERP email is null, system shall assign fallback `<employeeNumber>@<domain>`.

## 4.5 Learning Path Management
### FR-LP-001 Create Path
- Learning Admin can create path with:
  - title, description, category, totalDuration

### FR-LP-002 View Paths
- Learning Admin can list and view path details.

### FR-LP-003 Update Path
- Learning Admin can update title/description/category/duration/status.

### FR-LP-004 Delete Path
- Delete shall be soft-delete (`is_deleted=true`).

### FR-LP-005 Category Model
- System shall support categories:
  - `RESTRICTED`, `SEMI_RESTRICTED`, `PUBLIC`

## 4.6 Enrollment Management
### FR-ENR-001 Learning Admin Enrollment
- Learning Admin can enroll selected employees into paths.
- Notification shall be generated for enrolled employee.

### FR-ENR-002 Supervisor Enrollment (Semi-Restricted)
- Supervisor can enroll only supervised team members.
- Allowed only when path category is `SEMI_RESTRICTED` and active.

### FR-ENR-003 Employee Self-Enrollment (Public)
- Employee can self-enroll only when path category is `PUBLIC` and active.
- Duplicate self-enrollment shall return 409 conflict.

### FR-ENR-004 Enrollment Source Tracking
- Enrollment source shall be stored (`LEARNING_ADMIN`, `SUPERVISOR`, `SELF`, etc.).

## 4.7 Progress and Completion
### FR-PRG-001 Progress Update
- Employee can update own enrollment progress (0..100).
- Status transitions:
  - 0 -> `NOT_STARTED`
  - 1..99 -> `IN_PROGRESS`
  - 100 -> `COMPLETED`

### FR-PRG-002 Completion Effects
- On progress 100:
  - Completion timestamp set
  - Certificate issued (`FULL`) if not already issued
  - Completion notification generated

## 4.8 Certificates
### FR-CERT-001 Certificate Generation
- System shall create certificate record at completion.
- Unique per principal/path/scope.

### FR-CERT-002 Certificate Retrieval
- Employee can list issued certificates.

## 4.9 Notifications
### FR-NOTIF-001 Enrollment Notification
- Notification shall be created on admin/supervisor/self enrollment.

### FR-NOTIF-002 Completion Notification
- Notification shall be created on certificate/completion event.

### FR-NOTIF-003 Notification Retrieval
- Employee can view recent notifications.

## 4.10 Reporting
### FR-RPT-001 Learning Summary Report
- Learning Admin can fetch summary:
  - total paths
  - active paths
  - total enrollments
  - completed enrollments
  - completion rate
  - total certificates

## 5. UI Functional Requirements

## 5.1 Login and Session
- UI shall present email/password login.
- UI shall show backend-provided errors.
- UI shall route by role after authentication.
- UI shall force `/change-password` when required.

## 5.2 Super Admin Dashboard
- UI shall display user statistics and recent users.
- UI shall provide forms to create:
  - system users
  - employees

## 5.3 Learning Admin Dashboard
- UI shall display learning path metrics.
- UI shall provide ERP lookup by employee number.
- UI shall provide ERP table selection and import action.

## 5.4 Learning Path Management
- UI shall support create/update/delete path operations.
- UI shall support assignment of employees to paths.

## 5.5 Supervisor Dashboard
- UI shall display team progress.
- UI shall display pending approvals with approve/reject actions.
- UI shall provide semi-restricted team enrollment UI.

## 5.6 Employee Dashboard
- UI shall show active enrolled paths.
- UI shall support progress updates and mark complete.
- UI shall list public paths and self-enrollment action.
- UI shall display notifications.

## 5.7 Employee Learning History
- UI shall show issued certificates.

## 6. Validations and Error Behavior
1. Missing required fields -> 400 `VALIDATION_ERROR`
2. Invalid credentials -> 401 `INVALID_CREDENTIALS`
3. Invalid/expired token -> 401
4. Forbidden action for role -> 403
5. Missing resource -> 404
6. Duplicate conflict (already enrolled, duplicates) -> 409 where applicable
7. Integration failures (ERP) -> 502 with details where available

## 7. Audit and Compliance Functional Requirements
1. Critical actions shall be audit-logged:
   - user/employee creation
   - path CRUD
   - enrollment operations
   - approval actions
   - ERP fetch/import
   - progress updates
2. Audit logs shall include actor, action, resource, and metadata.

## 8. Traceability (BRD to FRD)
1. BRD Objective: automate manual operations  
   -> FR-ADM, FR-LP, FR-ENR, FR-PRG
2. BRD Objective: ERP-driven employee management  
   -> FR-ERP
3. BRD Objective: governed access and compliance  
   -> FR-AUTH, FR-RBAC, FR-CERT, FR-NOTIF, audit requirements
4. BRD Objective: progress visibility and reporting  
   -> FR-RPT, supervisor/employee dashboard requirements

## 9. Open Functional Items (Next Iteration)
1. Stage-level certificate issuance logic (currently full-completion baseline).
2. External email/SMS dispatch integration.
3. Advanced report export formats and scheduling.
4. Bulk operations UX hardening for very large employee sets.
