# LPMS Database & ERP APIs Inspection Report

---

## Database Inspection by DB Migration Files

### 1. auth_principals (001_create_roles_and_auth_principals.sql)

- **Importance to the Project**: High
  - This is the core identity and authentication table.
- **Where it is Important**:
  - Used system-wide (Login, Role-based Access Control, Audit Logs, and User Profiles).
  - It serves as the master record for any actor in the system.
- **Frontend Pages Used**:
  - `LoginPage.tsx` (`/login`)
  - `ChangePasswordPage.tsx` (`/change-password`)
  - `AdminDashboard` (`/admin/accounts`)
  - `AdminLearnersPage` (`/admin/learners`)
- **What it Does**:
  - Stores fundamental user credentials (email, hashed password).
  - Stores system roles (`SUPER_ADMIN`, `LEARNING_ADMIN`, `SUPERVISOR`, `EMPLOYEE`).
  - Stores basic user status.
  - Acts as the primary foreign key for almost all user-associated records.
- **Is it Actually Needed?**: Yes
  - Even if employee details come from the ERP, the LPMS needs a local authenticable identity.
  - It requires LPMS-specific roles and passwords to manage access securely.

### 2. employees (002_create_users_employees_refresh_tokens.sql)

- **Importance to the Project**: High
  - Extends `auth_principals` with organizational context.
- **Where it is Important**:
  - Learner Management, Supervisor Dashboards, and ERP Integration workflows.
- **Frontend Pages Used**:
  - `AdminEmployeeHierarchyPage` (`/admin/hierarchy`)
  - `SupervisorDashboard` (`/supervisor`)
  - `AdminLearnerDetailsPage` (`/admin/learners/:id`)
- **What it Does**:
  - Stores organization-specific details like `employee_number`, `designation`, and `grade_name`.
  - Stores supervisor hierarchy (`supervisor_id`).
  - Links back to `auth_principals` via `principal_id`.
- **Is it Actually Needed?**: Yes
  - While data is initially populated by ERP APIs, having a local table (cache) is crucial.
  - It allows the LPMS to query supervisors, filter learners by designation, and manage relationships locally.
  - This avoids making an external ERP API call for every single database query.

### 3. refresh_tokens (002_create_users_employees_refresh_tokens.sql)

- **Importance to the Project**: High
  - Critical for system security and session management.
- **Where it is Important**:
  - Authentication flow.
- **Frontend Pages Used**:
  - Does not have a dedicated UI page.
  - Heavily impacts `LoginPage.tsx` and the global `AuthProvider` which wraps the entire application (`App.tsx`).
- **What it Does**:
  - Stores hashed refresh tokens associated with a user.
  - Stores their expiration and revocation timestamps.
- **Is it Actually Needed?**: Yes
  - This is a standard security practice for JWT-based auth systems.
  - It ensures users can maintain sessions without storing long-lived access tokens.
  - Functions completely independent of the ERP.

### 4. learning_paths (003_create_learning_path_domain.sql)

- **Importance to the Project**: Very High
  - This is the central domain entity of the LPMS (Learning Path Management System).
- **Where it is Important**:
  - Course Structuring, Admin Dashboards, Learner Catalogs, and Enrollments.
- **Frontend Pages Used**:
  - `LearningPathManagement` (`/learning-admin/paths/*`)
  - `AdminLearningPathsPage` (`/admin/learning-paths`)
  - `LearnerPublicPathsPage` (`/learner/public-paths`)
  - `LearnerMyProgressPage` (`/learner/my-progress`)
- **What it Does**:
  - Defines a learning path wrapper.
  - Contains metadata like title, description, category (RESTRICTED/PUBLIC), and publication status (DRAFT/ACTIVE/ARCHIVED).
- **Is it Actually Needed?**: Yes
  - This is a purely local LPMS concept that groups courses together into a journey.
  - It is fundamental to the project's purpose.

### 5. learning_path_stages (003_create_learning_path_domain.sql)

- **Importance to the Project**: High
  - Provides structural organization to learning paths.
- **Where it is Important**:
  - Course Sequencing, Learner Progress Tracking.
- **Frontend Pages Used**:
  - `LearningPathManagement` (Creation/Editing wizards)
  - `AdminLearningPathDetailsPage` (`/admin/learning-paths/:id`)
  - `LearnerMyProgressPage` (Rendering the stages of an enrolled path)
- **What it Does**:
  - Represents a distinct step or stage within a learning path.
  - Dictates the order (`stage_order`) in which courses should be presented or completed.
- **Is it Actually Needed?**: Yes
  - It is required to support multi-step learning journeys within the LPMS.

### 6. courses (003_create_learning_path_domain.sql)

- **Importance to the Project**: Very High
  - Core to the learning aspect.
- **Where it is Important**:
  - Course catalogs, learning paths, stage course linking, ERP sync.
- **Frontend Pages Used**:
  - `LearningPathManagement` (Adding/selecting courses to add to stages)
  - `AdminLearningPathDetailsPage`
- **What it Does**:
  - Stores details of individual training units.
  - Includes a unique `code`, `title`, `description`, `duration`, and `type` (ONLINE, CLASSROOM, HYBRID).
- **Is it Actually Needed?**: Yes
  - While `fetchAllCourses` API suggests that courses might be fetched or synced from an ERP, the LPMS needs local representations of these courses.
  - This allows linking them to `learning_path_stages` and tracking completions within learning paths locally.

### 7. stage_courses (003_create_learning_path_domain.sql)

- **Importance to the Project**: High
- **Where it is Important**:
  - Structuring the curriculum of a learning path.
- **Frontend Pages Used**:
  - Handled behind the scenes during the `LearningPathManagement` creation flow.
- **What it Does**:
  - Acts as a many-to-many junction table between `learning_path_stages` and `courses`.
  - Allows multiple courses to belong to a stage.
- **Is it Actually Needed?**: Yes
  - It's a required and normalized way to handle many-to-many relationships in a relational database.

### 8. enrollments (004_create_enrollments_progress_notifications.sql)

- **Importance to the Project**: Very High
  - The core transaction of the system.
- **Where it is Important**:
  - Learner dashboards, Supervisor dashboards, admin reports, progress tracking.
- **Frontend Pages Used**:
  - `LearnerMyProgressPage` (`/learner/my-progress`)
  - `SupervisorDashboard` (`/supervisor` - tracking team enrollments)
  - `LearningPathManagement` (Assign section)
- **What it Does**:
  - Connects `auth_principals` (the user) to `learning_paths`.
  - Tracks the overall `status` (NOT_STARTED, IN_PROGRESS, COMPLETED, OVERDUE).
  - Tracks `progress` percentage, enrollment date, completion date, and supervisor `approval_status`.
- **Is it Actually Needed?**: Yes
  - Without enrollments, the LPMS doesn't know who is learning what.
  - It is purely local application state.

### 9. enrollment_progress (004_create_enrollments_progress_notifications.sql)

- **Importance to the Project**: High
- **Where it is Important**:
  - Detailed learner progress tracking.
- **Frontend Pages Used**:
  - `LearnerMyProgressPage` (`/learner/my-progress`)
- **What it Does**:
  - Tracks the progress of an `enrollment` at the granular level of a `stage_id`.
  - Allows the system to know exactly how far along a user is within a multi-stage learning path.
- **Is it Actually Needed?**: Yes
  - It's needed for detailed analytics and resuming learning journeys accurately at specific stages.

### 10. notifications (004_create_enrollments_progress_notifications.sql)

- **Importance to the Project**: Medium
- **Where it is Important**:
  - Application header (bell icon), user engagement.
- **Frontend Pages Used**:
  - `NotificationsPage.tsx` (`/notifications`)
  - `DashboardLayout.tsx` (Global header)
- **What it Does**:
  - Stores in-app alerts sent to users (`principal_id`).
  - Includes a `title`, `message`, `type` (INFO, SUCCESS, WARNING, ERROR), and an `is_read` flag.
- **Is it Actually Needed?**: Yes
  - It keeps users informed about new course assignments, enrollment approvals, and deadlines natively within the LPMS.

### 11. audit_logs (004_create_enrollments_progress_notifications.sql)

- **Importance to the Project**: High
  - Crucial for compliance and security.
- **Where it is Important**:
  - System administration, security reviews.
- **Frontend Pages Used**:
  - No dedicated UI currently mapped in `App.tsx`, but heavily used by backend monitoring and system audits.
- **What it Does**:
  - Records sensitive actions performed in the system.
  - Tracks the `actor_principal_id` (who did it), `action` (e.g., FETCH_ERP_LEARNER_DETAILS), and `resource_type`.
  - Stores a JSONB payload of `metadata`.
- **Is it Actually Needed?**: Yes
  - Having an immutable log of who changed what or fetched sensitive data from the ERP is crucial for compliance in an enterprise application.

### 12. Database Optimization Indexes (005_add_indexes.sql)

- **Importance to the Project**: High
  - Essential for performance.
- **Where it is Important**:
  - Backend query execution times.
- **Frontend Pages Used**:
  - Impacts load times across the entire application, especially dashboards and data grids.
- **What it Does**:
  - This migration file does **not** create any new tables.
  - It adds B-tree indexes to heavily queried foreign keys and status columns on the tables created in migrations 001-004.
  - For example, it indexes `email` in `auth_principals`, `principal_id` in `enrollments`, and `status` in `learning_paths`.
- **Is it Actually Needed?**: Yes
  - Without these indexes, the PostgreSQL database would have to perform full table scans whenever a learner logs in or views their assigned courses.
  - This would cause the LPMS to severely lag as the number of enrollments scales up.

### 13. auth_principals update (006_add_must_change_password.sql)

- **Importance to the Project**: High
  - This strengthens the core authentication table with forced password-change support.
- **Where it is Important**:
  - Login flow, first-time password change flow, imported employee provisioning, and role-based authentication checks.
- **Frontend Pages Used**:
  - `LoginPage.tsx` (`/login`)
  - `ChangePasswordPage.tsx` (`/change-password`)
  - `AdminDashboard` (`/admin/accounts`)
  - `AdminLearnersPage` (`/admin/learners`)
- **What it Does**:
  - Adds a `must_change_password` boolean column to `auth_principals`, defaulting to `false`.
  - The application uses this to force newly imported or reset users to change their password before continuing.
- **Is it Actually Needed?**: Yes
  - This is required for secure onboarding of imported users and for enforcing password reset policies without depending on the ERP.

### 14. certificates and enrollment_source update (007_add_certificates_and_enrollment_source.sql)

- **Importance to the Project**: Very High
  - This migration adds the certificate issuance table and tracks how enrollments were created.
- **Where it is Important**:
  - Certificate generation, certificate downloads, learner achievement views, learning-admin certificate settings, and enrollment provenance reporting.
- **Frontend Pages Used**:
  - `LearnerCertificatesPage` (`/learner/certificates`)
  - `CertificateCustomizationPage` (`/learning-admin/certificates`)
  - `LearningAdminDashboard` (`/learning-admin/dashboard`)
  - `AssignmentReportsPage` (`/learning-admin/assignment-reports`)
- **What it Does**:
  - Adds `enrollment_source` to `enrollments` with a default value of `MANUAL`.
  - Creates the `certificates` table to store `principal_id`, `learning_path_id`, `scope`, `issued_at`, and `issued_by`.
  - Enforces one certificate per principal, learning path, and scope.
  - Adds indexes on `principal_id` and `learning_path_id` for lookup performance.
- **Is it Actually Needed?**: Yes
  - Certificates are a core learner-facing feature.
  - `enrollment_source` is important for knowing whether an enrollment came from manual entry, self-service, a learning admin, or a supervisor workflow.

### 15. notifications behavior update (008_limit_notifications_per_principal.sql)

- **Importance to the Project**: Medium to High
  - This keeps the notifications table bounded and performant.
- **Where it is Important**:
  - In-app notifications, notification bell refresh, and user notification history.
- **Frontend Pages Used**:
  - `NotificationsPage.tsx` (`/notifications`)
  - `DashboardLayout.tsx` (Global header)
  - `EmployeeDashboard`
- **What it Does**:
  - Creates a trigger function that automatically keeps only the newest 20 notifications per principal after each insert.
  - Runs a one-time cleanup for existing rows.
  - Adds a composite index on `principal_id`, `created_at`, and `id` to support the trimming and sorting logic.
- **Is it Actually Needed?**: Yes
  - Important if the product wants to cap notification growth and keep the table fast for frequent reads.
  - Without this, notifications can grow indefinitely and slow down inbox queries.

### 16. enrollment_progress unique index (009_enrollment_progress_unique_stage.sql)

- **Importance to the Project**: High
  - This protects stage-level progress tracking from duplicate rows.
- **Where it is Important**:
  - Learner progress tracking, stage completion updates, and resume/retry behavior in multi-stage learning paths.
- **Frontend Pages Used**:
  - `LearnerMyProgressPage` (`/learner/my-progress`)
  - `LearningPathManagement`
  - `SupervisorDashboard`
- **What it Does**:
  - Deletes duplicate `enrollment_progress` rows for the same `enrollment_id` and `stage_id` combination.
  - Creates a unique partial index so each enrollment can have only one progress row per stage when `stage_id` is not null.
- **Is it Actually Needed?**: Yes
  - This prevents duplicate stage-progress rows and makes progress upserts safe and predictable.

### 17. learning_admin_assignments (010_create_learning_admin_assignments.sql)

- **Importance to the Project**: High
  - This table stores which employees are assigned as learning admins.
- **Where it is Important**:
  - Admin account management, authorization checks, and learning-admin role mapping.
- **Frontend Pages Used**:
  - `AdminDashboard` (`/admin/accounts`)
  - Super Admin account management views
- **What it Does**:
  - Creates a `learning_admin_assignments` table keyed by `employee_number`.
  - Links `employee_number` to `assigned_by_principal_id`.
  - Stores `created_at` and `updated_at` timestamps.
  - Adds an index on `assigned_by_principal_id` for faster lookup.
- **Is it Actually Needed?**: Yes
  - The app uses this table to determine whether a user should be treated as a learning admin and to maintain the assignment history for administrative control.

### 18. Certificate Signer Details (011_add_certificate_signature_to_learning_paths.sql)

- **Importance to the Project**: Medium
  - Supports certificate personalization and official authorization.
- **Where it is Important**:
  - Learning path configuration and learner certificate generation.
- **Frontend Pages Used**:
  - `LearningPathManagement` (Learning path creation and editing)
  - Learner certificate download and display workflows
- **What it Does**:
  - Adds `certificate_signer_name` and `certificate_signer_title` columns to `learning_paths`.
  - These fields store the name and job title of the person whose authorization appears on certificates issued for a specific learning path.
- **Is it Actually Needed?**: Yes
  - Certificate signer information varies by learning path and must be stored locally so generated certificates contain the correct approving authority.

### 19. Stage Course Ordering and Course-Level Progress (012_stage_course_order_and_course_progress.sql)

- **Importance to the Project**: High
  - Enables deterministic course sequencing and detailed progress tracking.
- **Where it is Important**:
  - Learning path stage management, learner progress calculation, and course completion workflows.
- **Frontend Pages Used**:
  - `LearningPathManagement` (Ordering courses within stages)
  - `LearnerMyProgressPage` (`/learner/my-progress`)
- **What it Does**:
  - Adds the required `course_order` column to `stage_courses` and backfills existing records.
  - Creates a unique index so two courses cannot occupy the same position in one stage.
  - Adds `course_id` to `enrollment_progress` and creates a unique partial index so each course has at most one progress record per enrollment.
- **Is it Actually Needed?**: Yes
  - Stage-level progress alone cannot identify individual completed courses, and an explicit course order is necessary to display a consistent learning sequence.

### 20. Certificate Signature Image (013_add_certificate_signature_png_to_learning_paths.sql)

- **Importance to the Project**: Medium
  - Completes the visual certificate-signing capability.
- **Where it is Important**:
  - Certificate template configuration and PDF certificate rendering.
- **Frontend Pages Used**:
  - `LearningPathManagement` (Certificate configuration)
  - Learner certificate download workflow
- **What it Does**:
  - Adds `certificate_signature_png` to `learning_paths`.
  - The text column stores the PNG signature representation used when rendering the certificate for that learning path.
- **Is it Actually Needed?**: Yes
  - Necessary when certificates must show the authorized signer's actual signature image rather than only a typed name and title.

### 21. ERP Snapshot-Based Learner and Course Data (014_move_learners_and_courses_to_erp_snapshots.sql)

- **Importance to the Project**: Very High
  - Temporarily shifts learner and course dependencies away from local master tables toward ERP-derived snapshots.
- **Where it is Important**:
  - Enrollments, notifications, certificates, learning path courses, and course-level progress.
- **Frontend Pages Used**:
  - `LearnerMyProgressPage` (`/learner/my-progress`)
  - Learning path creation and details pages
  - Notifications and certificate workflows
- **What it Does**:
  - Adds learner snapshot fields to `enrollments`, an employee number to `notifications`, and learner snapshot fields to `certificates`.
  - Adds ERP course snapshot fields to `stage_courses` and `enrollment_progress`.
  - Backfills those fields from the existing `employees`, `auth_principals`, and `courses` data.
  - Creates uniqueness indexes for employee/path and course-code progress records.
  - Removes course foreign-key dependencies, and then drops the local `courses` and `employees` tables.
- **Is it Actually Needed?**:
  - It was needed for the ERP-snapshot architecture introduced at that point in the migration history.
  - It preserved the learner and course details required by LPMS transactions while treating ERP as the master source.
  - However, migration `015` subsequently restores the local tables and relationships for application compatibility.

### 22. Restore Local Employees and Courses (015_restore_employees_and_courses.sql)

- **Importance to the Project**: Very High
  - Restores the relational structures required by the current LPMS implementation.
- **Where it is Important**:
  - Authentication-linked employee records, learning path course relationships, progress tracking, and learning-admin assignments.
- **Frontend Pages Used**:
  - `AdminEmployeeHierarchyPage` (`/admin/hierarchy`)
  - `AdminLearnersPage` (`/admin/learners`)
  - `LearningPathManagement`
  - `LearnerMyProgressPage` (`/learner/my-progress`)
- **What it Does**:
  - Recreates the `course_type` enum and the `employees` and `courses` tables if absent.
  - Restores `course_id` relationships on `stage_courses` and `enrollment_progress`.
  - Rebuilds course records from the snapshot columns introduced by migration `014`.
  - Reconnects stage and progress records to those courses.
  - Reconstructs employee records from enrollment, certificate, notification, and active principal data.
  - Restores the foreign key from `learning_admin_assignments` to `employees`.
- **Is it Actually Needed?**: Yes
  - It reconciles the ERP snapshot data with the local relational model expected by the application.
  - It retains ERP-derived values while restoring foreign keys, normalized queries, and compatibility with existing controllers.

### 23. Assignment Reports (016_create_assignment_reports.sql)

- **Importance to the Project**: High
  - Captures assignment activity for reporting and ERP enrollment follow-up.
- **Where it is Important**:
  - Learning Admin assignment reports, assignment audit/history, and ERP enrollment tracking.
- **Frontend Pages Used**:
  - `AssignmentReportsPage` (`/learning-admin/assignment-reports`)
  - `LearningPathManagement`
- **What it Does**:
  - Creates `assignment_reports` to store the assignment event summary.
  - Creates `assignment_report_learners` to store the learners included in each assignment report.
  - Records the learning path title, assigning user details, assignment source (`LEARNING_ADMIN` or `SUPERVISOR`), report status (`ASSIGNED_IN_LPMS` or `ENROLLED_IN_ERP`).
  - Records learner employee numbers, names, emails, designations, and grades.
- **Database Objects Added**:
  - `assignment_reports` table.
  - `assignment_report_learners` table.
  - `idx_assignment_reports_assigned_at`, `idx_assignment_reports_status`, and `idx_assignment_report_learners_report_id`.
- **Is it Actually Needed?**: Yes
  - It gives the LPMS a local reporting record of who was assigned, by whom, from which source, and whether the assignment has progressed to ERP enrollment.

### 24. Class Enrollments (017_create_class_enrollments.sql)

- **Importance to the Project**: High
  - Links LPMS enrollments to specific ERP class sessions.
- **Where it is Important**:
  - Class assignment workflows, ERP class allocation, and course enrollment reporting.
- **Frontend Pages Used**:
  - `AssignEnrollmentToClassesPage` (`/learning-admin/classes/assign`)
- **What it Does**:
  - Creates `class_enrollments` to store the selected ERP class for each learner enrollment and course.
  - Keeps the LPMS `enrollment_id`, `learning_path_id`, ERP `course_code`, `class_id`, optional class code/title, raw `class_payload`, assigning user, and assignment timestamps.
- **Database Objects Added**:
  - `class_enrollments` table.
  - Unique constraint on `(enrollment_id, course_code)` so one learner enrollment can only have one class assignment per course.
  - `idx_class_enrollments_learning_path_course` and `idx_class_enrollments_class_id`.
- **Is it Actually Needed?**: Yes
  - The LPMS must remember which ERP class a learner was assigned to.
  - Without this table, class assignment would be temporary UI state or would need to be fetched from ERP every time.

### 25. Assignment Report De-duplication (018_dedupe_assignment_reports.sql)

- **Importance to the Project**: Medium to High
  - Protects assignment report data from duplicated report and learner rows.
- **Where it is Important**:
  - Assignment report accuracy, reporting filters, and ERP enrollment status tracking.
- **Frontend Pages Used**:
  - `AssignmentReportsPage` (`/learning-admin/assignment-reports`)
- **What it Does**:
  - Consolidates duplicate `assignment_reports` by keeping one report per `learning_path_id` and `assignment_source`.
  - Moves missing learner rows into the kept report.
  - Deletes duplicate reports and duplicate learner rows.
  - Adds unique indexes to prevent the same duplicates from returning.
- **Database Objects Changed**:
  - Adds `idx_assignment_reports_learning_path_source_unique` on `(learning_path_id, assignment_source)` where `learning_path_id IS NOT NULL`.
  - Adds `idx_assignment_report_learners_report_employee_unique` on `(report_id, employee_number)`.
- **Is it Actually Needed?**: Yes
  - It keeps report totals accurate and prevents repeated learner rows from appearing in assignment reports.

### 26. Class Detail Reports (019_create_class_detail_reports.sql)

- **Importance to the Project**: Medium to High
  - Stores detailed ERP class metadata needed for class report export and review.
- **Where it is Important**:
  - Class assignment reporting, class detail download workflows, and Learning Admin record keeping.
- **Frontend Pages Used**:
  - `AssignEnrollmentToClassesPage` (`/learning-admin/classes/assign`)
- **What it Does**:
  - Creates `class_detail_reports` to store per-class details for a learning path course.
  - Stores course category/name, offering name, catalog year, location, class title, training center, dates, times, duration, enrollment window, cost, and bond details.
- **Database Objects Added**:
  - `class_detail_reports` table.
  - Unique constraint on `(learning_path_id, course_code, class_id)`.
  - `idx_class_detail_reports_lookup` on `(learning_path_id, course_code, class_id)`.
- **Is it Actually Needed?**: Yes
  - It lets Learning Admins save and re-open the detailed class report information used when exporting class details.
  - This avoids losing those values after the current browser session.

---

## ERP Integration & Configuration Inspection

### Overview

- **Connection**: The LPMS system connects to an external ERP system.
- **Integration Layer**: It uses a dedicated client (`server/utils/erpClient.js`) and controllers (`server/controllers/integrationController.js`) to talk to the ERP.
- **Single Source of Truth**: The ERP acts as the master database for all human resources (HR) and corporate structure information.

### Technical Implementation Details

- **Authentication & Testing**:
  - The ERP needs specific security headers for every request.
  - Regular actions use `ERP_USERNAME` and `ERP_PASSWORD`.
  - Heavy search actions use `ERP_SEARCH_USERNAME` and `ERP_SEARCH_PASSWORD`.
  - For local development, setting `ERP_USE_MOCK=true` allows the system to use mock (fake) data instead of connecting to the real ERP.
- **HTTP Methods**:
  - Most API requests use the `POST` method to send JSON data.
  - Fetching organizations uses the `GET` method.
- **Data Hydration (`importErpEmployees`)**:
  - `importErpEmployees` (in `integrationController.js`) is the main function for importing employee data.
  - It takes employee information from the ERP and creates local `auth_principals` and `employees` records in the LPMS database.
  - It assigns a default password based on the `ERP_IMPORTED_DEFAULT_PASSWORD` setting.
  - If an ERP user is missing an email address, it generates a placeholder email using `ERP_FALLBACK_EMAIL_DOMAIN` (e.g., `employee123@erp.local`).

### Specific Endpoints and their Roles

#### 1. Employee Details & Hierarchy

- **`fetchEmployeeSubordinates`**:
  - **What it does**: Takes an `employeeNo` and returns a list of people who report directly to that employee.
  - **Where it is used**: Used by `supervisorController.js` to build the team structure on the Supervisor Dashboard. It lets managers see their team members without keeping a local copy of the entire company org chart.
  - **Configuration**: Powered by `ERP_SUBORDINATES_URL` (uses `ERP_USERNAME` / `ERP_PASSWORD`).

- **`fetchEmployeeDetailsForServiceNo`**:
  - **What it does**: Fetches the exact HR profile for a specific employee number (including cost center, department, and email).
  - **Where it is used**: Extensively used by `learnerController.js`. If an employee logs in but doesn't have an LPMS account yet, this API fetches their ERP details and creates their account automatically on the fly.
  - **Configuration**: Powered by `ERP_DETAILS_URL` (uses `ERP_USERNAME` / `ERP_PASSWORD`).

- **`fetchEmployeesByPartialName`**:
  - **What it does**: Provides a basic search function to find employees by their name.
  - **Where it is used**: Used by admin controllers when searching for specific employees to view their records or assign training.
  - **Configuration**: Powered by `ERP_PART_NAME_URL` (uses `ERP_SEARCH_USERNAME` / `ERP_SEARCH_PASSWORD`).

- **`fetchEmployeesByFilters`**:
  - **What it does**: Provides an advanced search to filter employees by `designation` (job title), `gradeName` (pay grade), `orgName` (department), and `payroll`.
  - **Where it is used**: Used by `learningAdminController.js`. Admins use this to find target groups of employees (e.g., "All Engineers in the IT department") and enroll them in learning paths in bulk.
  - **Configuration**: Powered by `ERP_EMPLOYEE_FILTER_URL` (uses `ERP_SEARCH_USERNAME` / `ERP_SEARCH_PASSWORD`).
  - _Note: `ERP_HIERARCHY_URL` is an old URL kept for legacy reasons and is not used in the main workflows._

#### 2. Organizational Master Data

- **`fetchAllDesignations`**:
  - **What it does**: Returns a complete list of all job titles in the company.
  - **Where it is used**: Populates the dropdown menus in the Learning Admin screens so paths can be assigned to specific job titles.
  - **Configuration**: Powered by `ERP_DESIGNATIONS_URL` (uses `ERP_SEARCH_USERNAME` / `ERP_SEARCH_PASSWORD`).

- **`fetchAllSalaryGrades`**:
  - **What it does**: Returns a complete list of all pay grades.
  - **Where it is used**: Populates dropdown menus to allow bulk assignments based on seniority or pay grade.
  - **Configuration**: Powered by `ERP_SALARY_GRADES_URL` (uses `ERP_SEARCH_USERNAME` / `ERP_SEARCH_PASSWORD`).

- **`fetchOrganizationList`**:
  - **What it does**: Retrieves a list of all company departments (using a `GET` request).
  - **Where it is used**: Populates department dropdown menus in the Learning Admin screens, making it possible to assign training to entire divisions.
  - **Configuration**: Powered by `ERP_ORGANIZATIONS_URL` (uses `ERP_SEARCH_USERNAME` / `ERP_SEARCH_PASSWORD`).

#### 3. External/Legacy Course Data

- **`fetchAllCourses`**:
  - **What it does**: Retrieves the master catalog of external courses directly from the ERP.
  - **Where it is used**: Used in `learningAdminController.js`. It lets admins search for ERP-hosted courses and include them alongside local courses when building a new Learning Path.
  - **Configuration**: Powered by `ERP_COURSES_URL` (uses `ERP_SEARCH_USERNAME` / `ERP_SEARCH_PASSWORD`).

- **`fetchClassesByCourseCode`**:
  - **What it does**: Gets information about scheduled class sessions (batches, dates, locations) for a specific ERP course.
  - **Where it is used**: Allows Learning Admins to assign users to specific scheduled sessions (physical or virtual) that are managed in the ERP system.
  - **Configuration**: Powered by `ERP_CLASSES_URL` (uses `ERP_SEARCH_USERNAME` / `ERP_SEARCH_PASSWORD`).

- **`fetchCourseEnrollmentDetails`**:
  - **What it does**: Retrieves a specific employee's past training history and external enrollments directly from the ERP.
  - **Where it is used**: Used by `learnerController.js`. It merges this ERP history with local LPMS progress, giving the user a unified "My Progress" dashboard that shows both old and new training records.
  - **Configuration**: Powered by `ERP_COURSE_ENROLLMENTS_URL` (uses `ERP_USERNAME` / `ERP_PASSWORD`).
