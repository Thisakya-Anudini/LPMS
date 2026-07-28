# LPMS Database & ERP APIs Inspection Report

---

## Database Inspection by DB Migration Files

### 1. auth_principals (001_create_roles_and_auth_principals.sql)

- **Importance to the Project**: High - This is the core identity and authentication table.
- **Where it is Important**: Used system-wide (Login, Role-based Access Control, Audit Logs, and User Profiles). It serves as the master record for any actor in the system.
- **Frontend Pages Used**:
  - `LoginPage.tsx` (`/login`)
  - `ChangePasswordPage.tsx` (`/change-password`)
  - `AdminDashboard` (`/admin/accounts`)
  - `AdminLearnersPage` (`/admin/learners`)
- **What it Does**: Stores fundamental user credentials (email, hashed password), system roles (`SUPER_ADMIN`, `LEARNING_ADMIN`, `SUPERVISOR`, `EMPLOYEE`), and basic status. It acts as the primary foreign key for almost all user-associated records.
- **Is it Actually Needed?**: Yes. Even if employee details come from the ERP, the LPMS needs a local authenticable identity (with LPMS-specific roles and passwords) to manage access securely.

### 2. employees (002_create_users_employees_refresh_tokens.sql)

- **Importance to the Project**: High - Extends `auth_principals` with organizational context.
- **Where it is Important**: Learner Management, Supervisor Dashboards, and ERP Integration workflows.
- **Frontend Pages Used**:
  - `AdminEmployeeHierarchyPage` (`/admin/hierarchy`)
  - `SupervisorDashboard` (`/supervisor`)
  - `AdminLearnerDetailsPage` (`/admin/learners/:id`)
- **What it Does**: Stores organization-specific details like `employee_number`, `designation`, `grade_name`, and supervisor hierarchy (`supervisor_id`). It links back to `auth_principals` via `principal_id`.
- **Is it Actually Needed?**: Yes. While this data is initially populated by the ERP APIs, having a local table (local cache) is crucial. It allows the LPMS to query supervisors, filter learners by designation, and manage relationships locally without making an external ERP API call for every single database query.

### 3. refresh_tokens (002_create_users_employees_refresh_tokens.sql)

- **Importance to the Project**: High - Critical for system security and session management.
- **Where it is Important**: Authentication flow.
- **Frontend Pages Used**: Does not have a dedicated UI page, but heavily impacts `LoginPage.tsx` and the global `AuthProvider` which wraps the entire application (`App.tsx`).
- **What it Does**: Stores hashed refresh tokens associated with a user, along with their expiration and revocation timestamps.
- **Is it Actually Needed?**: Yes. This is a standard security practice for JWT-based auth systems, ensuring users can maintain sessions without storing long-lived access tokens, completely independent of the ERP.

### 4. learning_paths (003_create_learning_path_domain.sql)

- **Importance to the Project**: Very High - This is the central domain entity of the LPMS (Learning Path Management System).
- **Where it is Important**: Course Structuring, Admin Dashboards, Learner Catalogs, and Enrollments.
- **Frontend Pages Used**:
  - `LearningPathManagement` (`/learning-admin/paths/*`)
  - `AdminLearningPathsPage` (`/admin/learning-paths`)
  - `LearnerPublicPathsPage` (`/learner/public-paths`)
  - `LearnerMyProgressPage` (`/learner/my-progress`)
- **What it Does**: Defines a learning path wrapper, containing metadata like title, description, category (RESTRICTED/PUBLIC), and publication status (DRAFT/ACTIVE/ARCHIVED).
- **Is it Actually Needed?**: Yes. This is a purely local LPMS concept that groups courses together into a journey. It is fundamental to the project's purpose.

### 5. learning_path_stages (003_create_learning_path_domain.sql)

- **Importance to the Project**: High - Provides structural organization to learning paths.
- **Where it is Important**: Course Sequencing, Learner Progress Tracking.
- **Frontend Pages Used**:
  - `LearningPathManagement` (Creation/Editing wizards)
  - `AdminLearningPathDetailsPage` (`/admin/learning-paths/:id`)
  - `LearnerMyProgressPage` (Rendering the stages of an enrolled path)
- **What it Does**: Represents a distinct step or stage within a learning path, dictating the order (`stage_order`) in which courses should be presented or completed.
- **Is it Actually Needed?**: Yes. It is required to support multi-step learning journeys within the LPMS.

### 6. courses (003_create_learning_path_domain.sql)

- **Importance to the Project**: Very High - Core to the learning aspect.
- **Where it is Important**: Course catalogs, learning paths, stage course linking, ERP sync.
- **Frontend Pages Used**:
  - `LearningPathManagement` (Adding/selecting courses to add to stages)
  - `AdminLearningPathDetailsPage`
- **What it Does**: Stores details of individual training units, including a unique `code`, `title`, `description`, `duration`, and `type` (ONLINE, CLASSROOM, HYBRID).
- **Is it Actually Needed?**: Yes. While `fetchAllCourses` API suggests that courses might be fetched or synced from an ERP, the LPMS needs local representations of these courses to link them to its `learning_path_stages` and track completions within learning paths locally.

### 7. stage_courses (003_create_learning_path_domain.sql)

- **Importance to the Project**: High.
- **Where it is Important**: Structuring the curriculum of a learning path.
- **Frontend Pages Used**: Handled behind the scenes during the `LearningPathManagement` creation flow.
- **What it Does**: Acts as a many-to-many junction table between `learning_path_stages` and `courses`. It allows multiple courses to belong to a stage.
- **Is it Actually Needed?**: Yes. It's a required and normalized way to handle many-to-many relationships in a relational database.

### 8. enrollments (004_create_enrollments_progress_notifications.sql)

- **Importance to the Project**: Very High - The core transaction of the system.
- **Where it is Important**: Learner dashboards, Supervisor dashboards, admin reports, progress tracking.
- **Frontend Pages Used**:
  - `LearnerMyProgressPage` (`/learner/my-progress`)
  - `SupervisorDashboard` (`/supervisor` - tracking team enrollments)
  - `LearningPathManagement` (Assign section)
- **What it Does**: Connects `auth_principals` (the user) to `learning_paths`. It tracks the overall `status` (NOT_STARTED, IN_PROGRESS, COMPLETED, OVERDUE), `progress` percentage, enrollment date, completion date, and supervisor `approval_status`.
- **Is it Actually Needed?**: Yes. Without enrollments, the LPMS doesn't know who is learning what. It is purely local application state.

### 9. enrollment_progress (004_create_enrollments_progress_notifications.sql)

- **Importance to the Project**: High.
- **Where it is Important**: Detailed learner progress tracking.
- **Frontend Pages Used**:
  - `LearnerMyProgressPage` (`/learner/my-progress`)
- **What it Does**: Tracks the progress of an `enrollment` at the granular level of a `stage_id`. It allows the system to know exactly how far along a user is within a multi-stage learning path.
- **Is it Actually Needed?**: Yes. It's needed for detailed analytics and resuming learning journeys accurately at specific stages.

### 10. notifications (004_create_enrollments_progress_notifications.sql)

- **Importance to the Project**: Medium.
- **Where it is Important**: Application header (bell icon), user engagement.
- **Frontend Pages Used**:
  - `NotificationsPage.tsx` (`/notifications`)
  - `DashboardLayout.tsx` (Global header)
- **What it Does**: Stores in-app alerts sent to users (`principal_id`), with a `title`, `message`, `type` (INFO, SUCCESS, WARNING, ERROR), and an `is_read` flag.
- **Is it Actually Needed?**: Yes. It keeps users informed about new course assignments, enrollment approvals, and deadlines natively within the LPMS.

### 11. audit_logs (004_create_enrollments_progress_notifications.sql)

- **Importance to the Project**: High for compliance and security.
- **Where it is Important**: System administration, security reviews.
- **Frontend Pages Used**: No dedicated UI currently mapped in `App.tsx`, but heavily used by backend monitoring and system audits.
- **What it Does**: Records sensitive actions performed in the system. It tracks the `actor_principal_id` (who did it), `action` (e.g., FETCH_ERP_LEARNER_DETAILS), `resource_type`, and a JSONB payload of `metadata`.
- **Is it Actually Needed?**: Yes. Having an immutable log of who changed what or fetched sensitive data from the ERP is crucial for compliance in an enterprise application.

---

## ERP APIs Inspection (Technical Reference)

> [!NOTE]
> This section is written to onboard new developers, detailing exactly how the LPMS communicates with the external corporate ERP system.

### Overview

The LPMS interacts with an external ERP system via a dedicated client (`server/utils/erpClient.js`) and controllers (`server/controllers/integrationController.js`). The ERP acts as the "Source of Truth" for human resources and corporate structure.

### Technical Implementation Details

- **Authentication**: The ERP requires specific headers for every request. Specifically, the headers `UserName` and `Password` must be passed. These are sourced from `.env` variables (`ERP_USERNAME`, `ERP_PASSWORD`, `ERP_SEARCH_USERNAME`, `ERP_SEARCH_PASSWORD`).
- **HTTP Methods**: Most endpoints use `POST` with JSON bodies, except for fetching organizations which uses `GET`.
- **Data Hydration (`importErpEmployees`)**: The primary integration orchestrator is the `importErpEmployees` function in `integrationController.js`. It takes arrays of ERP employees and provisions local `auth_principals` and `employees` records, creating a local copy of the user and automatically hashing a default password (`ERP_IMPORTED_DEFAULT_PASSWORD`).

### Specific Endpoints and their Roles

1. **Employee Details & Hierarchy**
   - `fetchEmployeeSubordinates`: Accepts an `employeeNo` and returns a list of their direct reports. Used heavily to build the Supervisor Dashboards.
   - `fetchEmployeeDetailsForServiceNo`: Fetches an exact match for an employee number. It automatically appends a default cost center (`ERP_DEFAULT_COST_CENTER_CODE`) and organization ID (`ERP_DEFAULT_ORGANIZATION_ID`).
   - `fetchEmployeesByPartialName`: A search endpoint for employee name lookups.
   - `fetchEmployeesByFilters`: Advanced search allowing filtering by `designation`, `gradeName`, `orgName`, and `payroll`.

2. **Organizational Master Data**
   - `fetchAllDesignations`: Returns all possible job titles.
   - `fetchAllSalaryGrades`: Returns all possible pay grades.
   - `fetchOrganizationList`: Returns all organizational units via a `GET` request.
   - _Use Case_: These endpoints allow LPMS admins to assign Learning Paths dynamically to users based on their corporate position rather than selecting individual names.

3. **External/Legacy Course Data**
   - `fetchAllCourses` & `fetchClassesByCourseCode`: Fetches the external course catalog from the ERP.
   - `fetchCourseEnrollmentDetails`: Retrieves an employee's legacy enrollment records from the ERP.
   - _Use Case_: The LPMS acts as an overlay on top of existing corporate training, allowing users to see their old ERP training records within the modern LPMS interface.
