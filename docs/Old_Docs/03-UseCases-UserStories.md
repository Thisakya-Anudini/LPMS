# Use Case Document and User Stories

## Document Control
- Project: Learning Path Management System (LPMS)
- Document Type: Use Cases and User Stories
- Version: 1.0
- Date: 2026-02-23
- Status: Baseline

## 1. Actors
1. Super Admin
2. Learning Administrator
3. Supervisor
4. Employee
5. ERP System (external system actor)

## 2. Use Case Index
1. UC-001 User Login
2. UC-002 Forced Password Change
3. UC-003 Super Admin Create User
4. UC-004 Super Admin Create Employee
5. UC-005 Learning Admin Create/Update/Delete Path
6. UC-006 Learning Admin Enroll Employees
7. UC-007 ERP Subordinate Lookup
8. UC-008 ERP Employee Import
9. UC-009 Supervisor View Team Progress
10. UC-010 Supervisor Enroll Team (Semi-Restricted)
11. UC-011 Supervisor Approve/Reject Enrollment
12. UC-012 Employee View Assigned Paths
13. UC-013 Employee Update Progress
14. UC-014 Employee Self-Enroll Public Path
15. UC-015 Employee View Certificates
16. UC-016 Learning Admin View Summary Report

## 3. Detailed Use Cases

## UC-001 User Login
- Primary Actor: Any authenticated role
- Preconditions:
  - User account is active
  - User has valid credentials
- Trigger: User submits email and password
- Main Flow:
  1. User enters email/password on login page.
  2. System validates credentials.
  3. System issues access and refresh tokens.
  4. System returns user profile and role.
  5. UI redirects to role dashboard.
- Alternate Flows:
  - A1: Invalid credentials -> 401 error
- Postconditions:
  - Session is established

## UC-002 Forced Password Change
- Primary Actor: Imported Employee (or any user flagged for reset)
- Preconditions:
  - `must_change_password = TRUE`
- Trigger: Successful login
- Main Flow:
  1. User logs in.
  2. System returns profile with `mustChangePassword=true`.
  3. UI redirects to `/change-password`.
  4. User submits current and new password.
  5. System validates old password and updates hash.
  6. System clears `must_change_password`.
  7. UI redirects to role dashboard.
- Alternate Flows:
  - A1: old password wrong -> 401 error
  - A2: new password invalid (<8 chars) -> 400 error
- Postconditions:
  - User can access role dashboard

## UC-003 Super Admin Create User
- Primary Actor: Super Admin
- Preconditions:
  - Super Admin logged in
- Trigger: Submit create user form
- Main Flow:
  1. Super Admin enters name/email/password/role.
  2. System validates role (`SUPER_ADMIN`, `LEARNING_ADMIN`, `SUPERVISOR`).
  3. System creates auth principal.
  4. System returns created user.
- Alternate Flows:
  - A1: duplicate email -> conflict/validation error
- Postconditions:
  - New privileged user account available

## UC-004 Super Admin Create Employee
- Primary Actor: Super Admin
- Preconditions:
  - Super Admin logged in
- Trigger: Submit create employee form
- Main Flow:
  1. Super Admin enters employee details.
  2. System validates required fields.
  3. System creates auth principal (`EMPLOYEE`) + employee profile.
  4. System returns created employee.
- Alternate Flows:
  - A1: duplicate employee number/email -> conflict
- Postconditions:
  - Employee can login to LPMS

## UC-005 Learning Admin Create/Update/Delete Path
- Primary Actor: Learning Admin
- Preconditions:
  - Learning Admin logged in
- Trigger: Path CRUD actions
- Main Flow:
  1. Learning Admin creates path with category and metadata.
  2. System stores path.
  3. Learning Admin updates or soft-deletes path as needed.
- Alternate Flows:
  - A1: invalid category/status -> validation error
  - A2: non-existing path -> not found
- Postconditions:
  - Path catalog updated

## UC-006 Learning Admin Enroll Employees
- Primary Actor: Learning Admin
- Preconditions:
  - Valid path exists
  - Employees exist
- Trigger: Submit enrollment assignment
- Main Flow:
  1. Learning Admin selects path and employees.
  2. System inserts enrollments (deduplicated).
  3. System creates enrollment notifications.
  4. UI shows success summary.
- Alternate Flows:
  - A1: empty employee list -> validation error
  - A2: duplicate enrollment -> skipped (no failure)
- Postconditions:
  - Employees are enrolled and notified

## UC-007 ERP Subordinate Lookup
- Primary Actor: Learning Admin / Supervisor / Super Admin
- Secondary Actor: ERP system
- Preconditions:
  - ERP credentials configured server-side
- Trigger: Submit employee number in ERP lookup panel
- Main Flow:
  1. Actor enters employee number.
  2. Backend sends request to ERP.
  3. ERP returns subordinate list.
  4. UI displays subordinate data.
- Alternate Flows:
  - A1: ERP auth/network error -> integration error with details
- Postconditions:
  - Candidate subordinate data available for import

## UC-008 ERP Employee Import
- Primary Actor: Learning Admin / Super Admin
- Preconditions:
  - ERP lookup results available
- Trigger: Import selected employees
- Main Flow:
  1. Actor selects one/many ERP rows.
  2. Backend validates duplicates.
  3. Backend creates auth principals + employee records.
  4. Imported users are marked `must_change_password=true`.
  5. System returns imported/skipped summary.
- Alternate Flows:
  - A1: employee number exists -> skipped
  - A2: email exists -> skipped
  - A3: missing ERP email -> fallback email generated
- Postconditions:
  - Selected employees become LPMS users

## UC-009 Supervisor View Team Progress
- Primary Actor: Supervisor
- Preconditions:
  - Supervisor logged in
- Trigger: Open supervisor dashboard
- Main Flow:
  1. System loads supervised team progress aggregates.
  2. UI displays completion and average progress metrics.
- Postconditions:
  - Supervisor sees current team training status

## UC-010 Supervisor Enroll Team (Semi-Restricted)
- Primary Actor: Supervisor
- Preconditions:
  - Semi-restricted active path exists
  - Team members are mapped to supervisor
- Trigger: Supervisor submits team enrollment
- Main Flow:
  1. Supervisor selects semi-restricted path.
  2. Supervisor selects team members.
  3. System verifies supervisor ownership and path category.
  4. System creates enrollments and notifications.
- Alternate Flows:
  - A1: path not semi-restricted -> forbidden
  - A2: employee not under supervisor -> ignored/skipped
- Postconditions:
  - Selected team members enrolled

## UC-011 Supervisor Approve/Reject Enrollment
- Primary Actor: Supervisor
- Preconditions:
  - Pending approvals exist in supervised scope
- Trigger: Approve or reject action
- Main Flow:
  1. Supervisor views pending approvals.
  2. Supervisor chooses approve/reject.
  3. System updates approval status and audit log.
- Alternate Flows:
  - A1: enrollment outside supervisor scope -> not found/forbidden behavior
- Postconditions:
  - Approval status updated

## UC-012 Employee View Assigned Paths
- Primary Actor: Employee
- Preconditions:
  - Employee logged in
- Trigger: Open employee dashboard
- Main Flow:
  1. System loads assigned enrollments.
  2. UI displays active paths and statuses.
- Postconditions:
  - Employee sees learning workload

## UC-013 Employee Update Progress
- Primary Actor: Employee
- Preconditions:
  - Employee has an active enrollment
- Trigger: Progress action (+10% or mark complete)
- Main Flow:
  1. Employee updates progress.
  2. System validates range (0..100) and updates status.
  3. If progress reaches 100, system issues certificate and notification.
- Alternate Flows:
  - A1: invalid progress value -> validation error
- Postconditions:
  - Enrollment state updated

## UC-014 Employee Self-Enroll Public Path
- Primary Actor: Employee
- Preconditions:
  - Path exists and is active/public
- Trigger: Click self-enroll
- Main Flow:
  1. Employee selects public path.
  2. System checks path category and active status.
  3. System creates enrollment with source `SELF`.
  4. System creates self-enrollment notification.
- Alternate Flows:
  - A1: path not public/active -> forbidden
  - A2: already enrolled -> conflict
- Postconditions:
  - Employee enrolled in public path

## UC-015 Employee View Certificates
- Primary Actor: Employee
- Preconditions:
  - Certificate records exist
- Trigger: Open My Learning History
- Main Flow:
  1. System fetches certificate list.
  2. UI shows scope and issued date.
- Postconditions:
  - Employee can verify achievements

## UC-016 Learning Admin View Summary Report
- Primary Actor: Learning Admin
- Preconditions:
  - Learning data exists
- Trigger: Open learning admin dashboard
- Main Flow:
  1. System returns summary metrics.
  2. UI displays totals, completion rate, and certificate counts.
- Postconditions:
  - Admin has operational insights

## 4. User Stories (Epic-Oriented)

## Epic A: Authentication and Security
- US-A1: As a user, I want to login with my email/password so that I can access my role dashboard.
- US-A2: As an imported employee, I want to be forced to change my password on first login so that my account is secure.
- US-A3: As an admin, I want unauthorized actions blocked by role so that governance is enforced.

## Epic B: Learning Path Administration
- US-B1: As a Learning Admin, I want to create and edit learning paths so that training structures stay current.
- US-B2: As a Learning Admin, I want to assign employees to paths so that training can be governed centrally.
- US-B3: As a Learning Admin, I want a summary report so that I can monitor learning outcomes quickly.

## Epic C: ERP Integration
- US-C1: As a Learning Admin, I want to lookup subordinates from ERP so that employee import is accurate.
- US-C2: As a Learning Admin, I want to import selected ERP employees so that onboarding to LPMS is fast.
- US-C3: As an operator, I want duplicate-safe imports so that data integrity is preserved.

## Epic D: Supervisor Operations
- US-D1: As a Supervisor, I want to view team progress so that I can coach employees.
- US-D2: As a Supervisor, I want to enroll my team into semi-restricted paths so that development plans are executed.
- US-D3: As a Supervisor, I want to approve/reject pending enrollments so that governance is maintained.

## Epic E: Employee Learning Experience
- US-E1: As an Employee, I want to view my assigned paths and progress so that I know what to complete.
- US-E2: As an Employee, I want to self-enroll in public paths so that I can upskill proactively.
- US-E3: As an Employee, I want certificates generated on completion so that I can prove achievements.
- US-E4: As an Employee, I want notifications for key events so that I stay informed.

## 5. Acceptance Criteria (Condensed)
1. Login returns role profile and follows forced password policy.
2. Learning path category rules are enforced server-side.
3. ERP import handles duplicates and fallback email correctly.
4. Supervisor enrollment restricted to supervised employees and semi-restricted paths.
5. Employee self-enrollment allowed only for active public paths.
6. Completion at 100% results in certificate record creation.
7. Notifications exist for enrollment and completion events.
8. Summary report metrics reflect persisted data accurately.
