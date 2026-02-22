# Business Requirements Document (BRD)

## Document Control
- Project: Learning Path Management System (LPMS)
- Document Type: Business Requirements Document (BRD)
- Version: 1.0
- Date: 2026-02-23
- Status: Baseline
- Owner: LPMS Product Team

## 1. Executive Summary
LPMS is a role-based web platform to manage employee learning paths by integrating with enterprise ERP data and replacing manual spreadsheet workflows.  
The business objective is to improve training governance, increase completion rates, reduce administrative effort, and ensure auditable compliance outcomes.

## 2. Business Context
### 2.1 Current State (As-Is)
- Learning paths and enrollment actions are managed manually (Excel and ad hoc communication).
- Employee and organizational data lives in ERP and is not consistently synchronized into learning operations.
- Progress and completion tracking are fragmented.
- Certificate issuance and reporting are manual and delayed.

### 2.2 Target State (To-Be)
- LPMS serves as the central system for path lifecycle, enrollment, progress tracking, certification, and reporting.
- ERP provides employee/subordinate source data via API integration.
- Role-based operations are enforced across Super Admin, Learning Admin, Supervisor, and Employee.
- Restricted, Semi-Restricted, and Public learning path models are supported.

## 3. Business Objectives
1. Reduce manual effort in learning operations by at least 60%.
2. Improve path completion visibility to near real-time for all stakeholders.
3. Standardize enrollment governance by path category and role permissions.
4. Ensure every completion outcome is auditable and reportable.
5. Enable scalable onboarding of ERP employee data into LPMS.

## 4. Scope
### 4.1 In Scope
- User authentication and RBAC.
- Employee data import from ERP (lookup and selective import).
- Learning path management (create, update, archive/delete).
- Enrollment management:
  - Learning Admin enrollment for governed paths.
  - Supervisor enrollment for Semi-Restricted paths.
  - Employee self-enrollment for Public paths.
- Progress tracking and status updates.
- Certificate issuance on completion.
- In-app notifications.
- Operational reporting (summary metrics).

### 4.2 Out of Scope (Initial Release)
- External LMS content delivery.
- Full HR master-data replication beyond required employee profile fields.
- Deep analytics/data warehouse reporting.
- SSO federation and enterprise IAM integration.
- Production SMS/email provider rollout (in-app notifications are primary for current release).

## 5. Stakeholders
- Business Sponsor: Training and Development (T&D) leadership
- Product Owner: LPMS business owner
- Super Admin: platform governance and user access control
- Learning Administrator: path management and enrollment operations
- Supervisor: team progress oversight and selective enrollment authority
- Employee: consumer of learning paths and completion artifacts
- IT/Engineering: platform delivery, integration, and operations
- Compliance/Audit: review of training completion and action logs

## 6. Business Capabilities Required
1. Identity and access control by role.
2. ERP-backed employee discovery and import.
3. Policy-driven enrollment by path category.
4. Progress and completion lifecycle management.
5. Certificate generation and retrieval.
6. Notification and communication support.
7. Dashboard and summary reporting.
8. Auditability of critical actions.

## 7. Business Rules
1. Learning Path Categories:
   - Restricted: managed by Learning Admin (and governed admin roles).
   - Semi-Restricted: enrollments can be initiated by Learning Admin and Supervisor (for supervised team).
   - Public: employee self-enrollment allowed.
2. Only authorized roles can perform actions mapped to their privilege level.
3. Employee progress updates must remain within 0-100%.
4. Full completion triggers certificate issuance (one per employee/path/scope).
5. Imported ERP employees must change password on first login.
6. Duplicate employee numbers cannot exist in LPMS.
7. All sensitive operations must be logged.

## 8. Success Metrics and KPIs
- Operational KPIs:
  - Path creation turnaround time
  - Enrollment turnaround time
  - Number of manual spreadsheet operations removed
- Learning KPIs:
  - Enrollment volume
  - Completion rate
  - Time-to-completion
  - Certificates issued
- Platform KPIs:
  - Authentication success rate
  - API error rate
  - ERP integration success rate

## 9. Assumptions
- ERP endpoint availability and data quality are sufficient for import workflows.
- Role ownership and approval governance are defined by business operations.
- Employees have unique identifiers in ERP (employee number).
- Initial implementation remains web-first with responsive UI.

## 10. Constraints
- Integration depends on external ERP API response quality and uptime.
- Existing organizational security policies for credential handling and data retention must be observed.
- Release cadence is constrained by business validation and UAT windows.

## 11. Risks and Mitigations
- Risk: ERP schema drift or incomplete fields (email nulls).
  - Mitigation: fallback email policy and import skip reporting.
- Risk: Unauthorized enrollment behavior.
  - Mitigation: server-side category enforcement and RBAC middleware.
- Risk: Poor adoption due to process change.
  - Mitigation: role-specific dashboards, training, and phased rollout.
- Risk: Compliance gaps in completion evidence.
  - Mitigation: certificate records, audit logs, and reporting APIs.

## 12. Dependencies
- ERP API credentials and endpoint access.
- PostgreSQL availability and backup policy.
- Environment configuration and secret management.
- UAT business users from all roles.

## 13. Release Strategy
### Phase 1
- Core RBAC, path management, governed enrollment, employee dashboards.

### Phase 2
- ERP selective import workflows and first-login password reset policy.

### Phase 3
- Category-complete model (Restricted, Semi-Restricted, Public), certificate lifecycle, reporting hardening.

## 14. Business Acceptance Criteria
1. Role-specific permissions enforce business policy without manual overrides.
2. Learning Admin can create/manage paths and assign enrollments.
3. Supervisor can enroll only supervised team members in Semi-Restricted paths.
4. Employees can self-enroll only in Public paths.
5. Completion produces certificate records accessible to employees.
6. ERP subordinate lookup and selective import work with duplicate-safe behavior.
7. Business summary metrics are visible for operational decisions.

## 15. Open Business Decisions
1. Default password policy for ERP imports (length/rotation policy).
2. Final communication channel policy (in-app only vs email/SMS with SLA).
3. Final retention policy for notifications, logs, and certificates.
4. Final compliance report template and cadence.
