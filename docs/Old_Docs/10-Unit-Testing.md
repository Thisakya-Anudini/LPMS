# LPMS Backend Unit Testing Guide

## Overview & Philosophy

The LPMS (Learning Path Management System) backend utilizes a **vitest** unit testing architecture. We use `vitest` as the test runner with its built-in `expect` assertion library and `vi` mocking utilities.

**Key Testing Principles:**

- **Absolute Isolation:** Tests must never connect to a real database, ERP system, or external email service. All external dependencies are mocked via `vi.mock()`.
- **Speed & Lightweight:** By using vitest with lightweight inline mocks, tests execute in milliseconds.
- **Behavioral Verification:** Tests focus on business logic—validating request parsing, data transformation, role-based access, and correct HTTP response codes.
- **State Resetting:** Every test file uses `beforeEach(() => { vi.clearAllMocks(); })` to guarantee a clean mock state and prevent test pollution.

---

## Testing Stack

- **Test Runner**: vitest (`describe`, `it`, `expect`)
- **Mocking Framework**: vitest (`vi.mock`, `vi.fn`, `vi.mocked`, `vi.clearAllMocks`, `vi.resetAllMocks`)
- **Environment Variables**: Overridden at the top of test files or via `process.env` assignment (e.g., `process.env.SECRET_KEY = "test-secret-key-for-testing"`).

---

## Test Architecture & The Mocking Engine

### 1. Express Objects (Req/Res)

Each test file contains factory functions to simulate Express HTTP objects:

- `createMockReq(overrides = {})`: Generates a request object containing `body`, `params`, `query`, and `headers`. It also injects a mock authenticated `user` context (e.g., `user: { id: "user-1", role: "EMPLOYEE" }`). Complex overrides can target nested properties via `...baseReq.user, ...overrides.user` spread patterns.
- `createMockRes()`: Simulates the response object, exposing chainable `.status(code)` and `.json(data)` methods, while tracking the final `statusCode` and `body` payload for assertions.

**Example from authController.test.js:**

```javascript
const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    _headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    header(key, value) {
      if (value !== undefined) {
        this._headers[key] = value;
      }
      return this._headers[key];
    },
  };
  return res;
};

const createMockReq = (overrides = {}) => ({
  body: {},
  headers: {},
  user: null,
  header(name) {
    return this.headers[name];
  },
  ...overrides,
});
```

### 2. Vitest Module Mocking (`vi.mock`)

Instead of custom `mockQuery` interceptors or in-memory database objects, every test file uses vitest's module mocking system:

```javascript
vi.mock("../db.js", () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

vi.mock("../utils/audit.js", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/http.js", () => ({
  sendError: vi.fn((res, status, code, message, details) => {
    res.statusCode = status;
    res.body = { error: { code, message } };
    if (details) {
      res.body.error.details = details;
    }
    return res;
  }),
}));
```

**Key Rules:**

- All `vi.mock()` calls must be placed **at the top** of the test file, before any `import` statements.
- Each mock provides default implementations (usually `vi.fn().mockResolvedValue()`).
- Individual tests override specific mock behaviors using `vi.mocked().mockResolvedValueOnce()` or `vi.mocked().mockRejectedValueOnce()`.

### 3. Mock Behavior Per Test (`vi.mocked`)

Vitest's `vi.mocked()` utility provides TypeScript-friendly access to mock functions. Tests use a pattern of chaining `.mockResolvedValueOnce()`, `.mockRejectedValueOnce()`, or `.mockImplementation()` to control what the mock returns for each call.

**Example Pattern:**

```javascript
vi.mocked(query).mockResolvedValueOnce({
  rows: [mockPrincipal],
  rowCount: 1,
});
vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
vi.mocked(signAccessToken).mockReturnValue("access-token-1");
```

For sequential calls, simply chain additional `mockResolvedValueOnce` calls:

```javascript
vi.mocked(query)
  .mockResolvedValueOnce({ rows: [{ present: true }], rowCount: 1 })
  .mockResolvedValueOnce({ rows: [{ present: true }], rowCount: 1 })
  .mockResolvedValueOnce({
    rows: mockEnrollments,
    rowCount: 3,
  });
```

### 4. External Services (ERP & Bcrypt)

- **ERP Client**: Mocked at the module level with default rejection:

```javascript
vi.mock("../utils/erpClient.js", () => ({
  fetchEmployeeDetailsForServiceNo: vi
    .fn()
    .mockRejectedValue(new Error("No ERP mock set for this test")),
  fetchEmployeeSubordinates: vi
    .fn()
    .mockResolvedValue({ success: true, message: "", data: [] }),
}));
```

Each test then overrides the specific ERP method as needed:

```javascript
vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({
  data: [{ employeeNo: "12346" }],
});
```

- **Bcrypt**: Mocked to bypass actual CPU-intensive hashing:

```javascript
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}));
```

Tests then set return values: `vi.mocked(bcrypt.compare).mockResolvedValueOnce(true)`.

### 5. Side-Effect Trackers (Audits & Emails)

To verify that the system correctly logs actions and sends emails, we use vitest's mock tracking:

```javascript
import { logAudit } from "../utils/audit.js";

// Inside test:
expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
  actorPrincipalId: "user-1",
  action: "UPDATE_ENROLLMENT_PROGRESS",
  resourceType: "ENROLLMENT",
  resourceId: "enroll-1",
});
```

**Key patterns:**

- `vi.mocked(logAudit).mock.calls.length` — count invocations
- `vi.mocked(logAudit).mock.calls[0][0]` — first argument of first call
- `vi.mocked(logAudit).mock.calls[0][0].metadata` — nested metadata assertions
- `vi.mocked(query).mock.calls.filter(([sql]) => sql.includes("UPDATE"))` — filter by SQL statement
- `expect(vi.mocked(query)).not.toHaveBeenCalled()` — verify no calls were made

---

## Controller Test Coverage Map

Currently, the test suite covers the following **8 core controllers**:

### 1. Auth Controller (`authController.test.js`)

- **Exported Functions (5):** `login`, `refresh`, `logout`, `me`, `changePassword`
- Login authentication with bcrypt password comparison, returning `401` for invalid credentials and gracefully handling non-existent users.
- Case-insensitive and whitespace-trimmed email normalization applied during login and lookups.
- Employee context resolution on login including `isSupervisor` (ERP subordinate check) and `isLearningAdmin` (assignment table check).
- Role-specific payload inclusion for `SUPER_ADMIN`, `LEARNING_ADMIN`, and `EMPLOYEE` principals with distinct role separation.
- Supervisor DB role (`SUPERVISOR`) mapped to `EMPLOYEE` in response.
- `username` field support as alias for `email` during login.
- `mustChangePassword` flag included in login response for users with `must_change_password: true`.
- Login support for Temporary ERP Learners not in local DB via `buildTemporaryErpLearner`.
- ERP Learner login succeeds even when ERP service is offline (falls back to employee number as name).
- Refresh token lifecycle management covering valid token acceptance, and rejection of expired (`expires_at < now`) or revoked (`revoked_at` set) tokens.
- Logout via refresh token revocation, handling idempotent revocation gracefully across multiple logout attempts.
- Temporary ERP Learner logout bypasses DB token lookup.
- `/me` profile endpoint returning full principal fields with employee context (`isSupervisor`, `isLearningAdmin`), returning `404` for missing or deactivated users.
- Temporary ERP Learner `/me` returns profile from JWT payload bypassing DB.
- Password change flow requiring both `oldPassword` and `newPassword`, rejecting short passwords (under 8 characters), wrong current passwords, and blocking `ERP_LEARNER` auth source.
- Refresh token bulk revocation triggered after successful password change for the affected principal.
- Edge case coverage for empty strings, mixed-case emails, correct token expiry boundary comparisons, and same-password rehash.
- **DOCUMENTED VULNERABILITY:** Refresh endpoint does not check `is_active` flag — deactivated users can still refresh tokens.

### 2. Employee Controller (`employeeController.test.js`)

- **Exported Functions (7):** `getMyPaths`, `getPublicPaths`, `getMyProgress`, `getNotifications`, `getMyCertificates`, `updateMyEnrollmentProgress`, `selfEnrollPublicPath`
- Learner enrollment visibility scoped to current user only, excluding deleted paths and ordered by `enrolled_at DESC`.
- Public path filtering restricted to `PUBLIC` category, `ACTIVE` status, and non-deleted records with per-user `already_enrolled` flag via `LEFT JOIN`.
- Progress statistics calculation including `total_enrollments`, `completed_enrollments`, and `average_progress` formatted to `(5,2)` decimal precision.
- Notification retrieval scoped to current user, ordered by `created_at DESC`, capped at 50 records.
- Certificate retrieval with learning path `JOIN` for title, scoped to current user and ordered by `issued_at DESC`.
- Enrollment progress update with input validation (numeric, `0–100` range, non-`NaN`), automatic status transitions (`NOT_STARTED` → `IN_PROGRESS` → `COMPLETED`), and `completed_at` lifecycle management (set when ≥100, cleared via `ELSE NULL` when <100).
- Certificate and notification creation triggered automatically when progress reaches `100%`.
- Self-enrollment guards rejecting `RESTRICTED`, `SEMI_RESTRICTED`, `INACTIVE`, `ARCHIVED`, deleted paths, and duplicate enrollments.
- New self-enrollments initialized with `status: NOT_STARTED`, `progress: 0`, `enrollment_source: SELF`, and current timestamp.
- Audit trail logging for both `UPDATE_ENROLLMENT_PROGRESS` and `SELF_ENROLL_PUBLIC_PATH` actions.
- Graceful handling of missing `req.user` (rejects with error).
- 201 status code returned on successful self-enrollment.

### 3. Integration Controller (`integrationController.test.js`)

- **Exported Functions (3):** `getErpLearnerDetails`, `getErpSubordinates`, `importErpEmployees`
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
- **CONTROLLER GAP:** `importErpEmployees` has no role-based authorization.
- Private helper tests for `getErrorStatus`, `normalizeName`, `normalizeEmail`.

### 4. Learner Controller (`learnerController.test.js`)

- **Exported Functions (14):** `getLearnerProfile`, `getLearnerDashboard`, `getLearnerTeam`, `enrollLearnerTeam`, `getCourses`, `getLearnerOtherCourses`, `getLearningPaths`, `getPublicLearningPaths`, `getPublicLearningPathById`, `selfEnrollPublicLearningPath`, `getLearnerPathCourses`, `updateLearnerCourseCompletion`, `getLearnerCertificates`, `downloadLearnerCertificate`
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
- PDF engine error handling returning `PDF_ENGINE_NOT_AVAILABLE` (500).
- **DOCUMENTED GAP:** `downloadLearnerCertificate` does not verify certificate ownership via employeeNo.
- **DOCUMENTED GAP:** `getLearnerPathCourses` does not verify enrollment ownership vs employeeNo.
- Private helper tests for `normalizeNameFromRow`, `isSupervisorFromSubordinateResponse`, `normalizeErpCourse`, `normalizeDisplayValue`, `parseDurationToHours`, `formatDurationHours`, `normalizeDurationDisplay`, `sumCourseDurations`.

### 5. Learning Admin Controller (`learningAdminController.test.js`)

- **Exported Functions (19):** `createLearningPath`, `getLearningPaths`, `getLearningPathById`, `updateLearningPath`, `getCertificateCustomizationPaths`, `updateLearningPathCertificateSignature`, `previewLearningPathCertificate`, `deleteLearningPath`, `createEnrollments`, `getAssignmentReports`, `updateAssignmentReportStatus`, `getAssignableEmployeeSearchOptions`, `searchAssignableEmployees`, `getClassAssignmentOptions`, `getClassesByCourseCode`, `assignClassEnrollments`, `getLearningSummaryReport`, `getClassDetailReport`, `upsertClassDetailReport`
- Learning path creation rejecting invalid categories (only `PUBLIC` and `RESTRICTED` allowed), creating paths with `ACTIVE` status, inserting ordered stages and structured stage courses, and logging `CREATE_LEARNING_PATH` audit.
- Duplicate title detection with overlapping course check returning `409 DUPLICATE_LEARNING_PATH`.
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
- Class detail report retrieval requiring `learningPathId`, `courseCode`, and `classId` query params; auto-creating the table if not exists; returning mapped report values via `mapClassDetailReportRow`.
- Class detail report upsert requiring all three identifiers plus `values` object with 18 normalized fields; returning the upserted report; including `created_by` and `updated_by` principal IDs.
- **DOCUMENTED GAP:** `createLearningPath` and `deleteLearningPath` do not verify user role.
- Private constants/helpers: `CLASS_DETAIL_REPORT_FIELDS` (18 fields), `CLASS_DETAIL_REPORT_COLUMNS`, `mapClassDetailReportRow`, `normalizeClassDetailReportPayload`, `normalizeEmployeeDisplayName`, `normalizeEmployeeRow`, `normalizeOptionList`, `normalizeSignaturePngDataUrl`, `safeCertificateTitle`, `mapLearningAdminAssignments`, `normalizeErpClassRow`, `getSearchErrorStatus`, `normalizeErpCourseCatalog`, `validateLearningPathTitle`, `parseTotalDurationValue`, `parseCategory`.

### 6. Notification Controller (`notificationController.test.js`)

- **Exported Functions (4):** `getMyNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `clearAllNotifications`
- Principal resolution supporting both standard users (`req.user.id`) and temporary `ERP_LEARNER` auth source resolved via `employeeNo` lookup, with whitespace trimming applied.
- Notification listing scoped to the resolved `principal_id` only, ordered by `created_at DESC`, capped at 100 records, returning an empty array when the principal cannot be resolved.
- `markNotificationAsRead` returning `404` when the principal cannot be resolved, when the notification `id` does not exist, or when the notification belongs to a different user; returning the updated `{ id, is_read }` object on success.
- `markAllNotificationsAsRead` updating only unread (`is_read = FALSE`) notifications for the current principal, returning `updatedCount` equal to the number of rows changed, not affecting other users' notifications, and returning `updatedCount: 0` when no principal is resolved.
- `clearAllNotifications` deleting all notifications for the current principal, returning `deletedCount`, not affecting other users' notifications, returning `deletedCount: 0` when no notifications exist or no principal is resolved.
- All notification types handled (`SUCCESS`, `WARNING`, `INFO`, `ERROR`).
- Response shape verification — only expected fields (`id`, `title`, `message`, `type`, `is_read`, `created_at`) are returned.
- Idempotency verified for both `markAllNotificationsAsRead` and `clearAllNotifications`.

### 7. Super Admin Controller (`superAdminController.test.js`)

- **Exported Functions (11):** `createUser`, `getAllUsers`, `getAssignedLearningAdmins`, `deleteUser`, `assignLearningAdmin`, `removeLearningAdmin`, `getAllLearners`, `getLearnerLearningPaths`, `getLearnerLearningPathsByEmployeeNo`, `getLearningPathEnrollments`, `createEmployee`
- User creation restricted to `SUPER_ADMIN` role only, rejecting all other roles with a `VALIDATION_ERROR`, defaulting `name` to the email username prefix when absent, hashing passwords at 10 rounds, and logging `CREATE_USER` audit with role and email metadata.
- User listing returning only `SUPER_ADMIN` and `LEARNING_ADMIN` principals (excluding `EMPLOYEE`), ordered by `created_at DESC`, with full principal fields including `is_active` and `principal_type`. Inactive users are included in results.
- Learning admin assignment listing joining employee and principal tables for designation, grade, name, email, and `is_active`, ordered by `updated_at DESC, name ASC`.
- User deletion preventing self-deletion, returning `404` for missing users, rejecting deletion of `EMPLOYEE` principals, and logging `DEACTIVATE_USER` audit.
- Learning admin assignment requiring a non-empty trimmed `employeeNumber`, returning `404` when the employee is not found, rejecting inactive accounts, upserting the assignment record, and logging `ASSIGN_LEARNING_ADMIN` audit.
- Learning admin removal requiring a non-empty trimmed `employeeNumber` param, returning `404` when no assignment exists, removing the record, and logging `REMOVE_LEARNING_ADMIN` audit.
- Learner listing with pagination defaulting to `page: 1`, `pageSize: 25`, clamping `pageSize` to the range `1–100`, computing offset as `(page - 1) * pageSize`, and calculating `totalPages` as `Math.ceil(total / pageSize)` (returning `0` when total is zero).
- Learner list supporting filters by `employeeNo`, `name`, and `designation`, with each row including `is_learning_admin` flag, `total_learning_paths`, `completed_learning_paths`, and `average_progress` formatted to `(5,2)` precision.
- Learner list returning sorted `designationOptions` derived from all employee records.
- `getLearnerLearningPaths` returning `404` for missing principals or non-`EMPLOYEE` roles, returning learner details with enrollments excluding deleted learning paths.
- `getLearnerLearningPathsByEmployeeNo` requiring a non-empty trimmed `employeeNo` param, returning `404` when no employee is found, resolving `principal_id` from the employee record, and delegating to the same learning paths payload.
- Learning path enrollments returning `404` for missing or deleted paths, returning path details with enrollments joined to principal and employee fields, ordered by `enrolled_at DESC`.
- Employee creation rejecting duplicate employee numbers with `409 CONFLICT`, defaulting name from email prefix, creating an `EMPLOYEE` principal with `principal_type: "EMPLOYEE"`, storing `supervisorId` as `null` when absent or empty, hashing password with bcrypt, and logging `CREATE_EMPLOYEE` audit.
- **DOCUMENTED GAPS:** `createUser` and `createEmployee` do not verify `req.user.role` in the controller; `deleteUser` does not verify target is not `LEARNING_ADMIN` with active enrollments; `getAllLearners` does not validate that designation filter value is valid.

### 8. Supervisor Controller (`supervisorController.test.js`)

- **Exported Functions (7):** `getTeam`, `getTeamProgress`, `getPendingApprovals`, `getSupervisorPaths`, `enrollTeamMembers`, `approveEnrollment`, `rejectEnrollment`
- Team listing filtered by `employees.supervisor_id` matching the requesting supervisor, excluding employees from other supervisors, ordered by `name ASC`, with full employee and principal fields returned.
- Team progress aggregation per member computing `total_enrollments`, `avg_progress` (formatted to `(5,2)`), and `completed_count`, returning `"0.00"` and zero counts for members with no enrollments.
- Pending approvals scoped to the supervisor's team only (via `principal_id` set intersection), returning enrollment fields (`approval_status`, `status`, `progress`, `enrolled_at`), learner fields, and learning path fields, ordered by `enrolled_at DESC`.
- `getSupervisorPaths` returning an empty `learningPaths` array, not exposing public paths to supervisors.
- Team enrollment requiring a non-empty `employeePrincipalIds` array, returning `404` for missing or inactive/deleted learning paths, filtering selected IDs to supervisor team members only, creating enrollments with `status: NOT_STARTED`, `progress: 0`, `enrollment_source: SUPERVISOR`, skipping duplicates via `ON CONFLICT DO NOTHING`, creating `INFO` notifications per inserted enrollment, creating an assignment report with `assignmentSource: SUPERVISOR`, and logging `SUPERVISOR_ENROLL_TEAM` audit with `inserted` count.
- Enrollment approval setting `approval_status: "APPROVED"` with `approval_updated_at` (via `NOW()`) and `approval_updated_by` (via `$2` parameter), returning `404` for missing enrollments or enrollments outside the supervisor's team, and logging `APPROVE_ENROLLMENT` audit.
- Enrollment rejection setting `approval_status: "REJECTED"` with `approval_updated_at` and `approval_updated_by`, returning `404` for missing enrollments or enrollments outside the supervisor's team, and logging `REJECT_ENROLLMENT` audit.
- Idempotency verified for approve and reject operations.
- **DOCUMENTED GAPS:** `getTeam` does not verify `req.user.role` is `SUPERVISOR`; `enrollTeamMembers` does not check if learning path is `PUBLIC`.

---

## Test Structure & Conventions

Every test file must follow a strict structural convention:

1. **Environment Setup**: Define `process.env` variables at the absolute top.
2. **Module Mocks**: Place all `vi.mock()` calls at the top, before any imports. Mocks must provide default implementations for all mocked exports.
3. **Imports**: Import `describe`, `it`, `expect`, `vi` from vitest, plus controller functions and mocked module refs.
4. **Mock Utilities**: Define `createMockReq`, `createMockRes`.
5. **State Resetting**: Include `beforeEach(() => { vi.clearAllMocks(); })` (or `vi.resetAllMocks()` where needed) to reset all mock states between tests.
6. **Exports Test**: The very first `describe()` block must verify that the controller exports all expected functions.
7. **Feature Test Blocks**: Grouped by controller function using `describe()` / `it()` blocks.

### Example of the Required "Exports Test"

```javascript
describe("CONTROLLER EXPORTS", () => {
  const expectedExports = ["getProfile", "updateProfile"];

  for (const exportName of expectedExports) {
    it(`should export ${exportName}`, () => {
      expect(typeof myController[exportName]).toBe("function");
    });
  }
});
```

---

## Step-by-Step: Writing a New Test

When adding a new test inside an existing file, follow the **Arrange-Act-Assert** pattern.

```javascript
describe("UPDATE PROFILE", () => {
  it("should update user profile successfully", async () => {
    // 1. Arrange: Set up mock return values
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "user-1", name: "Updated Name" }],
      rowCount: 1,
    });

    const req = createMockReq({
      user: { id: "user-1" },
      body: { name: "Updated Name" },
    });
    const res = createMockRes();

    // 2. Act: Call the controller
    await myController.updateProfile(req, res);

    // 3. Assert: Verify HTTP Response
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // 4. Assert: Verify Database Interaction
    expect(vi.mocked(query).mock.calls[0][1][1]).toBe("Updated Name");

    // 5. Assert: Verify Side-Effects (Audits)
    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      action: "UPDATE_PROFILE",
      resourceType: "AUTH_PRINCIPAL",
    });
  });

  it("should reject missing parameters", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();

    await myController.updateProfile(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
```

---

## Mocking Patterns Reference

### Basic mock setup

```javascript
vi.mock("../db.js", () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));
```

### Mocking with implementation

```javascript
vi.mock("../utils/http.js", () => ({
  sendError: vi.fn((res, status, code, message, details) => {
    res.statusCode = status;
    res.body = { error: { code, message } };
    return res;
  }),
}));
```

### Overriding mock per test

```javascript
vi.mocked(query).mockResolvedValueOnce({
  rows: [{ id: "user-1", email: "test@test.com" }],
  rowCount: 1,
});

vi.mocked(query).mockRejectedValueOnce(new Error("DB connection lost"));
```

### Chaining multiple mock calls

```javascript
vi.mocked(query)
  .mockResolvedValueOnce({ rows: [{ present: true }], rowCount: 1 })
  .mockResolvedValueOnce({ rows: [{ present: true }], rowCount: 1 })
  .mockResolvedValueOnce({
    rows: mockEnrollments,
    rowCount: 3,
  });
```

### Counting mock invocations

```javascript
expect(vi.mocked(logAudit).mock.calls.length).toBe(1);
expect(vi.mocked(query).mock.calls.length).toBe(3);
```

### Inspecting mock arguments

```javascript
expect(vi.mocked(query).mock.calls[0][0]).toContain("SELECT");
expect(vi.mocked(query).mock.calls[0][1][0]).toBe("user-1");
```

### Verifying mock was NOT called

```javascript
expect(vi.mocked(query)).not.toHaveBeenCalled();
```

### Using matchObject for partial assertions

```javascript
expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
  actorPrincipalId: "user-1",
  action: "SELF_ENROLL_PUBLIC_PATH",
  resourceType: "ENROLLMENT",
});
```

### Filtering mock calls

```javascript
const updateCalls = vi
  .mocked(query)
  .mock.calls.filter(([sql]) => sql.includes("UPDATE"));
expect(updateCalls.length).toBe(2);
```

---

## Running the Tests

The test suite uses vitest. You can trigger it directly from the command line:

**Run all tests in the suite:**

```bash
npx vitest run
```

_(Or `npm test` if configured in your `package.json`)_

**Run all tests in watch mode (for development):**

```bash
npx vitest
```

**Run a specific controller's test:**

```bash
npx vitest tests/authController.test.js
npx vitest tests/learningAdminController.test.js
```

**Run tests matching a name pattern:**

```bash
npx vitest run -t "LOGIN"
npx vitest run --testNamePattern="LOGIN"
```

**Run tests with verbose output:**

```bash
npx vitest run --reporter=verbose
```

**Run tests with coverage (requires `@vitest/coverage-v8`):**

```bash
npx vitest run --coverage
```

**Run tests with coverage for a specific file:**

```bash
npx vitest run --coverage tests/employeeController.test.js
```

> **Note:** The `SECRET_KEY` environment variable is auto-set to a test fallback inside each file (`test-secret-key-for-testing`), so no `.env` setup is required to run the suite. For CI environments, you can still override it explicitly:

```bash
SECRET_KEY=your-ci-secret npx vitest run
```

### vitest Configuration

The vitest configuration is located in `server/vitest.config.js`. Ensure the configuration file includes the test file pattern and any necessary environment settings:

```javascript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.js"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
```

---

## Documented Gaps and Vulnerabilities

The following gaps and vulnerabilities have been identified during testing and are documented for future resolution:

| #   | Controller     | Issue                                                                                         | Severity |
| --- | -------------- | --------------------------------------------------------------------------------------------- | -------- |
| 1   | Auth           | Refresh endpoint does not check `is_active` flag — deactivated users can still refresh tokens | High     |
| 2   | Integration    | `importErpEmployees` has no role-based authorization                                          | Medium   |
| 3   | Learner        | `downloadLearnerCertificate` does not verify certificate ownership via employeeNo             | Medium   |
| 4   | Learner        | `getLearnerPathCourses` does not verify enrollment ownership vs employeeNo                    | Medium   |
| 5   | Learning Admin | `createLearningPath` does not verify user role                                                | Medium   |
| 6   | Learning Admin | `deleteLearningPath` does not verify user role                                                | Medium   |
| 7   | Super Admin    | `createUser` and `createEmployee` do not verify `req.user.role` in controller                 | Low      |
| 8   | Super Admin    | `deleteUser` does not verify target is not `LEARNING_ADMIN` with active enrollments           | Low      |
| 9   | Super Admin    | `getAllLearners` does not validate that designation filter value is valid                     | Low      |
| 10  | Supervisor     | `getTeam` does not verify `req.user.role` is `SUPERVISOR`                                     | Low      |
| 11  | Supervisor     | `enrollTeamMembers` does not check if learning path is `PUBLIC`                               | Low      |
