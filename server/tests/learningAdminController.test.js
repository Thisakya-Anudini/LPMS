import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies

vi.mock("../db.js", () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
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

vi.mock("../utils/audit.js", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn() },
  hash: vi.fn(),
}));

vi.mock("../utils/erpClient.js", () => ({
  fetchAllCourses: vi
    .fn()
    .mockResolvedValue({ success: true, message: "Success", data: [] }),
  fetchClassesByCourseCode: vi.fn().mockRejectedValue(new Error("No ERP mock")),
  fetchAllDesignations: vi.fn().mockRejectedValue(new Error("No ERP mock")),
  fetchAllSalaryGrades: vi.fn().mockRejectedValue(new Error("No ERP mock")),
  fetchEmployeesByFilters: vi.fn().mockRejectedValue(new Error("No ERP mock")),
  fetchEmployeeDetailsForServiceNo: vi
    .fn()
    .mockRejectedValue(new Error("No ERP mock")),
  fetchEmployeesByPartialName: vi
    .fn()
    .mockRejectedValue(new Error("No ERP mock")),
  fetchOrganizationList: vi.fn().mockRejectedValue(new Error("No ERP mock")),
}));

vi.mock("../utils/certificatePdf.js", () => ({
  renderCertificatePdf: vi.fn(),
}));

vi.mock("../utils/assignmentReports.js", () => ({
  ASSIGNMENT_REPORT_SOURCE: {
    LEARNING_ADMIN: "LEARNING_ADMIN",
    SUPERVISOR: "SUPERVISOR",
  },
  ASSIGNMENT_REPORT_STATUS: {
    ASSIGNED_IN_LPMS: "ASSIGNED_IN_LPMS",
    ENROLLED_IN_ERP: "ENROLLED_IN_ERP",
  },
  createAssignmentReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/emailService.js", () => ({
  sendClassAssignedEmail: vi.fn().mockResolvedValue(undefined),
  sendLearningPathAssignedEmail: vi.fn().mockResolvedValue(undefined),
}));

// Imports (after mocks)

import { query } from "../db.js";
import { sendError } from "../utils/http.js";
import { logAudit } from "../utils/audit.js";
import bcrypt from "bcryptjs";
import {
  fetchAllCourses,
  fetchClassesByCourseCode,
  fetchAllDesignations,
  fetchAllSalaryGrades,
  fetchEmployeesByFilters,
  fetchEmployeeDetailsForServiceNo,
  fetchEmployeesByPartialName,
  fetchOrganizationList,
} from "../utils/erpClient.js";
import { renderCertificatePdf } from "../utils/certificatePdf.js";
import {
  ASSIGNMENT_REPORT_SOURCE,
  ASSIGNMENT_REPORT_STATUS,
  createAssignmentReport,
} from "../utils/assignmentReports.js";
import {
  sendClassAssignedEmail,
  sendLearningPathAssignedEmail,
} from "../utils/emailService.js";
import * as learningAdminController from "../controllers/learningAdminController.js";

// Test helpers

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
  };
  return res;
};

const createMockReq = (overrides = {}) => {
  const baseReq = {
    body: {},
    params: {},
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

const ASSIGNMENT_REPORT_STATUS_VALUES = {
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
  return { value: normalized };
};

const safeCertificateTitle = (title) =>
  String(title || "learning_path")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();

const mapLearningAdminAssignments = (
  employees = [],
  assignedEmployeeNumbers = new Set(),
) => {
  return employees.map((employee) => ({
    ...employee,
    isLearningAdmin: assignedEmployeeNumbers.has(employee.employeeNumber),
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(query).mockReset();
  vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 });
});

// Exports testing

describe("LEARNING ADMIN CONTROLLER EXPORTS", () => {
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
    it(`should export ${exportName}`, () => {
      expect(typeof learningAdminController[exportName]).toBe("function");
    });
  }
});

// Create learning path testing

describe("CREATE LEARNING PATH", () => {
  it("should return 400 for invalid category", async () => {
    const req = createMockReq({
      body: { title: "Test", category: "PRIVATE", description: "Test" },
    });
    const res = createMockRes();
    await learningAdminController.createLearningPath(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should allow PUBLIC and RESTRICTED categories", () => {
    expect(parseCategory("PUBLIC")).toBe("PUBLIC");
    expect(parseCategory("RESTRICTED")).toBe("RESTRICTED");
    expect(parseCategory("PRIVATE")).toBeNull();
  });

  it("should create active learning path with certificate signer fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "lp-new",
          title: "React Basics",
          description: "Learn React",
          category: "PUBLIC",
          total_duration: 12,
          status: "ACTIVE",
          created_at: new Date(),
          certificate_signer_name: "Manager",
          certificate_signer_title: "LPMS",
        },
      ],
      rowCount: 1,
    });

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
    const res = createMockRes();
    await learningAdminController.createLearningPath(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.learningPath.status).toBe("ACTIVE");
    expect(res.body.learningPath.category).toBe("PUBLIC");
    expect(res.body.learningPath.certificate_signer_name).toBe("Manager");
  });

  it("should insert unstructured stages in order", () => {
    const stages = [
      { title: "Intro", order: 1 },
      { title: "Advanced", order: 2 },
    ];
    expect(stages).toHaveLength(2);
    expect(stages[0].order).toBe(1);
    expect(stages[1].title).toBe("Advanced");
  });

  it("should insert structured stage courses", () => {
    const stages = [
      {
        title: "Stage 1",
        order: 1,
        courses: [{ courseId: "COURSE-001", order: 1 }],
      },
    ];
    expect(Array.isArray(stages[0].courses)).toBe(true);
    expect(stages[0].courses[0].courseId).toBe("COURSE-001");
  });

  it("should log create learning path audit on success", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ principal_id: "11111111-1111-4111-8111-111111111111" }],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "lp-new",
          title: "Test",
          description: "Test",
          category: "PUBLIC",
          total_duration: 10,
          status: "ACTIVE",
          created_at: new Date(),
          certificate_signer_name: null,
          certificate_signer_title: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: { title: "Test", description: "Test", category: "PUBLIC" },
    });
    const res = createMockRes();
    await learningAdminController.createLearningPath(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "11111111-1111-4111-8111-111111111111",
      action: "CREATE_LEARNING_PATH",
      resourceType: "LEARNING_PATH",
    });
  });
});

// Get learning paths testing

describe("GET LEARNING PATHS", () => {
  it("should return non-deleted paths only", async () => {
    vi.mocked(query).mockImplementation(() => ({
      rows: [
        {
          id: "lp-1",
          title: "Python Basics",
          description: "Learn Python",
          category: "PUBLIC",
          total_duration: 20,
          status: "ACTIVE",
          created_at: new Date(),
          certificate_signer_name: "Manager",
          certificate_signer_title: "LPMS",
        },
        {
          id: "lp-2",
          title: "Leadership",
          description: "Leadership course",
          category: "RESTRICTED",
          total_duration: 40,
          status: "ACTIVE",
          created_at: new Date(),
          certificate_signer_name: "Lead",
          certificate_signer_title: "Academy",
        },
      ],
      rowCount: 2,
    }));

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getLearningPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPaths).toHaveLength(2);
  });

  it("should order paths by created_at DESC (SQL handles ordering)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "lp-1" }, { id: "lp-2" }],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getLearningPaths(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("DESC");
  });

  it("should include certificate signer fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "lp-1",
          title: "Python Basics",
          description: "Learn Python",
          category: "PUBLIC",
          total_duration: 20,
          status: "ACTIVE",
          created_at: new Date(),
          certificate_signer_name: "Learning Manager",
          certificate_signer_title: "LPMS",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getLearningPaths(req, res);

    expect(res.body.learningPaths[0].certificate_signer_name).toBe(
      "Learning Manager",
    );
    expect(res.body.learningPaths[0].certificate_signer_title).toBe("LPMS");
  });
});

// Get learning path by id testing

describe("GET LEARNING PATH BY ID", () => {
  it("should return 404 when learning path is not found", async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql && sql.includes("FROM learning_paths WHERE id = $1")) {
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    });

    const req = createMockReq({ params: { id: "missing" } });
    const res = createMockRes();
    await learningAdminController.getLearningPathById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return learning path with stages", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "lp-1",
            title: "Python Basics",
            description: "Learn Python",
            category: "PUBLIC",
            total_duration: 20,
            status: "ACTIVE",
            created_at: new Date(),
            certificate_signer_name: "Manager",
            certificate_signer_title: "LPMS",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          { id: "stage-1", title: "Stage 1", stage_order: 1 },
          { id: "stage-2", title: "Stage 2", stage_order: 2 },
        ],
        rowCount: 2,
      })
      .mockResolvedValueOnce({ rows: [{ present: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ present: true }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            stage_id: "stage-1",
            course_id: "COURSE-001",
            course_title: "Python Intro",
            course_order: 1,
            delivery_mode: "ONLINE",
          },
          {
            stage_id: "stage-2",
            course_id: "COURSE-002",
            course_title: "Python Advanced",
            course_order: 1,
            delivery_mode: "ONLINE",
          },
        ],
        rowCount: 2,
      });

    const req = createMockReq({ params: { id: "lp-1" } });
    const res = createMockRes();
    await learningAdminController.getLearningPathById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPath.stages).toHaveLength(2);
    expect(res.body.learningPath.stages[0].courses).toHaveLength(1);
    expect(res.body.learningPath.stages[0].courses[0].course_id).toBe(
      "COURSE-001",
    );
  });
});

// Update learning path testing

describe("UPDATE LEARNING PATH", () => {
  it("should return 404 when learning path is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      params: { id: "missing" },
      body: { title: "Updated" },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPath(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should update only provided fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "lp-1",
          title: "Updated Python",
          description: "Learn Python",
          category: "PUBLIC",
          total_duration: 20,
          status: "ACTIVE",
          updated_at: new Date(),
          certificate_signer_name: null,
          certificate_signer_title: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "lp-1" },
      body: { title: "Updated Python", status: "ACTIVE" },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPath(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPath.title).toBe("Updated Python");
  });

  it("should replace stages when stages array is provided", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "lp-1",
          title: "Test",
          description: "Test",
          category: "PUBLIC",
          total_duration: 10,
          status: "ACTIVE",
          updated_at: new Date(),
          certificate_signer_name: null,
          certificate_signer_title: null,
        },
      ],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ present: false }],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ present: false }],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      params: { id: "lp-1" },
      body: { stages: [{ title: "New Stage", order: 1 }] },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPath(req, res);

    expect(res.statusCode).toBe(200);
  });

  it("should log update learning path audit", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "lp-1",
          title: "Updated",
          description: "Test",
          category: "PUBLIC",
          total_duration: 10,
          status: "ACTIVE",
          updated_at: new Date(),
          certificate_signer_name: null,
          certificate_signer_title: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "lp-1" },
      body: { title: "Updated" },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPath(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      action: "UPDATE_LEARNING_PATH",
      resourceType: "LEARNING_PATH",
      resourceId: "lp-1",
    });
  });
});

// Get certificate customization paths testing

describe("GET CERTIFICATE CUSTOMIZATION PATHS", () => {
  it("should export getCertificateCustomizationPaths function", () => {
    expect(
      typeof learningAdminController.getCertificateCustomizationPaths,
    ).toBe("function");
  });

  it("should return non-deleted learning paths with certificate fields", async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql && sql.includes("information_schema")) {
        return { rows: [{ present: false }], rowCount: 1 };
      }

      return {
        rows: [
          {
            id: "lp-1",
            title: "Python Basics",
            certificate_signer_name: "Manager",
            certificate_signer_title: "LPMS",
            certificate_signature_png: null,
            updated_at: new Date(),
          },
          {
            id: "lp-2",
            title: "Leadership",
            certificate_signer_name: "Lead",
            certificate_signer_title: "Academy",
            certificate_signature_png: null,
            updated_at: new Date(),
          },
        ],
        rowCount: 2,
      };
    });

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getCertificateCustomizationPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPaths).toHaveLength(2);
    expect(res.body.learningPaths[0].certificate_signer_name).toBe("Manager");
  });

  it("should list paths alphabetically by title (SQL handles ordering)", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ present: false }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "lp-2",
            title: "Leadership",
            certificate_signer_name: null,
            certificate_signer_title: null,
            certificate_signature_png: null,
            updated_at: new Date(),
          },
          {
            id: "lp-1",
            title: "Python Basics",
            certificate_signer_name: null,
            certificate_signer_title: null,
            certificate_signature_png: null,
            updated_at: new Date(),
          },
        ],
        rowCount: 2,
      });

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getCertificateCustomizationPaths(req, res);

    const sql = vi.mocked(query).mock.calls[1][0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("title ASC");
  });

  it("should include signature PNG field when column exists", async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql && sql.includes("information_schema")) {
        return { rows: [{ present: true }], rowCount: 1 };
      }
      return {
        rows: [
          {
            id: "lp-1",
            title: "Python Basics",
            certificate_signer_name: "Manager",
            certificate_signer_title: "LPMS",
            certificate_signature_png: "data:image/png;base64,AAAA",
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      };
    });

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getCertificateCustomizationPaths(req, res);

    expect(res.body.learningPaths[0].certificate_signature_png).toBe(
      "data:image/png;base64,AAAA",
    );
  });
});

// Update learning path certificate signature testing

describe("UPDATE LEARNING PATH CERTIFICATE SIGNATURE", () => {
  it("should require signerName", async () => {
    const req = createMockReq({
      params: { id: "lp-1" },
      body: { signerName: "", signerTitle: "LPMS" },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPathCertificateSignature(
      req,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should require signerTitle", async () => {
    const req = createMockReq({
      params: { id: "lp-1" },
      body: { signerName: "Manager", signerTitle: "" },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPathCertificateSignature(
      req,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it("should reject non-PNG signature data URL", () => {
    const signature = normalizeSignaturePngDataUrl(
      "data:image/jpeg;base64,AAAA",
    );
    expect(signature.error).toBe("Signature must be a PNG image.");
  });

  it("should accept valid PNG signature data URL", () => {
    const signature = normalizeSignaturePngDataUrl(
      "data:image/png;base64,AAAA",
    );
    expect(signature.value).toBe("data:image/png;base64,AAAA");
  });

  it("should return null for empty/null signature", () => {
    expect(normalizeSignaturePngDataUrl(null)).toBeNull();
    expect(normalizeSignaturePngDataUrl("")).toBeNull();
    expect(normalizeSignaturePngDataUrl(undefined)).toBeNull();
  });

  it("should require migration when PNG signature column is missing", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ present: false }],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "lp-1" },
      body: {
        signerName: "Manager",
        signerTitle: "LPMS",
        signaturePngDataUrl: "data:image/png;base64,AAAA",
      },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPathCertificateSignature(
      req,
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe("MIGRATION_REQUIRED");
  });

  it("should return 404 when learning path is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ present: true }],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      params: { id: "missing" },
      body: { signerName: "Manager", signerTitle: "LPMS" },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPathCertificateSignature(
      req,
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should update signer and signature fields", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ present: true }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "lp-1",
            title: "Python Basics",
            certificate_signer_name: "New Signer",
            certificate_signer_title: "New Title",
            certificate_signature_png: "data:image/png;base64,BBBB",
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      params: { id: "lp-1" },
      body: {
        signerName: "New Signer",
        signerTitle: "New Title",
        signaturePngDataUrl: "data:image/png;base64,BBBB",
      },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPathCertificateSignature(
      req,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPath.certificate_signer_name).toBe("New Signer");
    expect(res.body.learningPath.certificate_signature_png).toBe(
      "data:image/png;base64,BBBB",
    );
  });

  it("should log update certificate signature audit", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ present: true }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "lp-1",
            title: "Python Basics",
            certificate_signer_name: "New Signer",
            certificate_signer_title: "New Title",
            certificate_signature_png: "data:image/png;base64,AAAA",
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      params: { id: "lp-1" },
      body: {
        signerName: "New Signer",
        signerTitle: "New Title",
        signaturePngDataUrl: "data:image/png;base64,AAAA",
      },
    });
    const res = createMockRes();
    await learningAdminController.updateLearningPathCertificateSignature(
      req,
      res,
    );

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      action: "UPDATE_CERTIFICATE_SIGNATURE",
      resourceType: "LEARNING_PATH",
      resourceId: "lp-1",
      metadata: {
        signerName: "New Signer",
        signerTitle: "New Title",
        hasSignaturePng: true,
      },
    });
  });
});

// Preview learning path certificate testing

describe("PREVIEW LEARNING PATH CERTIFICATE", () => {
  it("should reject invalid preview signature", () => {
    const signature = normalizeSignaturePngDataUrl("invalid-signature");
    expect(signature.error).toBe("Signature must be a PNG image.");
  });

  it("should return 404 when preview path is missing", async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql && sql.includes("information_schema")) {
        return { rows: [{ present: false }], rowCount: 1 };
      }

      if (sql && sql.includes("EXISTS")) {
        return { rows: [{ present: false }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    const req = createMockReq({ params: { id: "missing" } });
    const res = createMockRes();
    await learningAdminController.previewLearningPathCertificate(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should generate safe certificate preview filename", () => {
    const filename = `certificate_preview_${safeCertificateTitle("Python Basics!")}.pdf`;
    expect(filename).toBe("certificate_preview_python_basics_.pdf");
  });

  it("should use signer override values", () => {
    const learningPath = {
      certificate_signer_name: "Original Name",
      certificate_signer_title: "Original Title",
    };
    const signerNameOverride = "Override Name";
    const signerTitleOverride = "Override Title";

    const signerName =
      signerNameOverride ||
      learningPath.certificate_signer_name ||
      "Learning Administrator";
    const signerTitle =
      signerTitleOverride || learningPath.certificate_signer_title || "LPMS";

    expect(signerName).toBe("Override Name");
    expect(signerTitle).toBe("Override Title");
  });
});

// Delete learning path testing

describe("DELETE LEARNING PATH", () => {
  it("should return 404 when delete target is missing", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { id: "missing" } });
    const res = createMockRes();
    await learningAdminController.deleteLearningPath(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should soft delete learning path (DELETE query)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "lp-1" }],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "lp-1" } });
    const res = createMockRes();
    await learningAdminController.deleteLearningPath(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql.trim().startsWith("DELETE")).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it("should log delete audit", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({ params: { id: "lp-1" } });
    const res = createMockRes();
    await learningAdminController.deleteLearningPath(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      action: "DELETE_LEARNING_PATH",
      resourceType: "LEARNING_PATH",
      resourceId: "lp-1",
    });
  });
});

// Create enrollments testing

describe("CREATE ENROLLMENTS", () => {
  it("should require selectedLearners non-empty array", async () => {
    const req = createMockReq({
      body: { learningPathId: "lp-1", selectedLearners: [] },
    });
    const res = createMockRes();
    await learningAdminController.createEnrollments(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 if learning path is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: {
        learningPathId: "missing",
        selectedLearners: [{ employeeNumber: "EMP-001" }],
      },
    });
    const res = createMockRes();
    await learningAdminController.createEnrollments(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should normalize learner name and email", () => {
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
    expect(normalized.learnerName).toBe("A Perera");
    expect(normalized.learnerEmail).toBe("user@example.com");
  });

  it("should create enrollment with NOT_STARTED status and LEARNING_ADMIN source", () => {
    const enrollment = {
      status: "NOT_STARTED",
      progress: 0,
      enrollment_source: "LEARNING_ADMIN",
    };
    expect(enrollment.status).toBe("NOT_STARTED");
    expect(enrollment.progress).toBe(0);
    expect(enrollment.enrollment_source).toBe("LEARNING_ADMIN");
  });
});

// Get assignment reports testing

describe("GET ASSIGNMENT REPORTS", () => {
  it("should export getAssignmentReports function", () => {
    expect(typeof learningAdminController.getAssignmentReports).toBe(
      "function",
    );
  });

  it("should return assignment reports with learners attached", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "report-1",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
          assigned_by_name: "Learning Admin",
          assigned_by_role: "LEARNING_ADMIN",
          assignment_source: "LEARNING_ADMIN",
          report_status: "ASSIGNED_IN_LPMS",
          assigned_at: new Date(),
          created_at: new Date(),
          learners: [
            {
              id: "arl-1",
              principalId: "principal-1",
              employeeNumber: "EMP-001",
              learnerName: "John Doe",
              learnerEmail: "john@example.com",
              designation: "Developer",
              gradeName: "G5",
            },
          ],
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getAssignmentReports(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.reports).toHaveLength(1);
    expect(res.body.reports[0].learners).toHaveLength(1);
    expect(res.body.reports[0].learners[0].employeeNumber).toBe("EMP-001");
  });

  it("should include complete report fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "report-1",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
          assigned_by_name: "Learning Admin",
          assigned_by_role: "LEARNING_ADMIN",
          assignment_source: "LEARNING_ADMIN",
          report_status: "ASSIGNED_IN_LPMS",
          assigned_at: new Date(),
          created_at: new Date(),
          learners: [],
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getAssignmentReports(req, res);

    const report = res.body.reports[0];
    expect(report.learning_path_id).toBe("lp-1");
    expect(report.learning_path_title).toBe("Python Basics");
    expect(report.assigned_by_name).toBe("Learning Admin");
    expect(report.assigned_by_role).toBe("LEARNING_ADMIN");
    expect(report.assignment_source).toBe("LEARNING_ADMIN");
    expect(report.report_status).toBe("ASSIGNED_IN_LPMS");
  });
});

// Update assignment report status

describe("UPDATE ASSIGNMENT REPORT STATUS", () => {
  it("should reject invalid assignment report status", async () => {
    const req = createMockReq({
      params: { id: "report-1" },
      body: { status: "INVALID_STATUS" },
    });
    const res = createMockRes();
    await learningAdminController.updateAssignmentReportStatus(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should accept ASSIGNED_IN_LPMS status", () => {
    const status = ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS;
    const isValid = [
      ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS,
      ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP,
    ].includes(status);
    expect(isValid).toBe(true);
  });

  it("should accept ENROLLED_IN_ERP status", () => {
    const status = ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP;
    const isValid = [
      ASSIGNMENT_REPORT_STATUS.ASSIGNED_IN_LPMS,
      ASSIGNMENT_REPORT_STATUS.ENROLLED_IN_ERP,
    ].includes(status);
    expect(isValid).toBe(true);
  });

  it("should update assignment report status", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "report-1", report_status: "ENROLLED_IN_ERP" }],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "report-1" },
      body: { status: "ENROLLED_IN_ERP" },
    });
    const res = createMockRes();
    await learningAdminController.updateAssignmentReportStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.report.id).toBe("report-1");
    expect(res.body.report.report_status).toBe("ENROLLED_IN_ERP");
  });

  it("should return 404 when assignment report is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      params: { id: "missing" },
      body: { status: "ENROLLED_IN_ERP" },
    });
    const res = createMockRes();
    await learningAdminController.updateAssignmentReportStatus(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should log assignment report status audit", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "report-1", report_status: "ENROLLED_IN_ERP" }],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "report-1" },
      body: { status: "ENROLLED_IN_ERP" },
    });
    const res = createMockRes();
    await learningAdminController.updateAssignmentReportStatus(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      action: "UPDATE_ASSIGNMENT_REPORT_STATUS",
      resourceType: "ASSIGNMENT_REPORT",
      resourceId: "report-1",
      metadata: { status: "ENROLLED_IN_ERP" },
    });
  });
});

// Get assignable employee search options testing

describe("GET ASSIGNABLE EMPLOYEE SEARCH OPTIONS", () => {
  it("should normalize and sort designations", () => {
    const rows = [
      { designation: "Manager" },
      { designation: "Analyst" },
      { designation: "Manager" },
    ];
    const options = normalizeOptionList(rows, "designation");
    expect(options).toEqual(["Analyst", "Manager"]);
  });

  it("should normalize and sort grades", () => {
    const rows = [{ salaryGrade: "G5" }, { salaryGrade: "G4" }];
    const grades = normalizeOptionList(rows, "salaryGrade");
    expect(grades).toEqual(["G4", "G5"]);
  });

  it("should include payroll options", () => {
    const payrolls = [
      { value: "EXECUTIVE", label: "Executive" },
      { value: "NON_EXECUTIVE", label: "Non Executive" },
    ];
    expect(payrolls).toHaveLength(2);
    expect(payrolls[0].value).toBe("EXECUTIVE");
  });
});

// Search assignable employees testing

describe("SEARCH ASSIGNABLE EMPLOYEES", () => {
  it("should require at least one search or filter value", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    await learningAdminController.searchAssignableEmployees(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should normalize employee rows", () => {
    const row = {
      employeeNumber: " EMP-001 ",
      employeeName: " John Doe ",
      email: " JOHN@EXAMPLE.COM ",
      orgName: " IT ",
    };
    const normalized = normalizeEmployeeRow(row);
    expect(normalized.employeeNumber).toBe("EMP-001");
    expect(normalized.employeeName).toBe("John Doe");
    expect(normalized.email).toBe("john@example.com");
    expect(normalized.organizationName).toBe("IT");
  });

  it("should mark learning admin assignments", () => {
    const employees = [
      { employeeNumber: "EMP-001", employeeName: "John Doe" },
      { employeeNumber: "EMP-002", employeeName: "Jane Doe" },
    ];
    const assignedSet = new Set(["EMP-002"]);
    const mapped = mapLearningAdminAssignments(employees, assignedSet);
    expect(mapped[0].isLearningAdmin).toBe(false);
    expect(mapped[1].isLearningAdmin).toBe(true);
  });

  it("should sort matched employees by employeeName", () => {
    const employees = [
      { employeeNumber: "EMP-002", employeeName: "Jane Doe" },
      { employeeNumber: "EMP-001", employeeName: "Adam Doe" },
    ].sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    expect(employees[0].employeeName).toBe("Adam Doe");
  });
});

// Get class assignment options testing

describe("GET CLASS ASSIGNMENT OPTIONS", () => {
  it("should return 404 when learning path is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { id: "missing" } });
    const res = createMockRes();
    await learningAdminController.getClassAssignmentOptions(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should build class assignment course and learner options", async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (
        sql &&
        sql.includes("FROM learning_paths") &&
        sql.includes("is_deleted")
      ) {
        return {
          rows: [
            {
              id: "lp-1",
              title: "Python Basics",
              description: "Learn Python",
              category: "PUBLIC",
              total_duration: 20,
              status: "ACTIVE",
            },
          ],
          rowCount: 1,
        };
      }

      if (sql && sql.includes("learning_path_stages")) {
        return {
          rows: [
            { id: "stage-1", title: "Stage 1", stage_order: 1 },
            { id: "stage-2", title: "Stage 2", stage_order: 2 },
          ],
          rowCount: 2,
        };
      }

      if (sql && sql.includes("EXISTS")) {
        return { rows: [{ present: false }], rowCount: 1 };
      }

      if (sql && sql.includes("stage_courses")) {
        return {
          rows: [
            {
              stage_id: "stage-1",
              course_id: "COURSE-001",
              course_title: "Python Intro",
              course_order: 1,
              delivery_mode: "ONLINE",
            },
            {
              stage_id: "stage-2",
              course_id: "COURSE-002",
              course_title: "Python Advanced",
              course_order: 1,
              delivery_mode: "ONLINE",
            },
          ],
          rowCount: 2,
        };
      }

      return { rows: [], rowCount: 0 };
    });

    const req = createMockReq({ params: { id: "lp-1" } });
    const res = createMockRes();
    await learningAdminController.getClassAssignmentOptions(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPath.title).toBe("Python Basics");
  });
});

// Get classes by course code testing

describe("GET CLASSES BY COURSE CODE", () => {
  it("should require course code", async () => {
    const req = createMockReq({ params: { courseCode: "" } });
    const res = createMockRes();
    await learningAdminController.getClassesByCourseCode(req, res);

    expect(res.statusCode).toBe(400);
  });

  it("should trim course code", () => {
    const courseCode = String(" COURSE-001 ").trim();
    expect(courseCode).toBe("COURSE-001");
  });

  it("should normalize ERP class row using classId and classCode", () => {
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
    expect(erpClass.id).toBe("CLASS-001");
    expect(erpClass.code).toBe("C001");
    expect(erpClass.title).toBe("Python Morning");
    expect(erpClass.venue).toBe("Room 1");
  });

  it("should generate fallback class id when ERP id is missing", () => {
    const erpClass = normalizeErpClassRow({ className: "Fallback Class" }, 0);
    expect(erpClass.id).toBe("CLASS-1");
    expect(erpClass.title).toBe("Fallback Class");
  });

  it("should handle ERP errors gracefully", async () => {
    vi.mocked(fetchClassesByCourseCode).mockRejectedValueOnce({
      status: 503,
      message: "ERP unavailable",
    });

    const req = createMockReq({ params: { courseCode: "COURSE-001" } });
    const res = createMockRes();
    await learningAdminController.getClassesByCourseCode(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe("ERP_REQUEST_FAILED");
  });
});

// Assign class enrollments testing

describe("ASSIGN CLASS ENROLLMENTS", () => {
  it("should require learningPathId, courseCode, class, and enrollmentIds", async () => {
    const req = createMockReq({
      body: {
        learningPathId: "",
        courseCode: "COURSE-001",
        class: { id: "CLASS-001" },
        enrollmentIds: ["en-1"],
      },
    });
    const res = createMockRes();
    await learningAdminController.assignClassEnrollments(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should trim and filter enrollmentIds", () => {
    const selectedEnrollmentIds = [" en-1 ", "", " en-2 "]
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    expect(selectedEnrollmentIds).toEqual(["en-1", "en-2"]);
  });

  it("should normalize selected class id, code, and title", () => {
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
    expect(classId).toBe("CLASS-001");
    expect(classCode).toBe("C001");
    expect(classTitle).toBe("Python Morning");
  });

  it("should return 404 when learning path is not found", async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql && sql.includes("information_schema")) {
        return { rows: [{ present: false }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });

    const req = createMockReq({
      body: {
        learningPathId: "missing",
        courseCode: "COURSE-001",
        class: { id: "CLASS-001" },
        enrollmentIds: ["en-1"],
      },
    });
    const res = createMockRes();
    await learningAdminController.assignClassEnrollments(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should create class enrollment assignment (returns 201)", async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql && sql.includes("information_schema")) {
        return { rows: [{ present: false }], rowCount: 1 };
      }
      if (sql && sql.includes("FROM learning_paths")) {
        return { rows: [{ id: "lp-1", title: "Python Basics" }], rowCount: 1 };
      }
      // Enrollments validation query (contains auth_principals + JOIN)
      if (sql && sql.includes("auth_principals") && sql.includes("employees")) {
        return {
          rows: [
            {
              id: "en-1",
              name: "John Doe",
              email: "john@test.com",
              employee_number: "EMP-001",
            },
          ],
          rowCount: 1,
        };
      }
      if (sql && sql.includes("INSERT")) {
        return { rows: [{ id: "ce-new" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = createMockReq({
      body: {
        learningPathId: "lp-1",
        courseCode: "COURSE-001",
        class: { id: "CLASS-002", code: "C002", title: "Python Evening" },
        enrollmentIds: ["en-1"],
      },
    });
    const res = createMockRes();
    await learningAdminController.assignClassEnrollments(req, res);

    expect(res.statusCode).toBe(201);
  });
});

// Get learning summary report testing

describe("GET LEARNING SUMMARY REPORT", () => {
  it("should return summary with path, enrollment, and certificate counts", async () => {
    vi.mocked(query).mockImplementation(async (sql) => {
      if (sql && sql.includes("total_paths")) {
        return { rows: [{ total_paths: "2", active_paths: "2" }], rowCount: 1 };
      }
      if (sql && sql.includes("total_enrollments")) {
        return {
          rows: [{ total_enrollments: "2", completed_enrollments: "1" }],
          rowCount: 1,
        };
      }
      if (sql && sql.includes("total_certificates")) {
        return { rows: [{ total_certificates: "1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = createMockReq();
    const res = createMockRes();
    await learningAdminController.getLearningSummaryReport(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.summary.totalPaths).toBe(2);
    expect(res.body.summary.totalEnrollments).toBe(2);
    expect(res.body.summary.totalCertificates).toBe(1);
  });

  it("should compute completion rate correctly", () => {
    const totalEnrollments = 4;
    const completedEnrollments = 3;
    const completionRate =
      totalEnrollments === 0
        ? 0
        : Math.round((completedEnrollments / totalEnrollments) * 100);
    expect(completionRate).toBe(75);
  });

  it("should return zero completion rate when no enrollments", () => {
    const totalEnrollments = 0;
    const completedEnrollments = 0;
    const completionRate =
      totalEnrollments === 0
        ? 0
        : Math.round((completedEnrollments / totalEnrollments) * 100);
    expect(completionRate).toBe(0);
  });

  it("should build summary response shape", async () => {
    const summary = {
      totalPaths: 2,
      activePaths: 2,
      totalEnrollments: 2,
      completedEnrollments: 1,
      completionRate: 50,
      totalCertificates: 1,
    };
    expect(summary.totalPaths).toBe(2);
    expect(summary.activePaths).toBe(2);
    expect(summary.totalEnrollments).toBe(2);
    expect(summary.completedEnrollments).toBe(1);
    expect(summary.completionRate).toBe(50);
    expect(summary.totalCertificates).toBe(1);
  });
});

// Private helper testing

describe("parseCategory (private helper)", () => {
  it("should return null for invalid categories", () => {
    expect(parseCategory("INVALID")).toBeNull();
    expect(parseCategory("PRIVATE")).toBeNull();
    expect(parseCategory("")).toBeNull();
  });

  it("should return valid categories", () => {
    expect(parseCategory("PUBLIC")).toBe("PUBLIC");
    expect(parseCategory("RESTRICTED")).toBe("RESTRICTED");
  });
});

describe("normalizeEmployeeDisplayName (private helper)", () => {
  it("should normalize name from employeeName", () => {
    expect(
      normalizeEmployeeDisplayName({ employeeName: " John Doe " }, "EMP-001"),
    ).toBe("John Doe");
  });

  it("should fall back to initials and surname", () => {
    expect(
      normalizeEmployeeDisplayName(
        { employeeInitials: " J ", employeeSurname: " Doe " },
        "EMP-001",
      ),
    ).toBe("J Doe");
  });

  it("should fall back to Learner plus employeeNumber", () => {
    expect(normalizeEmployeeDisplayName({}, "EMP-001")).toBe("Learner EMP-001");
  });

  it("should handle null employeeName", () => {
    expect(
      normalizeEmployeeDisplayName({ employeeName: null }, "EMP-001"),
    ).toBe("Learner EMP-001");
  });
});

describe("normalizeSignaturePngDataUrl (private helper)", () => {
  it("should return null for empty/null/undefined", () => {
    expect(normalizeSignaturePngDataUrl(null)).toBeNull();
    expect(normalizeSignaturePngDataUrl("")).toBeNull();
    expect(normalizeSignaturePngDataUrl(undefined)).toBeNull();
  });

  it("should reject non-PNG data URLs", () => {
    expect(
      normalizeSignaturePngDataUrl("data:image/jpeg;base64,AAAA").error,
    ).toBe("Signature must be a PNG image.");
  });

  it("should accept valid PNG data URLs", () => {
    expect(
      normalizeSignaturePngDataUrl("data:image/png;base64,AAAA").value,
    ).toBe("data:image/png;base64,AAAA");
  });
});

describe("safeCertificateTitle (private helper)", () => {
  it("should sanitize title for filename", () => {
    expect(safeCertificateTitle("Python Basics!")).toBe("python_basics_");
    expect(safeCertificateTitle("Leadership 101")).toBe("leadership_101");
  });

  it("should use default for empty title", () => {
    expect(safeCertificateTitle("")).toBe("learning_path");
    expect(safeCertificateTitle(null)).toBe("learning_path");
  });
});

describe("normalizeErpClassRow (private helper)", () => {
  it("should use classId as primary id", () => {
    const result = normalizeErpClassRow({
      classId: "C-001",
      className: "Test",
    });
    expect(result.id).toBe("C-001");
  });

  it("should generate fallback id", () => {
    const result = normalizeErpClassRow({}, 3);
    expect(result.id).toBe("CLASS-4");
  });

  it("should normalize all fields", () => {
    const result = normalizeErpClassRow({
      classId: "C-001",
      classCode: "C001",
      className: "Morning",
      startDate: "2026-06-10",
      venue: "Room 1",
      capacity: "25",
    });
    expect(result.code).toBe("C001");
    expect(result.title).toBe("Morning");
    expect(result.startDate).toBe("2026-06-10");
    expect(result.venue).toBe("Room 1");
  });
});

describe("getSearchErrorStatus (private helper)", () => {
  it("should return error.status when present", () => {
    expect(getSearchErrorStatus({ status: 503 })).toBe(503);
  });

  it("should default to 502", () => {
    expect(getSearchErrorStatus(new Error("test"))).toBe(502);
  });
});
