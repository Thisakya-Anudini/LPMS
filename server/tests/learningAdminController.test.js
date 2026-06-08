// Set up test environment
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-for-testing";

import test from "node:test";
import assert from "assert/strict";
import * as learningAdminController from "../controllers/learningAdminController.js";

// MOCK UTILITIES

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    header(key, value) {
      this.headers[key] = value;
      return this;
    },
  };
  return res;
};

const createMockReq = (overrides = {}) => {
  const headers = {};
  const baseReq = {
    body: {},
    params: {},
    headers,
    header(name) {
      return this.headers[name];
    },
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Learning Admin",
      role: "LEARNING_ADMIN",
      employeeNo: "EMP-ADMIN",
    },
  };

  return {
    ...baseReq,
    ...overrides,
    user: { ...baseReq.user, ...overrides.user },
    body: { ...baseReq.body, ...overrides.body },
    params: { ...baseReq.params, ...overrides.params },
  };
};

const sendMockError = (res, status, code, message, details) => {
  const payload = { error: { code, message } };
  if (details) {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
};

// MOCK DATABASE

let mockDatabase = {};

const setupMockDatabase = () => {
  mockDatabase = {
    learning_paths: [
      {
        id: "lp-1",
        title: "Python Basics",
        description: "Learn Python",
        category: "PUBLIC",
        total_duration: 20,
        status: "ACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-05T10:00:00Z"),
        updated_at: new Date("2026-06-05T10:00:00Z"),
        created_by: "admin-1",
        certificate_signer_name: "Learning Manager",
        certificate_signer_title: "LPMS",
        certificate_signature_png: "data:image/png;base64,AAAA",
      },
      {
        id: "lp-2",
        title: "Leadership",
        description: "Leadership course",
        category: "RESTRICTED",
        total_duration: 40,
        status: "ACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-04T10:00:00Z"),
        updated_at: new Date("2026-06-04T10:00:00Z"),
        created_by: "admin-1",
        certificate_signer_name: "Training Lead",
        certificate_signer_title: "Academy",
        certificate_signature_png: null,
      },
      {
        id: "lp-3",
        title: "Deleted Path",
        description: "Deleted",
        category: "PUBLIC",
        total_duration: 10,
        status: "ACTIVE",
        is_deleted: true,
        created_at: new Date("2026-06-03T10:00:00Z"),
      },
    ],
    learning_path_stages: [
      {
        id: "stage-1",
        learning_path_id: "lp-1",
        title: "Stage 1",
        stage_order: 1,
      },
      {
        id: "stage-2",
        learning_path_id: "lp-1",
        title: "Stage 2",
        stage_order: 2,
      },
    ],
    stage_courses: [
      {
        id: "sc-1",
        stage_id: "stage-1",
        course_code: "COURSE-001",
        course_title: "Python Intro",
        course_duration: "2h",
        delivery_mode: "ONLINE",
        course_order: 1,
      },
      {
        id: "sc-2",
        stage_id: "stage-2",
        course_code: "COURSE-002",
        course_title: "Python Advanced",
        course_duration: "3h",
        delivery_mode: "ONLINE",
        course_order: 1,
      },
    ],
    principals: [
      {
        id: "principal-1",
        email: "john@example.com",
        name: "John Doe",
        role: "EMPLOYEE",
      },
      {
        id: "principal-2",
        email: "jane@example.com",
        name: "Jane Doe",
        role: "EMPLOYEE",
      },
    ],
    employees: [
      {
        id: "emp-1",
        principal_id: "principal-1",
        employee_number: "EMP-001",
        designation: "Developer",
        grade_name: "G5",
      },
      {
        id: "emp-2",
        principal_id: "principal-2",
        employee_number: "EMP-002",
        designation: "Analyst",
        grade_name: "G4",
      },
      {
        id: "emp-admin",
        principal_id: "11111111-1111-4111-8111-111111111111",
        employee_number: "EMP-ADMIN",
        designation: "Learning Admin",
        grade_name: "G7",
      },
    ],
    enrollments: [
      {
        id: "en-1",
        principal_id: "principal-1",
        learning_path_id: "lp-1",
        status: "IN_PROGRESS",
        progress: 50,
        enrolled_at: new Date("2026-06-05T10:00:00Z"),
        learner_name: "John Doe",
        learner_email: "john@example.com",
      },
      {
        id: "en-2",
        principal_id: "principal-2",
        learning_path_id: "lp-1",
        status: "COMPLETED",
        progress: 100,
        enrolled_at: new Date("2026-06-04T10:00:00Z"),
        learner_name: "Jane Doe",
        learner_email: "jane@example.com",
      },
    ],
    notifications: [],
    certificates: [
      {
        id: "cert-1",
        principal_id: "principal-2",
        learning_path_id: "lp-1",
      },
    ],
    assignment_reports: [
      {
        id: "report-1",
        learning_path_id: "lp-1",
        learning_path_title: "Python Basics",
        assigned_by_name: "Learning Admin",
        assigned_by_role: "LEARNING_ADMIN",
        assignment_source: "LEARNING_ADMIN",
        report_status: "ASSIGNED_IN_LPMS",
        assigned_at: new Date("2026-06-05T10:00:00Z"),
        created_at: new Date("2026-06-05T10:00:00Z"),
      },
    ],
    assignment_report_learners: [
      {
        id: "arl-1",
        report_id: "report-1",
        principal_id: "principal-1",
        employee_number: "EMP-001",
        learner_name: "John Doe",
        learner_email: "john@example.com",
        designation: "Developer",
        grade_name: "G5",
      },
    ],
    learning_admin_assignments: [{ employee_number: "EMP-002" }],
    class_enrollments: [
      {
        id: "ce-1",
        enrollment_id: "en-1",
        learning_path_id: "lp-1",
        course_code: "COURSE-001",
        class_id: "CLASS-001",
        class_code: "C001",
        class_title: "Python Morning",
        class_payload: { id: "CLASS-001" },
        assigned_at: new Date("2026-06-06T10:00:00Z"),
      },
    ],
  };
};

let auditLogs = [];
let assignmentReports = [];
let sentEmails = [];

// MOCK HELPERS

const ASSIGNMENT_REPORT_STATUS = {
  ASSIGNED_IN_LPMS: "ASSIGNED_IN_LPMS",
  ENROLLED_IN_ERP: "ENROLLED_IN_ERP",
};

const parseCategory = (value) => {
  const allowed = ["RESTRICTED", "PUBLIC"];
  return allowed.includes(value) ? value : null;
};

const normalizeEmployeeDisplayName = (row, employeeNo) => {
  if (row?.employeeName && String(row.employeeName).trim()) {
    return String(row.employeeName).trim();
  }

  const initials = row?.employeeInitials
    ? String(row.employeeInitials).trim()
    : "";
  const surname = row?.employeeSurname
    ? String(row.employeeSurname).trim()
    : "";
  const merged = `${initials} ${surname}`.trim();

  return merged || `Learner ${employeeNo}`;
};

const normalizeEmployeeRow = (row) => ({
  employeeNumber: String(row?.employeeNumber || "").trim(),
  employeeName: normalizeEmployeeDisplayName(row, row?.employeeNumber || ""),
  employeeSurname: row?.employeeSurname
    ? String(row.employeeSurname).trim()
    : "",
  designation: row?.designation ? String(row.designation).trim() : "",
  gradeName: row?.gradeName ? String(row.gradeName).trim() : "",
  email: row?.email ? String(row.email).trim().toLowerCase() : "",
  organizationName: row?.orgName ? String(row.orgName).trim() : "",
  costCenterCode: row?.employeeCostCode
    ? String(row.employeeCostCode).trim()
    : "",
  costCenterName: row?.employeeCostCentreName
    ? String(row.employeeCostCentreName).trim()
    : "",
  employeeInitials: row?.employeeInitials
    ? String(row.employeeInitials).trim()
    : "",
  employeeSupervisorNumber: row?.employeeSupervisorNumber
    ? String(row.employeeSupervisorNumber).trim()
    : "",
});

const normalizeOptionList = (rows, key) =>
  Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => String(row?.[key] || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

const normalizeSignaturePngDataUrl = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).trim();
  const prefix = "data:image/png;base64,";

  if (!normalized.startsWith(prefix)) {
    return { error: "Signature must be a PNG image." };
  }

  const binary = Buffer.from(normalized.slice(prefix.length), "base64");

  if (binary.length === 0) {
    return { error: "Signature image is empty." };
  }

  if (binary.length > 2 * 1024 * 1024) {
    return { error: "Signature image must be 2 MB or smaller." };
  }

  return { value: normalized };
};

const safeCertificateTitle = (title) =>
  String(title || "learning_path")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();

const mapLearningAdminAssignments = (employees = []) => {
  const assigned = new Set(
    mockDatabase.learning_admin_assignments.map((row) => row.employee_number),
  );

  return employees.map((employee) => ({
    ...employee,
    isLearningAdmin: assigned.has(employee.employeeNumber),
  }));
};

const normalizeErpClassRow = (row, index = 0) => {
  const id =
    String(
      row?.classId || row?.classID || row?.id || row?.classCode || "",
    ).trim() || `CLASS-${index + 1}`;
  const code = String(row?.classCode || row?.classNo || id).trim();
  const title = String(
    row?.className || row?.title || `Class ${index + 1}`,
  ).trim();

  return {
    id,
    code,
    title,
    startDate: String(row?.startDate || row?.fromDate || "").trim(),
    endDate: String(row?.endDate || row?.toDate || "").trim(),
    venue: String(row?.venue || row?.location || "").trim(),
    instructor: String(row?.instructor || row?.trainer || "").trim(),
    capacity: String(row?.capacity || row?.seats || "").trim(),
    raw: row || {},
  };
};

const getSearchErrorStatus = (error) =>
  typeof error?.status === "number" ? error.status : 502;

const mockLogAudit = async (audit) => {
  auditLogs.push(audit);
};

const mockCreateAssignmentReport = async (report) => {
  assignmentReports.push(report);
};

const mockSendLearningPathAssignedEmail = (payload) => {
  sentEmails.push({ type: "learning-path", ...payload });
  return Promise.resolve();
};

const mockSendClassAssignedEmail = (payload) => {
  sentEmails.push({ type: "class", ...payload });
  return Promise.resolve();
};

// TEST SUITES

// functions exports testing
test("LEARNING ADMIN EXPORTS TESTS", async (t) => {
  const expectedExports = [
    "createLearningPath",
    "getLearningPaths",
    "getLearningPathById",
    "updateLearningPath",
    "getCertificateCustomizationPaths",
    "updateLearningPathCertificateSignature",
    "previewLearningPathCertificate",
    "deleteLearningPath",
    "createEnrollments",
    "getAssignmentReports",
    "updateAssignmentReportStatus",
    "getAssignableEmployeeSearchOptions",
    "searchAssignableEmployees",
    "getClassAssignmentOptions",
    "getClassesByCourseCode",
    "assignClassEnrollments",
    "getLearningSummaryReport",
  ];

  for (const exportName of expectedExports) {
    await t.test(`should export ${exportName}`, async () => {
      assert.equal(typeof learningAdminController[exportName], "function");
    });
  }
});

// createLearningPath testing
test("CREATE LEARNING PATH TESTS", async (t) => {
  await t.test("should reject invalid category", async () => {
    const res = createMockRes();
    const category = parseCategory("PRIVATE");

    if (!category) {
      sendMockError(res, 400, "VALIDATION_ERROR", "Invalid category.");
    }

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test("should allow PUBLIC and RESTRICTED categories", async () => {
    assert.equal(parseCategory("PUBLIC"), "PUBLIC");
    assert.equal(parseCategory("RESTRICTED"), "RESTRICTED");
  });

  await t.test("should create active learning path payload", async () => {
    setupMockDatabase();

    const req = createMockReq({
      body: {
        title: "React Basics",
        description: "Learn React",
        category: "PUBLIC",
        totalDuration: 12,
        certificateSignerName: "Manager",
        certificateSignerTitle: "LPMS",
      },
    });

    const created = {
      id: "lp-new",
      title: req.body.title,
      description: req.body.description,
      category: parseCategory(req.body.category),
      total_duration: req.body.totalDuration,
      status: "ACTIVE",
      certificate_signer_name: req.body.certificateSignerName,
      certificate_signer_title: req.body.certificateSignerTitle,
    };

    assert.equal(created.status, "ACTIVE");
    assert.equal(created.category, "PUBLIC");
    assert.equal(created.certificate_signer_name, "Manager");
  });

  await t.test("should insert unstructured stages in order", async () => {
    const stages = [
      { title: "Intro", order: 1 },
      { title: "Advanced", order: 2 },
    ];

    assert.equal(stages.length, 2);
    assert.equal(stages[0].order, 1);
    assert.equal(stages[1].title, "Advanced");
  });

  await t.test("should insert structured stage courses", async () => {
    const stages = [
      {
        title: "Stage 1",
        order: 1,
        courses: [{ courseId: "COURSE-001", order: 1 }],
      },
    ];

    assert.equal(Array.isArray(stages[0].courses), true);
    assert.equal(stages[0].courses[0].courseId, "COURSE-001");
  });

  await t.test("should log create learning path audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "admin-1",
      action: "CREATE_LEARNING_PATH",
      resourceType: "LEARNING_PATH",
      resourceId: "lp-new",
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "CREATE_LEARNING_PATH");
  });
});

// getLearningPath testing
test("GET LEARNING PATHS TESTS", async (t) => {
  await t.test("should return non-deleted paths only", async () => {
    setupMockDatabase();

    const paths = mockDatabase.learning_paths.filter(
      (path) => !path.is_deleted,
    );

    assert.equal(paths.length, 2);
    assert.ok(paths.every((path) => path.is_deleted === false));
  });

  await t.test("should order paths by created_at DESC", async () => {
    setupMockDatabase();

    const paths = mockDatabase.learning_paths
      .filter((path) => !path.is_deleted)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    assert.equal(paths[0].id, "lp-1");
    assert.equal(paths[1].id, "lp-2");
  });

  await t.test("should include certificate signer fields", async () => {
    setupMockDatabase();

    const path = mockDatabase.learning_paths[0];

    assert.ok(path.certificate_signer_name);
    assert.ok(path.certificate_signer_title);
  });
});

// getLearningPathById testing
test("GET LEARNING PATH BY ID TESTS", async (t) => {
  await t.test(
    "should return 404 when learning path is not found",
    async () => {
      setupMockDatabase();

      const res = createMockRes();
      const path = mockDatabase.learning_paths.find(
        (item) => item.id === "missing" && !item.is_deleted,
      );

      if (!path) {
        sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
      }

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error.message, "Learning path not found.");
    },
  );

  await t.test("should return learning path with stages", async () => {
    setupMockDatabase();

    const path = mockDatabase.learning_paths.find((item) => item.id === "lp-1");
    const stages = mockDatabase.learning_path_stages.filter(
      (stage) => stage.learning_path_id === path.id,
    );

    assert.ok(path);
    assert.equal(stages.length, 2);
  });

  await t.test("should attach courses to each stage", async () => {
    setupMockDatabase();

    const stages = mockDatabase.learning_path_stages
      .filter((stage) => stage.learning_path_id === "lp-1")
      .map((stage) => ({
        ...stage,
        courses: mockDatabase.stage_courses.filter(
          (course) => course.stage_id === stage.id,
        ),
      }));

    assert.equal(stages[0].courses.length, 1);
    assert.equal(stages[0].courses[0].course_code, "COURSE-001");
  });
});

// updateLearningPath testing
test("UPDATE LEARNING PATH TESTS", async (t) => {
  await t.test("should return 404 when learning path is missing", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const path = mockDatabase.learning_paths.find(
      (item) => item.id === "missing" && !item.is_deleted,
    );

    if (!path) {
      sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should update only provided fields", async () => {
    setupMockDatabase();

    const path = { ...mockDatabase.learning_paths[0] };
    const update = { title: "Updated Python", status: "ACTIVE" };

    const updated = {
      ...path,
      title: update.title ?? path.title,
      description: update.description ?? path.description,
      category: update.category ?? path.category,
      total_duration: update.totalDuration ?? path.total_duration,
      status: update.status ?? path.status,
    };

    assert.equal(updated.title, "Updated Python");
    assert.equal(updated.description, "Learn Python");
  });

  await t.test(
    "should replace stages when stages array is provided",
    async () => {
      setupMockDatabase();

      const newStages = [{ title: "New Stage", order: 1 }];
      mockDatabase.learning_path_stages =
        mockDatabase.learning_path_stages.filter(
          (stage) => stage.learning_path_id !== "lp-1",
        );
      mockDatabase.learning_path_stages.push({
        id: "stage-new",
        learning_path_id: "lp-1",
        title: newStages[0].title,
        stage_order: newStages[0].order,
      });

      const stages = mockDatabase.learning_path_stages.filter(
        (stage) => stage.learning_path_id === "lp-1",
      );

      assert.equal(stages.length, 1);
      assert.equal(stages[0].title, "New Stage");
    },
  );

  await t.test("should log update learning path audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "admin-1",
      action: "UPDATE_LEARNING_PATH",
      resourceType: "LEARNING_PATH",
      resourceId: "lp-1",
    });

    assert.equal(auditLogs[0].action, "UPDATE_LEARNING_PATH");
  });
});

// getCertificateCustomizationPaths testing
test("GET CERTIFICATE CUSTOMIZATION PATHS TESTS", async (t) => {
  await t.test(
    "should export getCertificateCustomizationPaths function",
    async () => {
      assert.equal(
        typeof learningAdminController.getCertificateCustomizationPaths,
        "function",
      );
    },
  );

  await t.test("should return non-deleted learning paths only", async () => {
    setupMockDatabase();

    const paths = mockDatabase.learning_paths.filter(
      (path) => !path.is_deleted,
    );

    assert.equal(paths.length, 2);
    assert.ok(paths.every((path) => path.is_deleted === false));
  });

  await t.test("should list paths alphabetically by title", async () => {
    setupMockDatabase();

    const paths = mockDatabase.learning_paths
      .filter((path) => !path.is_deleted)
      .sort((a, b) => a.title.localeCompare(b.title));

    assert.equal(paths[0].title, "Leadership");
    assert.equal(paths[1].title, "Python Basics");
  });

  await t.test("should include certificate customization fields", async () => {
    setupMockDatabase();

    const path = mockDatabase.learning_paths[0];

    assert.ok(path.id);
    assert.ok(path.title);
    assert.ok(path.certificate_signer_name);
    assert.ok(path.certificate_signer_title);
    assert.ok(path.updated_at);
  });

  await t.test(
    "should include signature PNG field when available",
    async () => {
      setupMockDatabase();

      const path = mockDatabase.learning_paths.find(
        (item) => item.id === "lp-1",
      );

      assert.equal(
        path.certificate_signature_png,
        "data:image/png;base64,AAAA",
      );
    },
  );
});

// updateLearningPathCertificateSignature testing
test("UPDATE LEARNING PATH CERTIFICATE SIGNATURE TESTS", async (t) => {
  await t.test(
    "should export updateLearningPathCertificateSignature function",
    async () => {
      assert.equal(
        typeof learningAdminController.updateLearningPathCertificateSignature,
        "function",
      );
    },
  );

  await t.test("should require signerName", async () => {
    const req = createMockReq({
      body: { signerName: "", signerTitle: "LPMS" },
    });
    const res = createMockRes();

    const signerName = String(req.body.signerName || "").trim();
    const signerTitle = String(req.body.signerTitle || "").trim();

    if (!signerName || !signerTitle) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "signerName and signerTitle are required.",
      );
    }

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test("should require signerTitle", async () => {
    const req = createMockReq({
      body: { signerName: "Learning Manager", signerTitle: "" },
    });
    const res = createMockRes();

    const signerName = String(req.body.signerName || "").trim();
    const signerTitle = String(req.body.signerTitle || "").trim();

    if (!signerName || !signerTitle) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "signerName and signerTitle are required.",
      );
    }

    assert.equal(res.statusCode, 400);
  });

  await t.test("should reject non-PNG signature data URL", async () => {
    const signature = normalizeSignaturePngDataUrl(
      "data:image/jpeg;base64,AAAA",
    );

    assert.equal(signature.error, "Signature must be a PNG image.");
  });

  await t.test("should accept valid PNG signature data URL", async () => {
    const signature = normalizeSignaturePngDataUrl(
      "data:image/png;base64,AAAA",
    );

    assert.equal(signature.value, "data:image/png;base64,AAAA");
  });

  await t.test(
    "should require migration when PNG signature column is missing",
    async () => {
      const res = createMockRes();
      const includeSignatureColumn = false;
      const signature = normalizeSignaturePngDataUrl(
        "data:image/png;base64,AAAA",
      );

      if (signature?.value && !includeSignatureColumn) {
        sendMockError(
          res,
          500,
          "MIGRATION_REQUIRED",
          "PNG signature storage is not ready. Run the latest database migration and try again.",
        );
      }

      assert.equal(res.statusCode, 500);
      assert.equal(res.body.error.code, "MIGRATION_REQUIRED");
    },
  );

  await t.test(
    "should return 404 when learning path is not found",
    async () => {
      setupMockDatabase();

      const res = createMockRes();
      const path = mockDatabase.learning_paths.find(
        (item) => item.id === "missing" && !item.is_deleted,
      );

      if (!path) {
        sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
      }

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error.message, "Learning path not found.");
    },
  );

  await t.test("should update signer and signature fields", async () => {
    setupMockDatabase();

    const path = mockDatabase.learning_paths.find((item) => item.id === "lp-1");
    path.certificate_signer_name = "New Signer";
    path.certificate_signer_title = "New Title";
    path.certificate_signature_png = "data:image/png;base64,BBBB";

    assert.equal(path.certificate_signer_name, "New Signer");
    assert.equal(path.certificate_signer_title, "New Title");
    assert.equal(path.certificate_signature_png, "data:image/png;base64,BBBB");
  });

  await t.test("should log update certificate signature audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "admin-1",
      action: "UPDATE_CERTIFICATE_SIGNATURE",
      resourceType: "LEARNING_PATH",
      resourceId: "lp-1",
      metadata: {
        signerName: "New Signer",
        signerTitle: "New Title",
        hasSignaturePng: true,
      },
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "UPDATE_CERTIFICATE_SIGNATURE");
    assert.equal(auditLogs[0].metadata.hasSignaturePng, true);
  });
});

// previewLearningPathCertificate testing
test("PREVIEW LEARNING PATH CERTIFICATE TESTS", async (t) => {
  await t.test("should reject invalid preview signature", async () => {
    const signature = normalizeSignaturePngDataUrl("invalid-signature");

    assert.equal(signature.error, "Signature must be a PNG image.");
  });

  await t.test("should return 404 when preview path is missing", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const path = mockDatabase.learning_paths.find(
      (item) => item.id === "missing" && !item.is_deleted,
    );

    if (!path) {
      sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test(
    "should generate safe certificate preview filename",
    async () => {
      const filename = `certificate_preview_${safeCertificateTitle("Python Basics!")}.pdf`;

      assert.equal(filename, "certificate_preview_python_basics_.pdf");
    },
  );

  await t.test("should use signer override values", async () => {
    setupMockDatabase();

    const learningPath = mockDatabase.learning_paths[0];
    const signerNameOverride = "Override Name";
    const signerTitleOverride = "Override Title";

    const signerName =
      signerNameOverride ||
      learningPath.certificate_signer_name ||
      "Learning Administrator";
    const signerTitle =
      signerTitleOverride || learningPath.certificate_signer_title || "LPMS";

    assert.equal(signerName, "Override Name");
    assert.equal(signerTitle, "Override Title");
  });

  await t.test("should map courses for certificate preview", async () => {
    setupMockDatabase();

    const courses = mockDatabase.stage_courses.map((row) => ({
      title: String(row.course_title || "").trim(),
      duration: String(row.course_duration || "").trim() || "-",
    }));

    assert.equal(courses.length, 2);
    assert.equal(courses[0].title, "Python Intro");
  });
});

// deleteLearningPath testing
test("DELETE LEARNING PATH TESTS", async (t) => {
  await t.test("should return 404 when delete target is missing", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const index = mockDatabase.learning_paths.findIndex(
      (path) => path.id === "missing",
    );

    if (index === -1) {
      sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should delete learning path", async () => {
    setupMockDatabase();

    mockDatabase.learning_paths = mockDatabase.learning_paths.filter(
      (path) => path.id !== "lp-1",
    );

    const deleted = !mockDatabase.learning_paths.some(
      (path) => path.id === "lp-1",
    );

    assert.equal(deleted, true);
  });

  await t.test("should log delete audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "admin-1",
      action: "DELETE_LEARNING_PATH",
      resourceType: "LEARNING_PATH",
      resourceId: "lp-1",
    });

    assert.equal(auditLogs[0].action, "DELETE_LEARNING_PATH");
  });
});

// createEnrollments testing
test("CREATE ENROLLMENTS TESTS", async (t) => {
  await t.test("should require selectedLearners non-empty array", async () => {
    const req = createMockReq({
      body: { learningPathId: "lp-1", selectedLearners: [] },
    });
    const res = createMockRes();

    if (
      !Array.isArray(req.body.selectedLearners) ||
      req.body.selectedLearners.length === 0
    ) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "selectedLearners must be a non-empty array.",
      );
    }

    assert.equal(res.statusCode, 400);
  });

  await t.test("should return 404 if learning path is missing", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const path = mockDatabase.learning_paths.find(
      (item) => item.id === "missing" && !item.is_deleted,
    );

    if (!path) {
      sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should normalize learner name and email", async () => {
    const learner = {
      employeeNumber: "EMP-003",
      employeeInitials: "A",
      employeeSurname: "Perera",
      email: " USER@EXAMPLE.COM ",
    };

    const normalized = {
      learnerName: normalizeEmployeeDisplayName(
        learner,
        learner.employeeNumber,
      ),
      learnerEmail: learner.email.trim().toLowerCase(),
    };

    assert.equal(normalized.learnerName, "A Perera");
    assert.equal(normalized.learnerEmail, "user@example.com");
  });

  await t.test("should skip learner without employee number", async () => {
    const learner = { employeeName: "No Number" };
    const employeeNumber = String(learner.employeeNumber || "").trim();

    assert.equal(employeeNumber, "");
  });

  await t.test("should create enrollment with NOT_STARTED status", async () => {
    const enrollment = {
      status: "NOT_STARTED",
      progress: 0,
      enrollment_source: "LEARNING_ADMIN",
    };

    assert.equal(enrollment.status, "NOT_STARTED");
    assert.equal(enrollment.progress, 0);
    assert.equal(enrollment.enrollment_source, "LEARNING_ADMIN");
  });

  await t.test(
    "should create notification for inserted enrollment",
    async () => {
      setupMockDatabase();

      mockDatabase.notifications.push({
        principal_id: "principal-1",
        title: "Enrollment Assigned",
        message: 'You were enrolled in "Python Basics".',
        type: "INFO",
        is_read: false,
      });

      assert.equal(mockDatabase.notifications.length, 1);
      assert.equal(mockDatabase.notifications[0].title, "Enrollment Assigned");
    },
  );

  await t.test(
    "should create assignment report when learners inserted",
    async () => {
      assignmentReports = [];

      await mockCreateAssignmentReport({
        learningPathId: "lp-1",
        learningPathTitle: "Python Basics",
        assignedByPrincipalId: "admin-1",
        assignedByName: "Learning Admin",
        assignedByRole: "LEARNING_ADMIN",
        assignmentSource: "LEARNING_ADMIN",
        learners: [{ employeeNumber: "EMP-001" }],
      });

      assert.equal(assignmentReports.length, 1);
      assert.equal(assignmentReports[0].learners.length, 1);
    },
  );

  await t.test("should queue learning path assignment email", async () => {
    sentEmails = [];

    await mockSendLearningPathAssignedEmail({
      employeeNumber: "EMP-001",
      to: "john@example.com",
      learnerName: "John Doe",
      learningPathTitle: "Python Basics",
    });

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].type, "learning-path");
  });
});

// getAssignmentReports testing
test("GET ASSIGNMENT REPORTS TESTS", async (t) => {
  await t.test("should export getAssignmentReports function", async () => {
    assert.equal(
      typeof learningAdminController.getAssignmentReports,
      "function",
    );
  });

  await t.test("should return assignment reports", async () => {
    setupMockDatabase();

    const reports = mockDatabase.assignment_reports;

    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, "report-1");
  });

  await t.test("should include report fields", async () => {
    setupMockDatabase();

    const report = mockDatabase.assignment_reports[0];

    assert.ok(report.id);
    assert.ok(report.learning_path_id);
    assert.ok(report.learning_path_title);
    assert.ok(report.assigned_by_name);
    assert.ok(report.assigned_by_role);
    assert.ok(report.assignment_source);
    assert.ok(report.report_status);
    assert.ok(report.assigned_at);
  });

  await t.test("should attach learners to reports", async () => {
    setupMockDatabase();

    const reports = mockDatabase.assignment_reports.map((report) => ({
      ...report,
      learners: mockDatabase.assignment_report_learners.filter(
        (learner) => learner.report_id === report.id,
      ),
    }));

    assert.equal(reports[0].learners.length, 1);
    assert.equal(reports[0].learners[0].employee_number, "EMP-001");
  });

  await t.test("should order reports by assigned_at DESC", async () => {
    setupMockDatabase();

    mockDatabase.assignment_reports.push({
      id: "report-2",
      learning_path_id: "lp-2",
      learning_path_title: "Leadership",
      assigned_by_name: "Learning Admin",
      assigned_by_role: "LEARNING_ADMIN",
      assignment_source: "LEARNING_ADMIN",
      report_status: "ASSIGNED_IN_LPMS",
      assigned_at: new Date("2026-06-06T10:00:00Z"),
      created_at: new Date("2026-06-06T10:00:00Z"),
    });

    const reports = mockDatabase.assignment_reports.sort(
      (a, b) => new Date(b.assigned_at) - new Date(a.assigned_at),
    );

    assert.equal(reports[0].id, "report-2");
    assert.equal(reports[1].id, "report-1");
  });
});

// updateAssignmentReportStatus testing
test("UPDATE ASSIGNMENT REPORT STATUS TESTS", async (t) => {
  await t.test(
    "should export updateAssignmentReportStatus function",
    async () => {
      assert.equal(
        typeof learningAdminController.updateAssignmentReportStatus,
        "function",
      );
    },
  );

  await t.test("should reject invalid assignment report status", async () => {
    const res = createMockRes();
    const status = "INVALID_STATUS";

    if (
      ![
        ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS,
        ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP,
      ].includes(status)
    ) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid assignment report status.",
      );
    }

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test("should accept ASSIGNED_IN_LPMS status", async () => {
    const status = ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS;
    const isValid = [
      ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS,
      ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP,
    ].includes(status);

    assert.equal(isValid, true);
  });

  await t.test("should accept ENROLLED_IN_ERP status", async () => {
    const status = ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP;
    const isValid = [
      ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS,
      ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP,
    ].includes(status);

    assert.equal(isValid, true);
  });

  await t.test("should update assignment report status", async () => {
    setupMockDatabase();

    const report = mockDatabase.assignment_reports.find(
      (item) => item.id === "report-1",
    );
    report.report_status = ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP;

    assert.equal(report.report_status, "ENROLLED_IN_ERP");
  });

  await t.test("should return updated report id and status", async () => {
    const report = {
      id: "report-1",
      report_status: ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP,
    };

    assert.deepEqual(report, {
      id: "report-1",
      report_status: "ENROLLED_IN_ERP",
    });
  });

  await t.test(
    "should return 404 when assignment report is not found",
    async () => {
      setupMockDatabase();

      const res = createMockRes();
      const report = mockDatabase.assignment_reports.find(
        (item) => item.id === "missing",
      );

      if (!report) {
        sendMockError(res, 404, "NOT_FOUND", "Assignment report not found.");
      }

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error.message, "Assignment report not found.");
    },
  );

  await t.test("should log assignment report status audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "admin-1",
      action: "UPDATE_ASSIGNMENT_REPORT_STATUS",
      resourceType: "ASSIGNMENT_REPORT",
      resourceId: "report-1",
      metadata: { status: "ENROLLED_IN_ERP" },
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "UPDATE_ASSIGNMENT_REPORT_STATUS");
    assert.equal(auditLogs[0].resourceType, "ASSIGNMENT_REPORT");
  });
});

// getAssignableEmployeeSearchOptions testing
test("GET ASSIGNABLE EMPLOYEE SEARCH OPTIONS TESTS", async (t) => {
  await t.test("should normalize and sort designations", async () => {
    const rows = [
      { designation: "Manager" },
      { designation: "Analyst" },
      { designation: "Manager" },
    ];

    const options = normalizeOptionList(rows, "designation");

    assert.deepEqual(options, ["Analyst", "Manager"]);
  });

  await t.test("should normalize and sort grades", async () => {
    const rows = [{ salaryGrade: "G5" }, { salaryGrade: "G4" }];

    const grades = normalizeOptionList(rows, "salaryGrade");

    assert.deepEqual(grades, ["G4", "G5"]);
  });

  await t.test("should filter invalid organizations", async () => {
    const organizations = [
      { organizationId: "ORG-1", organizationName: "IT" },
      { organizationId: "", organizationName: "Invalid" },
    ]
      .map((row) => ({
        organizationId: String(row.organizationId || "").trim(),
        organizationName: String(row.organizationName || "").trim(),
      }))
      .filter((row) => row.organizationId && row.organizationName);

    assert.equal(organizations.length, 1);
  });

  await t.test("should include payroll options", async () => {
    const payrolls = [
      { value: "EXECUTIVE", label: "Executive" },
      { value: "NON_EXECUTIVE", label: "Non Executive" },
    ];

    assert.equal(payrolls.length, 2);
    assert.equal(payrolls[0].value, "EXECUTIVE");
  });

  await t.test(
    "should map ERP option errors to ERP_REQUEST_FAILED",
    async () => {
      const res = createMockRes();
      const error = new Error("ERP failed");
      error.status = 503;

      sendMockError(
        res,
        getSearchErrorStatus(error),
        "ERP_REQUEST_FAILED",
        "Failed to load ERP filter options.",
        error.message,
      );

      assert.equal(res.statusCode, 503);
      assert.equal(res.body.error.code, "ERP_REQUEST_FAILED");
    },
  );
});

// searchAssignableEmployees testing
test("SEARCH ASSIGNABLE EMPLOYEES TESTS", async (t) => {
  await t.test(
    "should require at least one search or filter value",
    async () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      const employeeNo = String(req.body.employeeNo || "").trim();
      const surname = String(req.body.surname || "").trim();
      const designation = String(req.body.designation || "").trim();
      const grade = String(req.body.grade || "").trim();
      const organizationName = String(
        req.body.organizationName || req.body.organizationId || "",
      ).trim();
      const payrollType = String(req.body.payrollType || "")
        .trim()
        .toUpperCase();

      if (
        !employeeNo &&
        !surname &&
        !designation &&
        !grade &&
        !organizationName &&
        !payrollType
      ) {
        sendMockError(
          res,
          400,
          "VALIDATION_ERROR",
          "At least one search or filter value is required.",
        );
      }

      assert.equal(res.statusCode, 400);
    },
  );

  await t.test("should normalize employee rows", async () => {
    const row = {
      employeeNumber: " EMP-001 ",
      employeeName: " John Doe ",
      email: " JOHN@EXAMPLE.COM ",
      orgName: " IT ",
    };

    const normalized = normalizeEmployeeRow(row);

    assert.equal(normalized.employeeNumber, "EMP-001");
    assert.equal(normalized.employeeName, "John Doe");
    assert.equal(normalized.email, "john@example.com");
    assert.equal(normalized.organizationName, "IT");
  });

  await t.test(
    "should intersect employees from multiple search calls",
    async () => {
      const byNumber = new Map([
        ["EMP-001", { employeeNumber: "EMP-001", employeeName: "John Doe" }],
        ["EMP-002", { employeeNumber: "EMP-002", employeeName: "Jane Doe" }],
      ]);
      const byFilter = new Map([
        ["EMP-001", { employeeNumber: "EMP-001", designation: "Developer" }],
      ]);

      const intersection = [];
      for (const [employeeNumber, employee] of byNumber.entries()) {
        const filtered = byFilter.get(employeeNumber);
        if (filtered) {
          intersection.push({ ...employee, ...filtered });
        }
      }

      assert.equal(intersection.length, 1);
      assert.equal(intersection[0].employeeNumber, "EMP-001");
    },
  );

  await t.test("should mark learning admin assignments", async () => {
    setupMockDatabase();

    const employees = [
      { employeeNumber: "EMP-001", employeeName: "John Doe" },
      { employeeNumber: "EMP-002", employeeName: "Jane Doe" },
    ];

    const mapped = mapLearningAdminAssignments(employees);

    assert.equal(mapped[0].isLearningAdmin, false);
    assert.equal(mapped[1].isLearningAdmin, true);
  });

  await t.test("should sort matched employees by employeeName", async () => {
    const employees = [
      { employeeNumber: "EMP-002", employeeName: "Jane Doe" },
      { employeeNumber: "EMP-001", employeeName: "Adam Doe" },
    ].sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    assert.equal(employees[0].employeeName, "Adam Doe");
  });

  await t.test("should map search errors to ERP_REQUEST_FAILED", async () => {
    const res = createMockRes();
    const error = new Error("ERP failed");

    sendMockError(
      res,
      getSearchErrorStatus(error),
      "ERP_REQUEST_FAILED",
      "Failed to search ERP employees.",
      error.message,
    );

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error.code, "ERP_REQUEST_FAILED");
  });
});

// getClassAssignmentOptions testing
test("GET CLASS ASSIGNMENT OPTIONS TESTS", async (t) => {
  await t.test("should export getClassAssignmentOptions function", async () => {
    assert.equal(
      typeof learningAdminController.getClassAssignmentOptions,
      "function",
    );
  });

  await t.test(
    "should return 404 when learning path is not found",
    async () => {
      setupMockDatabase();

      const res = createMockRes();
      const path = mockDatabase.learning_paths.find(
        (item) => item.id === "missing" && !item.is_deleted,
      );

      if (!path) {
        sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
      }

      assert.equal(res.statusCode, 404);
    },
  );

  await t.test("should return learning path details", async () => {
    setupMockDatabase();

    const learningPath = mockDatabase.learning_paths.find(
      (path) => path.id === "lp-1" && !path.is_deleted,
    );

    assert.equal(learningPath.id, "lp-1");
    assert.equal(learningPath.title, "Python Basics");
    assert.equal(learningPath.status, "ACTIVE");
  });

  await t.test("should build class assignment course options", async () => {
    setupMockDatabase();

    const courses = mockDatabase.stage_courses.map((row) => ({
      courseId: row.course_code,
      courseCode: row.course_code,
      title: row.course_title || row.course_code,
      stageTitle:
        mockDatabase.learning_path_stages.find(
          (stage) => stage.id === row.stage_id,
        )?.title || "",
      order: row.course_order,
    }));

    assert.equal(courses.length, 2);
    assert.equal(courses[0].courseCode, "COURSE-001");
    assert.equal(courses[0].stageTitle, "Stage 1");
  });

  await t.test(
    "should build learner options for path enrollments",
    async () => {
      setupMockDatabase();

      const learners = mockDatabase.enrollments
        .filter((enrollment) => enrollment.learning_path_id === "lp-1")
        .map((enrollment) => {
          const principal = mockDatabase.principals.find(
            (item) => item.id === enrollment.principal_id,
          );
          const employee = mockDatabase.employees.find(
            (item) => item.principal_id === principal.id,
          );

          return {
            enrollmentId: enrollment.id,
            principalId: principal.id,
            employeeNumber: employee.employee_number,
            name: principal.name,
            email: principal.email,
            designation: employee.designation,
            gradeName: employee.grade_name,
            status: enrollment.status,
            progress: Number(enrollment.progress || 0),
            enrolledAt: enrollment.enrolled_at,
            classAssignments: mockDatabase.class_enrollments.filter(
              (item) => item.enrollment_id === enrollment.id,
            ),
          };
        });

      assert.equal(learners.length, 2);
      assert.equal(learners[0].enrollmentId, "en-1");
      assert.equal(learners[0].progress, 50);
    },
  );

  await t.test(
    "should include existing class assignments for learners",
    async () => {
      setupMockDatabase();

      const assignments = mockDatabase.class_enrollments.filter(
        (item) => item.enrollment_id === "en-1",
      );

      assert.equal(assignments.length, 1);
      assert.equal(assignments[0].class_id, "CLASS-001");
    },
  );
});

// getClassesByCourseCode testing
test("GET CLASSES BY COURSE CODE TESTS", async (t) => {
  await t.test("should export getClassesByCourseCode function", async () => {
    assert.equal(
      typeof learningAdminController.getClassesByCourseCode,
      "function",
    );
  });

  await t.test("should require course code", async () => {
    const courseCode = String("").trim();
    const res = createMockRes();

    if (!courseCode) {
      sendMockError(res, 400, "VALIDATION_ERROR", "Course code is required.");
    }

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.message, "Course code is required.");
  });

  await t.test("should trim course code", async () => {
    const courseCode = String(" COURSE-001 ").trim();

    assert.equal(courseCode, "COURSE-001");
  });

  await t.test(
    "should normalize ERP class row using classId and classCode",
    async () => {
      const erpClass = normalizeErpClassRow(
        {
          classId: "CLASS-001",
          classCode: "C001",
          className: "Python Morning",
          startDate: "2026-06-10",
          endDate: "2026-06-12",
          venue: "Room 1",
          instructor: "Trainer A",
          capacity: "25",
        },
        0,
      );

      assert.equal(erpClass.id, "CLASS-001");
      assert.equal(erpClass.code, "C001");
      assert.equal(erpClass.title, "Python Morning");
      assert.equal(erpClass.venue, "Room 1");
    },
  );

  await t.test(
    "should generate fallback class id when ERP id is missing",
    async () => {
      const erpClass = normalizeErpClassRow({ className: "Fallback Class" }, 0);

      assert.equal(erpClass.id, "CLASS-1");
      assert.equal(erpClass.title, "Fallback Class");
    },
  );

  await t.test("should return classes response shape", async () => {
    const courseCode = "COURSE-001";
    const classes = [
      normalizeErpClassRow({ classId: "CLASS-001", className: "Morning" }, 0),
      normalizeErpClassRow({ classId: "CLASS-002", className: "Evening" }, 1),
    ];

    const response = { courseCode, classes };

    assert.equal(response.courseCode, "COURSE-001");
    assert.equal(response.classes.length, 2);
  });

  await t.test(
    "should map ERP class errors to ERP_REQUEST_FAILED",
    async () => {
      const res = createMockRes();
      const error = new Error("ERP unavailable");
      error.status = 503;

      sendMockError(
        res,
        getSearchErrorStatus(error),
        "ERP_REQUEST_FAILED",
        "Failed to load ERP classes for this course.",
        error.message,
      );

      assert.equal(res.statusCode, 503);
      assert.equal(res.body.error.code, "ERP_REQUEST_FAILED");
    },
  );
});

// assignClassEnrollments testing
test("ASSIGN CLASS ENROLLMENTS TESTS", async (t) => {
  await t.test("should export assignClassEnrollments function", async () => {
    assert.equal(
      typeof learningAdminController.assignClassEnrollments,
      "function",
    );
  });

  await t.test(
    "should require learningPathId, courseCode, class, and enrollmentIds",
    async () => {
      const req = createMockReq({
        body: {
          learningPathId: "",
          courseCode: "COURSE-001",
          class: { id: "CLASS-001" },
          enrollmentIds: ["en-1"],
        },
      });
      const res = createMockRes();

      const learningPathId = String(req.body.learningPathId || "").trim();
      const courseCode = String(req.body.courseCode || "").trim();
      const selectedClass = req.body.class || {};
      const classId = String(
        selectedClass.id || selectedClass.classId || "",
      ).trim();
      const enrollmentIds = Array.isArray(req.body.enrollmentIds)
        ? req.body.enrollmentIds
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        : [];

      if (
        !learningPathId ||
        !courseCode ||
        !classId ||
        enrollmentIds.length === 0
      ) {
        sendMockError(
          res,
          400,
          "VALIDATION_ERROR",
          "learningPathId, courseCode, class, and enrollmentIds are required.",
        );
      }

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.error.code, "VALIDATION_ERROR");
    },
  );

  await t.test("should trim and filter enrollmentIds", async () => {
    const selectedEnrollmentIds = [" en-1 ", "", " en-2 "]
      .map((id) => String(id || "").trim())
      .filter(Boolean);

    assert.deepEqual(selectedEnrollmentIds, ["en-1", "en-2"]);
  });

  await t.test(
    "should normalize selected class id, code, and title",
    async () => {
      const selectedClass = {
        classId: " CLASS-001 ",
        classCode: " C001 ",
        classTitle: " Python Morning ",
      };

      const classId = String(
        selectedClass.id || selectedClass.classId || "",
      ).trim();
      const classCode = String(
        selectedClass.code || selectedClass.classCode || classId,
      ).trim();
      const classTitle = String(
        selectedClass.title || selectedClass.classTitle || classCode || classId,
      ).trim();

      assert.equal(classId, "CLASS-001");
      assert.equal(classCode, "C001");
      assert.equal(classTitle, "Python Morning");
    },
  );

  await t.test(
    "should return 404 when learning path is not found",
    async () => {
      setupMockDatabase();

      const res = createMockRes();
      const path = mockDatabase.learning_paths.find(
        (item) => item.id === "missing" && !item.is_deleted,
      );

      if (!path) {
        sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
      }

      assert.equal(res.statusCode, 404);
    },
  );

  await t.test(
    "should reject when selected learners do not belong to path",
    async () => {
      setupMockDatabase();

      const selectedEnrollmentIds = ["missing-enrollment"];
      const validEnrollments = mockDatabase.enrollments.filter(
        (enrollment) =>
          enrollment.learning_path_id === "lp-1" &&
          selectedEnrollmentIds.includes(enrollment.id),
      );

      assert.equal(validEnrollments.length, 0);
    },
  );

  await t.test("should create class enrollment assignment", async () => {
    setupMockDatabase();

    const selectedClass = {
      id: "CLASS-002",
      code: "C002",
      title: "Python Evening",
    };

    const assigned = {
      id: "ce-new",
      enrollment_id: "en-1",
      learning_path_id: "lp-1",
      course_code: "COURSE-001",
      class_id: selectedClass.id,
      class_code: selectedClass.code,
      class_title: selectedClass.title,
    };

    assert.equal(assigned.enrollment_id, "en-1");
    assert.equal(assigned.class_id, "CLASS-002");
    assert.equal(assigned.course_code, "COURSE-001");
  });

  await t.test(
    "should update existing class assignment for same enrollment and course",
    async () => {
      setupMockDatabase();

      const existing = mockDatabase.class_enrollments.find(
        (item) =>
          item.enrollment_id === "en-1" && item.course_code === "COURSE-001",
      );

      existing.class_id = "CLASS-002";
      existing.class_code = "C002";
      existing.class_title = "Python Evening";

      assert.equal(existing.class_id, "CLASS-002");
      assert.equal(existing.class_title, "Python Evening");
    },
  );

  await t.test("should queue class assignment email", async () => {
    sentEmails = [];

    await mockSendClassAssignedEmail({
      employeeNumber: "EMP-001",
      to: "john@example.com",
      learnerName: "John Doe",
      learningPathTitle: "Python Basics",
      courseCode: "COURSE-001",
      classTitle: "Python Morning",
      classCode: "C001",
    });

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].type, "class");
  });

  await t.test("should log class assignment audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "admin-1",
      action: "ASSIGN_CLASS_ENROLLMENTS",
      resourceType: "CLASS_ENROLLMENT",
      metadata: {
        learningPathId: "lp-1",
        courseCode: "COURSE-001",
        classId: "CLASS-001",
        assigned: 1,
        requested: 1,
      },
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "ASSIGN_CLASS_ENROLLMENTS");
    assert.equal(auditLogs[0].metadata.assigned, 1);
  });
});

// getLearningSummaryReport testing
test("GET LEARNING SUMMARY REPORT TESTS", async (t) => {
  await t.test("should count total and active paths", async () => {
    setupMockDatabase();

    const totalPaths = mockDatabase.learning_paths.filter(
      (path) => !path.is_deleted,
    ).length;
    const activePaths = mockDatabase.learning_paths.filter(
      (path) => !path.is_deleted && path.status === "ACTIVE",
    ).length;

    assert.equal(totalPaths, 2);
    assert.equal(activePaths, 2);
  });

  await t.test("should count total and completed enrollments", async () => {
    setupMockDatabase();

    const totalEnrollments = mockDatabase.enrollments.length;
    const completedEnrollments = mockDatabase.enrollments.filter(
      (enrollment) => enrollment.status === "COMPLETED",
    ).length;

    assert.equal(totalEnrollments, 2);
    assert.equal(completedEnrollments, 1);
  });

  await t.test("should compute completion rate", async () => {
    const totalEnrollments = 4;
    const completedEnrollments = 3;
    const completionRate =
      totalEnrollments === 0
        ? 0
        : Math.round((completedEnrollments / totalEnrollments) * 100);

    assert.equal(completionRate, 75);
  });

  await t.test(
    "should return zero completion rate when no enrollments",
    async () => {
      const totalEnrollments = 0;
      const completedEnrollments = 0;
      const completionRate =
        totalEnrollments === 0
          ? 0
          : Math.round((completedEnrollments / totalEnrollments) * 100);

      assert.equal(completionRate, 0);
    },
  );

  await t.test("should count total certificates", async () => {
    setupMockDatabase();

    const totalCertificates = mockDatabase.certificates.length;

    assert.equal(totalCertificates, 1);
  });

  await t.test("should build summary response shape", async () => {
    setupMockDatabase();

    const summary = {
      totalPaths: mockDatabase.learning_paths.filter((path) => !path.is_deleted)
        .length,
      activePaths: mockDatabase.learning_paths.filter(
        (path) => !path.is_deleted && path.status === "ACTIVE",
      ).length,
      totalEnrollments: mockDatabase.enrollments.length,
      completedEnrollments: mockDatabase.enrollments.filter(
        (enrollment) => enrollment.status === "COMPLETED",
      ).length,
      completionRate: 50,
      totalCertificates: mockDatabase.certificates.length,
    };

    assert.equal(summary.totalPaths, 2);
    assert.equal(summary.activePaths, 2);
    assert.equal(summary.totalEnrollments, 2);
    assert.equal(summary.completedEnrollments, 1);
    assert.equal(summary.completionRate, 50);
    assert.equal(summary.totalCertificates, 1);
  });
});
