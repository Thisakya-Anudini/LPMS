# LPMS Backend Unit Testing Guide

## Overview & Philosophy

The LPMS (Learning Path Management System) backend utilizes a robust, **zero-dependency** unit testing architecture. We use the native Node.js test runner (`node:test`) and strict assertions (`node:assert/strict`).

**Key Testing Principles:**

- **Absolute Isolation:** Tests must never connect to a real database, ERP system, or external email service.
- **Speed & Lightweight:** By avoiding heavy frameworks like Jest or Mocha, tests execute in milliseconds.
- **Behavioral Verification:** Tests focus on business logic—validating request parsing, data transformation, role-based access, and correct HTTP response codes.
- **State Resetting:** Every individual test must invoke `setupMockDatabase()` to guarantee a clean state and prevent test pollution.

---

## Testing Stack

- **Test Runner**: Node.js Native (`node:test`)
- **Assertions**: Node.js Strict (`node:assert/strict`)
- **Environment Variables**: Overridden at the top of files (e.g., `process.env.SECRET_KEY = "test-secret-key-for-testing"`).

---

## Test Architecture & The Mocking Engine

Because we do not use an external mocking library (like Sinon or Jest Mocks), every test file implements a custom "Mocking Engine".

### 1. Express Objects (Req/Res)

Each test file contains factory functions to simulate Express HTTP objects:

- `createMockReq(overrides = {})`: Generates a request object containing `body`, `params`, `query`, and `headers`. It also injects a mock authenticated `user` context (e.g., `user: { id: "user-1", role: "EMPLOYEE" }`).
- `createMockRes()`: Simulates the response object, exposing chainable `.status(code)` and `.json(data)` methods, while tracking the final `statusCode` and `body` payload for assertions.
- `sendMockError(res, status, code, message, details)`: A helper utility used in complex controllers (like Integration and Learning Admin) to simulate standardized error payloads.

### 2. In-Memory Database (`mockDatabase`)

Instead of an actual PostgreSQL instance, we define a localized `let mockDatabase = {}` state.
The `setupMockDatabase()` function populates this object with arrays representing tables:

```javascript
mockDatabase = {
  principals: [...],
  employees: [...],
  learning_paths: [...],
  enrollments: [...],
  notifications: [...],
  certificates: [...]
};
```

_Crucial Rule:_ `setupMockDatabase()` must be called at the beginning of every `t.test()` block to prevent state leakage between assertions.

### 3. PostgreSQL Interceptor (`mockQuery`)

We mock the `pg` driver using a custom `mockQuery(sql, params = [])` interceptor.
It evaluates the incoming `sql` string using `.includes()` and returns standard PostgreSQL results `{ rows: [], rowCount: 0 }`.

**Example Pattern:**

```javascript
if (sql.includes("SELECT id, title FROM learning_paths WHERE id = $1")) {
  const pathId = params[0];
  const path = mockDatabase.learning_paths.find(
    (p) => p.id === pathId && !p.is_deleted,
  );
  return { rows: path ? [path] : [], rowCount: path ? 1 : 0 };
}
```

_Note on Mutations:_ If the query is an `INSERT`, `UPDATE`, or `DELETE`, `mockQuery` actually modifies the `mockDatabase` arrays so subsequent assertions can verify the state change.

### 4. External Services (ERP & Bcrypt)

- **`mockErpClient`**: Simulates the external HR/ERP system. Exposes methods like `fetchEmployeeDetailsForServiceNo` and `fetchEmployeeSubordinates`, returning predefined API response structures. It is also used to simulate ERP failure states (e.g., passing `"ERP-ERROR"` to trigger a `503` error).
- **`mockBcrypt`**: Bypasses actual CPU-intensive hashing. `hash` returns simple strings (`hashed-${password}`), and `compare` runs simple string equality checks.

### 5. Side-Effect Trackers (Audits & Emails)

To verify that the system correctly logs actions and sends emails, we use array accumulators:

```javascript
let auditLogs = [];
let sentEmails = [];

const mockLogAudit = async (audit) => {
  auditLogs.push(audit);
};
const mockSendLearningPathAssignedEmail = async (payload) => {
  sentEmails.push(payload);
};
```

Tests can then assert `assert.equal(auditLogs.length, 1)` and verify `auditLogs[0].action`. Arrays must be cleared (`auditLogs = []`) inside the test before acting.

---

## Controller Test Coverage Map

Currently, the test suite covers the following 8 core controllers:

1. **Auth Controller** (`authController.test.js`)
   - Export validation ensuring all 5 controller functions (`login`, `refresh`, `logout`, `me`, `changePassword`) are properly exported as functions.
   - Login authentication with bcrypt password comparison, returning `401` for invalid credentials and gracefully handling non-existent users.
   - Case-insensitive and whitespace-trimmed email normalization applied during login and lookups.
   - Employee context resolution on login including `isSupervisor` (ERP subordinate check) and `isLearningAdmin` (assignment table check).
   - Role-specific payload inclusion for `SUPER_ADMIN`, `LEARNING_ADMIN`, and `EMPLOYEE` principals with distinct role separation.
   - Refresh token lifecycle management covering valid token acceptance, and rejection of expired (`expires_at < now`) or revoked (`revoked_at` set) tokens.
   - Logout via refresh token revocation, handling idempotent revocation gracefully across multiple logout attempts.
   - `/me` profile endpoint returning full principal fields with employee context (`isSupervisor`, `isLearningAdmin`), returning `404` for missing users.
   - Password change flow requiring both `oldPassword` and `newPassword`, rejecting short passwords (under 8 characters), wrong current passwords, and blocking `ERP_LEARNER` auth source.
   - Refresh token bulk revocation triggered after successful password change for the affected principal.
   - Edge case coverage for empty strings, mixed-case emails, and correct token expiry boundary comparisons.
2. **Employee Controller** (`employeeController.test.js`)
   - Export validation ensuring all 7 controller functions (`getMyPaths`, `getPublicPaths`, `getMyProgress`, `getNotifications`, `getMyCertificates`, `updateMyEnrollmentProgress`, `selfEnrollPublicPath`) are properly exported as functions.
   - Learner enrollment visibility scoped to current user only, excluding deleted paths and ordered by `enrolled_at DESC`.
   - Public path filtering restricted to `PUBLIC` category, `ACTIVE` status, and non-deleted records with per-user `already_enrolled` flag.
   - Progress statistics calculation including `total_enrollments`, `completed_enrollments`, and `average_progress` formatted to `(5,2)` decimal precision.
   - Notification retrieval scoped to current user, ordered by `created_at DESC`, capped at 50 records.
   - Certificate retrieval with learning path `JOIN` for title, scoped to current user and ordered by `issued_at DESC`.
   - Enrollment progress update with input validation (numeric, `0–100` range, non-`NaN`), automatic status transitions (`NOT_STARTED` → `IN_PROGRESS` → `COMPLETED`), and `completed_at` lifecycle management.
   - Certificate and notification creation triggered automatically when progress reaches `100%`.
   - Self-enrollment guards rejecting `RESTRICTED`, `SEMI_RESTRICTED`, `INACTIVE`, `ARCHIVED`, deleted paths, and duplicate enrollments.
   - New self-enrollments initialized with `status: NOT_STARTED`, `progress: 0`, `enrollment_source: SELF`, and current timestamp.
   - Audit trail logging for both `UPDATE_ENROLLMENT_PROGRESS` and `SELF_ENROLL_PUBLIC_PATH` actions.
3. **Integration Controller** (`integrationController.test.js`)
   - Export validation ensuring all 3 controller functions (`getErpLearnerDetails`, `getErpSubordinates`, `importErpEmployees`) are properly exported as functions.
   - ERP learner detail lookup requiring a non-empty string `employeeNo`, with whitespace trimming applied before the ERP call.
   - ERP error mapping to `ERP_REQUEST_FAILED` with status passthrough from error objects, defaulting to `502` when no status is present.
   - ERP subordinate fetching with empty subordinate array detection and `isSupervisor` boolean derivation.
   - Audit trail logging for `FETCH_ERP_LEARNER_DETAILS`, `FETCH_ERP_SUBORDINATES`, and `IMPORT_ERP_EMPLOYEES` actions with `resourceType: "ERP"`.
   - Bulk employee import requiring a non-empty `employees` array, with a single bcrypt hash computed once for the entire batch using `ERP_IMPORTED_DEFAULT_PASSWORD` (fallback: `ChangeMe@123`).
   - Per-row skip logic for missing `employeeNumber`, duplicate employee numbers, and duplicate auth principal emails, with skip reasons recorded per row.
   - Email normalization to lowercase with whitespace trimming, and fallback email generation as `{employeeNumber}@{ERP_FALLBACK_EMAIL_DOMAIN}` (fallback domain: `erp.local`).
   - Name normalization preferring `employeeName`, falling back to `{initials} {surname}`, and finally `Employee {employeeNumber}`.
   - Missing `designation` defaulting to `"Employee"` and missing `gradeName` defaulting to `"N/A"`.
   - `supervisorId` stored as `null` when absent or empty.
   - Import response including `importedCount`, `skippedCount`, `imported` and `skipped` arrays, and a `defaultPasswordNote`.
   - Import audit metadata recording `requested`, `imported`, and `skipped` counts.
4. **Learner Controller** (`learnerController.test.js`)
   - Export validation ensuring all 14 controller functions are properly exported as functions.
   - Learner profile `employeeNo` normalization with whitespace trimming and graceful handling of missing values.
   - Dashboard aggregation returning enrolled path details, `completedCount`, and `averageProgress` (rounded integer), with notifications capped at 10 most recent.
   - Team supervisor status derived from ERP subordinate list length, returning `false` for empty subordinate responses.
   - Team enrollment validation requiring non-empty `employeeNumbers` and `learningPathIds` arrays, filtering provided numbers against the supervisor's actual subordinates, and counting total assigned paths.
   - Course list filtering to entries with both valid `courseCode` and `courseName`, with case-insensitive matching and deduplication of associated learning paths.
   - `getLearnerOtherCourses` marking `alreadyEnrolled: true` for courses in the learner's enrolled paths, returning `false` when no principal is resolved.
   - Public learning path listing restricted to `PUBLIC`, `ACTIVE`, non-deleted records with per-user `already_enrolled` flag.
   - `getPublicLearningPathById` returning `404` for missing, deleted, inactive, or non-public paths, and returning path details with stages and courses organized by stage.
   - Self-enrollment rejecting non-`PUBLIC` or non-`ACTIVE` paths, and creating enrollments with `status: NOT_STARTED`, `progress: 0`, `enrollment_source: SELF`, and a `SUCCESS` notification.
   - Course completion update computing enrollment progress as `Math.round((completedCourses / totalCourses) * 100)`, defaulting to `0` when no courses exist, and scoped to the requesting principal's own enrollments.
   - Certificate auto-generation triggered when progress transitions from below `100%` to `100%`, with a corresponding completion notification.
   - Certificate listing returning path title via JOIN, ordered by `issued_at DESC`, with empty array returned when no principal exists.
   - Certificate download retrieving the certificate by both `id` and `principal_id`, then fetching associated stages and courses for PDF generation.
5. **Learning Admin Controller** (`learningAdminController.test.js`)
   - Export validation ensuring all 17 controller functions are properly exported as functions.
   - Learning path creation rejecting invalid categories (only `PUBLIC` and `RESTRICTED` allowed), creating paths with `ACTIVE` status, inserting ordered stages and structured stage courses, and logging `CREATE_LEARNING_PATH` audit.
   - Learning path listing returning only non-deleted paths ordered by `created_at DESC`, including `certificate_signer_name` and `certificate_signer_title` fields.
   - `getLearningPathById` returning `404` for missing or deleted paths, returning path details with stages and courses attached per stage.
   - Learning path update applying only provided fields (patch semantics), replacing all stages when a `stages` array is supplied, and logging `UPDATE_LEARNING_PATH` audit.
   - Certificate customization listing non-deleted paths sorted alphabetically by title, including `certificate_signature_png`, signer fields, and `updated_at`.
   - Certificate signature update requiring non-empty `signerName` and `signerTitle`, rejecting non-PNG data URLs, validating the base64 payload is non-empty and under 2 MB, returning `MIGRATION_REQUIRED` (500) when the signature column is absent, and logging `UPDATE_CERTIFICATE_SIGNATURE` audit with `hasSignaturePng` metadata.
   - Certificate preview generating a safe filename via `safeCertificateTitle` (alphanumeric-only slug), applying signer override values over stored defaults, and mapping stage courses to title and duration.
   - Learning path soft-delete returning `404` for missing paths and logging `DELETE_LEARNING_PATH` audit.
   - Enrollment creation requiring a non-empty `selectedLearners` array, normalizing learner name (initials+surname fallback) and email (lowercase trim), skipping rows without an employee number, creating enrollments with `status: NOT_STARTED`, `progress: 0`, `enrollment_source: LEARNING_ADMIN`, creating per-learner `INFO` notifications, creating an assignment report, and queuing learning path assignment emails.
   - Assignment report listing returning reports ordered by `assigned_at DESC` with learners attached via `report_id`.
   - Assignment report status update accepting only `ASSIGNED_IN_LPMS` or `ENROLLED_IN_ERP`, returning `404` for missing reports, and logging `UPDATE_ASSIGNMENT_REPORT_STATUS` audit with status metadata.
   - Assignable employee search options normalizing and deduplicating designations and grades (sorted alphabetically), filtering organizations requiring both `organizationId` and `organizationName`, including payroll type options, and mapping ERP errors to `ERP_REQUEST_FAILED` with status passthrough (default `502`).
   - Employee search requiring at least one filter field, normalizing all row fields (whitespace trim, email lowercase), intersecting results across multiple ERP calls, marking `isLearningAdmin` from the assignments table, and sorting results by `employeeName`.
   - Class assignment options returning `404` for missing paths, building course options with `stageTitle` from the stage join, building learner options from path enrollments including existing class assignments.
   - `getClassesByCourseCode` requiring a non-empty trimmed `courseCode`, normalizing ERP class rows (preferring `classId`/`classCode`/`className` with index-based fallback `CLASS-{n+1}`), and mapping ERP errors to `ERP_REQUEST_FAILED`.
   - Class enrollment assignment requiring `learningPathId`, `courseCode`, `class.id`, and non-empty `enrollmentIds`; normalizing class id/code/title; rejecting enrollments not belonging to the path; upserting existing assignments for the same enrollment and course; queuing class assignment emails; and logging `ASSIGN_CLASS_ENROLLMENTS` audit with `assigned` and `requested` counts.
   - Learning summary report computing `totalPaths`, `activePaths`, `totalEnrollments`, `completedEnrollments`, `completionRate` as `Math.round((completed/total)*100)` (returning `0` when no enrollments), and `totalCertificates`.
6. **Notification Controller** (`notificationController.test.js`)
   - Export validation ensuring all 4 controller functions (`getMyNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `clearAllNotifications`) are properly exported as functions.
   - Principal resolution supporting both standard users (`req.user.id`) and temporary `ERP_LEARNER` auth source resolved via `employeeNo` lookup, with whitespace trimming applied.
   - Notification listing scoped to the resolved `principal_id` only, ordered by `created_at DESC`, capped at 100 records, returning an empty array when the principal cannot be resolved.
   - `markNotificationAsRead` returning `404` when the principal cannot be resolved, when the notification `id` does not exist, or when the notification belongs to a different user; returning the updated `{ id, is_read }` object on success.
   - `markAllNotificationsAsRead` updating only unread (`is_read = FALSE`) notifications for the current principal, returning `updatedCount` equal to the number of rows changed, not affecting other users' notifications, and returning `updatedCount: 0` when no principal is resolved.
   - `clearAllNotifications` deleting all notifications for the current principal, returning `deletedCount`, not affecting other users' notifications, returning `deletedCount: 0` when no notifications exist or no principal is resolved.
7. **Super Admin Controller** (`superAdminController.test.js`)
   - Export validation ensuring all 11 controller functions are properly exported as functions.
   - User creation restricted to `SUPER_ADMIN` role only, rejecting all other roles with a `VALIDATION_ERROR`, defaulting `name` to the email username prefix when absent, hashing passwords at 10 rounds, and logging `CREATE_USER` audit with role and email metadata.
   - User listing returning only `SUPER_ADMIN` and `LEARNING_ADMIN` principals (excluding `EMPLOYEE`), ordered by `created_at DESC`, with full principal fields including `is_active` and `principal_type`.
   - Learning admin assignment listing joining employee and principal tables for designation, grade, name, email, and `is_active`, ordered by `updated_at DESC`.
   - User deletion preventing self-deletion, returning `404` for missing users, rejecting deletion of `EMPLOYEE` principals, and logging `DEACTIVATE_USER` audit.
   - Learning admin assignment requiring a non-empty trimmed `employeeNumber`, returning `404` when the employee is not found, rejecting inactive accounts, upserting the assignment record, and logging `ASSIGN_LEARNING_ADMIN` audit.
   - Learning admin removal requiring a non-empty trimmed `employeeNumber` param, returning `404` when no assignment exists, removing the record, and logging `REMOVE_LEARNING_ADMIN` audit.
   - Learner listing with pagination defaulting to `page: 1`, `pageSize: 25`, clamping `pageSize` to the range `1–100`, computing offset as `(page - 1) * pageSize`, and calculating `totalPages` as `Math.ceil(total / pageSize)` (returning `0` when total is zero).
   - Learner list supporting filters by `employeeNo`, `name`, and `designation`, with each row including `is_learning_admin` flag, `total_learning_paths`, `completed_learning_paths`, and `average_progress` formatted to `(5,2)` precision.
   - Learner list returning sorted `designationOptions` derived from all employee records.
   - `getLearnerLearningPaths` returning `404` for missing principals or non-`EMPLOYEE` roles, returning learner details with enrollments excluding deleted learning paths.
   - `getLearnerLearningPathsByEmployeeNo` requiring a non-empty trimmed `employeeNo` param, returning `404` when no employee is found, resolving `principal_id` from the employee record, and delegating to the same learning paths payload.
   - Learning path enrollments returning `404` for missing or deleted paths, returning path details with enrollments joined to principal and employee fields, ordered by `enrolled_at DESC`.
   - Employee creation rejecting duplicate employee numbers with `409 CONFLICT`, defaulting name from email prefix, creating an `EMPLOYEE` principal with `principal_type: "EMPLOYEE"`, storing `supervisorId` as `null` when absent or empty, and logging `CREATE_EMPLOYEE` audit.
8. **Supervisor Controller** (`supervisorController.test.js`)
   - Export validation ensuring all 7 controller functions are properly exported as functions.
   - Team listing filtered by `employees.supervisor_id` matching the requesting supervisor, excluding employees from other supervisors, ordered by `name ASC`, with full employee and principal fields returned.
   - Team progress aggregation per member computing `total_enrollments`, `avg_progress` (formatted to `(5,2)`), and `completed_count`, returning `"0.00"` and zero counts for members with no enrollments.
   - Pending approvals scoped to the supervisor's team only (via `principal_id` set intersection), returning enrollment fields (`approval_status`, `status`, `progress`, `enrolled_at`), learner fields, and learning path fields, ordered by `enrolled_at DESC`.
   - `getSupervisorPaths` returning an empty `learningPaths` array, not exposing public paths to supervisors.
   - Team enrollment requiring a non-empty `employeePrincipalIds` array, returning `404` for missing or inactive/deleted learning paths, filtering selected IDs to supervisor team members only, creating enrollments with `status: NOT_STARTED`, `progress: 0`, `enrollment_source: SUPERVISOR`, skipping duplicates, creating `INFO` notifications per inserted enrollment, creating an assignment report with `assignmentSource: SUPERVISOR`, and logging `SUPERVISOR_ENROLL_TEAM` audit with `inserted` count.
   - Enrollment approval setting `approval_status: "APPROVED"` with `approval_updated_at` and `approval_updated_by`, returning `404` for missing enrollments or enrollments outside the supervisor's team, and logging `APPROVE_ENROLLMENT` audit.
   - Enrollment rejection setting `approval_status: "REJECTED"` with `approval_updated_at` and `approval_updated_by`, returning `404` for missing enrollments or enrollments outside the supervisor's team, and logging `REJECT_ENROLLMENT` audit.

---

## Test Structure & Conventions

Every test file must follow a strict structural convention:

1. **Environment Setup**: Define `process.env` variables at the absolute top.
2. **Imports**: Import `test`, `assert`, and the controller functions.
3. **Mock Utilities**: Define `createMockReq`, `createMockRes`.
4. **State Definitions**: Define `mockDatabase`, `auditLogs`, and `setupMockDatabase()`.
5. **Interceptors**: Define `mockQuery` and other service mocks.
6. **Exports Test**: The very first `test()` block must verify that the controller exports all expected functions.
7. **Feature Test Blocks**: Grouped by controller function using `t.test()`.

### Example of the Required "Exports Test"

```javascript
test("CONTROLLER EXPORTS TESTS", async (t) => {
  const expectedExports = ["getProfile", "updateProfile"];
  for (const exportName of expectedExports) {
    await t.test(`should export ${exportName}`, async () => {
      assert.equal(typeof myController[exportName], "function");
    });
  }
});
```

---

## Step-by-Step: Writing a New Test

When adding a new test inside an existing file, follow the **Arrange-Act-Assert** pattern.

```javascript
test("UPDATE PROFILE TESTS", async (t) => {
  await t.test("should update user profile successfully", async () => {
    // 1. Arrange: Reset state and set up mocks
    setupMockDatabase();
    auditLogs = []; // Reset side-effect trackers

    const req = createMockReq({
      user: { id: "user-1" },
      body: { name: "Updated Name" },
    });
    const res = createMockRes();

    // 2. Act: Call the controller
    await myController.updateProfile(req, res);

    // 3. Assert: Verify HTTP Response
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    // 4. Assert: Verify Database State Change
    const user = mockDatabase.principals.find((p) => p.id === "user-1");
    assert.equal(user.name, "Updated Name");

    // 5. Assert: Verify Side-Effects (Audits)
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "UPDATE_PROFILE");
  });

  await t.test("should reject missing parameters", async () => {
    const req = createMockReq({ body: {} }); // Missing name
    const res = createMockRes();

    await myController.updateProfile(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });
});
```

---

## Running the Tests

Because the suite runs entirely natively with Node.js's built-in test runner, no additional test framework installation is required. You can trigger it directly from the command line:

**Run all tests in the suite:**

```bash
node --test tests/**/*.test.js
```

_(Or simply `npm test` if configured in your `package.json`)_

**Run a specific controller's test:**

```bash
node --test tests/authController.test.js
node --test tests/learningAdminController.test.js
```

**Run tests matching a name pattern:**

```bash
node --test --test-name-pattern="LOGIN" tests/**/*.test.js
```

**Run tests with verbose output:**

```bash
node --test --reporter=spec tests/**/*.test.js
```

**Run tests with coverage (Node.js v18.15+):**

```bash
node --test --experimental-test-coverage tests/**/*.test.js
```

**Run tests with coverage for a specific file:**

```bash
node --test --experimental-test-coverage tests/employeeController.test.js
```

> **Note:** The `SECRET_KEY` environment variable is auto-set to a test fallback inside each file (`test-secret-key-for-testing`), so no `.env` setup is required to run the suite. For CI environments, you can still override it explicitly:

```bash
SECRET_KEY=your-ci-secret node --test tests/**/*.test.js
```
