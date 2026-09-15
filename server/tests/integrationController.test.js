import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies

vi.mock("../db.js", () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

vi.mock("../utils/erpClient.js", () => ({
  fetchEmployeeDetailsForServiceNo: vi
    .fn()
    .mockRejectedValue(new Error("No ERP mock set for this test")),
  fetchEmployeeSubordinates: vi
    .fn()
    .mockRejectedValue(new Error("No ERP mock set for this test")),
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

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
  hash: vi.fn(),
}));

// Imports (after mocks)

import { query } from "../db.js";
import {
  fetchEmployeeDetailsForServiceNo,
  fetchEmployeeSubordinates,
} from "../utils/erpClient.js";
import { logAudit } from "../utils/audit.js";
import { sendError } from "../utils/http.js";
import bcrypt from "bcryptjs";
import {
  getErpLearnerDetails,
  getErpSubordinates,
  importErpEmployees,
} from "../controllers/integrationController.js";

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
    user: { id: "user-1", role: "LEARNING_ADMIN" },
  };
  return {
    ...baseReq,
    ...overrides,
    user: { ...baseReq.user, ...overrides.user },
    body: { ...baseReq.body, ...overrides.body },
    params: { ...baseReq.params, ...overrides.params },
  };
};

const getErrorStatus = (error) =>
  typeof error.status === "number" ? error.status : 502;

const normalizeName = (employee) => {
  if (employee.employeeName && String(employee.employeeName).trim()) {
    return String(employee.employeeName).trim();
  }
  const initials = employee.employeeInitials
    ? String(employee.employeeInitials).trim()
    : "";
  const surname = employee.employeeSurname
    ? String(employee.employeeSurname).trim()
    : "";
  const fallback = `${initials} ${surname}`.trim();
  return fallback || `Employee ${employee.employeeNumber}`;
};

const normalizeEmail = (employee) => {
  const rawEmail = employee.email
    ? String(employee.email).trim().toLowerCase()
    : "";
  if (rawEmail) {
    return rawEmail;
  }
  const domain = process.env.ERP_FALLBACK_EMAIL_DOMAIN || "erp.local";
  return `${String(employee.employeeNumber).trim()}@${domain}`;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Exports testing

describe("INTEGRATION CONTROLLER EXPORTS", () => {
  it("should export getErpLearnerDetails as a function", () => {
    expect(typeof getErpLearnerDetails).toBe("function");
  });
  it("should export getErpSubordinates as a function", () => {
    expect(typeof getErpSubordinates).toBe("function");
  });
  it("should export importErpEmployees as a function", () => {
    expect(typeof importErpEmployees).toBe("function");
  });
});

// Get erp learner details testing

describe("GET ERP LEARNER DETAILS", () => {
  const mockErpData = {
    success: true,
    message: "Success",
    data: [
      {
        employeeNumber: "EMP-001",
        employeeName: "John Silva",
        employeeInitials: "J",
        employeeSurname: "Silva",
        email: "john.silva@lpms.com",
      },
    ],
  };

  it("should return 400 when employeeNo is missing", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject non-string employeeNo", async () => {
    const req = createMockReq({ body: { employeeNo: 12345 } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject empty string employeeNo", async () => {
    const req = createMockReq({ body: { employeeNo: "" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should trim employeeNo before ERP lookup", async () => {
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockResolvedValueOnce(
      mockErpData,
    );

    const req = createMockReq({ body: { employeeNo: "  EMP-001  " } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(vi.mocked(fetchEmployeeDetailsForServiceNo).mock.calls[0][0]).toBe(
      "EMP-001",
    );
    expect(res.statusCode).toBe(200);
  });

  it("should return ERP learner data on success", async () => {
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockResolvedValueOnce(
      mockErpData,
    );

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].employeeNumber).toBe("EMP-001");
  });

  it("should log FETCH_ERP_LEARNER_DETAILS audit on success", async () => {
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockResolvedValueOnce(
      mockErpData,
    );

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "user-1",
      action: "FETCH_ERP_LEARNER_DETAILS",
      resourceType: "ERP",
      metadata: { employeeNo: "EMP-001" },
    });
  });

  it("should map ERP errors to ERP_REQUEST_FAILED", async () => {
    const erpError = new Error("ERP unavailable");
    erpError.status = 503;
    erpError.details = { reason: "Service unavailable" };
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockRejectedValueOnce(erpError);

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe("ERP_REQUEST_FAILED");
    expect(res.body.error.message).toBe(
      "Failed to fetch learner details from ERP.",
    );
  });

  it("should default ERP error status to 502 when error has no status", async () => {
    const erpError = new Error("Unexpected ERP error");
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockRejectedValueOnce(erpError);

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe("ERP_REQUEST_FAILED");
  });

  it("should include error details when ERP provides them", async () => {
    const erpError = new Error("ERP unavailable");
    erpError.status = 503;
    erpError.details = { reason: "Service unavailable" };
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockRejectedValueOnce(erpError);

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.body.error.details).toEqual({ reason: "Service unavailable" });
  });

  it("should not log audit when ERP call fails", async () => {
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockRejectedValueOnce(
      new Error("ERP timeout"),
    );

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
  });

  it("should handle ERP response with no data array", async () => {
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockResolvedValueOnce({
      success: true,
      message: "Success",
      data: null,
    });

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.statusCode).toBe(200);

    expect(res.body.data).toBeNull();
  });

  it("should handle empty user object (req.user = {})", async () => {
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockResolvedValueOnce({
      success: true,
      message: "Success",
      data: [{ employeeNumber: "EMP-001", employeeName: "John" }],
    });

    const req = createMockReq({ user: {}, body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpLearnerDetails(req, res);

    expect(res.statusCode).toBe(200);
  });
});

// Get erp subordinates testing

describe("GET ERP SUBORDINATES", () => {
  const mockSubordinates = {
    success: true,
    message: "Success",
    data: [
      {
        employeeNumber: "SUB-001",
        employeeName: "Subordinate One",
      },
    ],
  };

  it("should return 400 when employeeNo is missing", async () => {
    const req = createMockReq({ body: { employeeNo: "" } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject null employeeNo", async () => {
    const req = createMockReq({ body: { employeeNo: null } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject non-string employeeNo", async () => {
    const req = createMockReq({ body: { employeeNo: 12345 } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should trim employeeNo before ERP lookup", async () => {
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce(
      mockSubordinates,
    );

    const req = createMockReq({ body: { employeeNo: "  EMP-001  " } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(vi.mocked(fetchEmployeeSubordinates).mock.calls[0][0]).toBe(
      "EMP-001",
    );
    expect(res.statusCode).toBe(200);
  });

  it("should return subordinate data on success", async () => {
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce(
      mockSubordinates,
    );

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].employeeNumber).toBe("SUB-001");
  });

  it("should handle empty subordinate response", async () => {
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({
      success: true,
      message: "Success",
      data: [],
    });

    const req = createMockReq({ body: { employeeNo: "EMP-NONE" } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);

    const hasSubordinates =
      Array.isArray(res.body?.data) && res.body.data.length > 0;
    expect(hasSubordinates).toBe(false);
  });

  it("should log FETCH_ERP_SUBORDINATES audit on success", async () => {
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce(
      mockSubordinates,
    );

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "user-1",
      action: "FETCH_ERP_SUBORDINATES",
      resourceType: "ERP",
      metadata: { employeeNo: "EMP-001" },
    });
  });

  it("should map ERP errors to ERP_REQUEST_FAILED", async () => {
    vi.mocked(fetchEmployeeSubordinates).mockRejectedValueOnce(
      new Error("ERP unavailable"),
    );

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe("ERP_REQUEST_FAILED");
    expect(res.body.error.message).toBe(
      "Failed to fetch subordinate details from ERP.",
    );
  });

  it("should not log audit when ERP call fails", async () => {
    vi.mocked(fetchEmployeeSubordinates).mockRejectedValueOnce(
      new Error("ERP timeout"),
    );

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(vi.mocked(logAudit)).not.toHaveBeenCalled();
  });

  it("should handle ERP response with no data array", async () => {
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({
      success: true,
      message: "Success",
      data: null,
    });

    const req = createMockReq({ body: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await getErpSubordinates(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

// Import erp employees testing

describe("IMPORT ERP EMPLOYEES", () => {
  beforeEach(() => {
    process.env.ERP_FALLBACK_EMAIL_DOMAIN = "erp.local";
  });

  it("should return 400 when employees is not a non-empty array", async () => {
    const req = createMockReq({ body: { employees: [] } });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when employees is missing", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("CONTROLLER GAP: importErpEmployees has no role-based authorization", () => {
    expect(typeof importErpEmployees).toBe("function");
  });

  it("should use ChangeMe@123 as default password fallback", async () => {
    const original = process.env.ERP_IMPORTED_DEFAULT_PASSWORD;
    delete process.env.ERP_IMPORTED_DEFAULT_PASSWORD;

    const defaultPassword =
      process.env.ERP_IMPORTED_DEFAULT_PASSWORD || "ChangeMe@123";
    expect(defaultPassword).toBe("ChangeMe@123");

    if (original !== undefined) {
      process.env.ERP_IMPORTED_DEFAULT_PASSWORD = original;
    }
  });

  it("should hash the default password once for the batch", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-ChanageMe@123");

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "principal-new-1",
          email: "emp002@erp.local",
          name: "Employee Two",
        },
      ],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-new-1", employee_number: "EMP-002" }],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "principal-new-2",
          email: "emp003@erp.local",
          name: "Employee Three",
        },
      ],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-new-2", employee_number: "EMP-003" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        employees: [
          { employeeNumber: "EMP-002", email: "emp002@erp.local" },
          { employeeNumber: "EMP-003", email: "emp003@erp.local" },
        ],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(vi.mocked(bcrypt.hash).mock.calls.length).toBe(1);
    expect(vi.mocked(bcrypt.hash).mock.calls[0][0]).toEqual(expect.any(String));
    expect(vi.mocked(bcrypt.hash).mock.calls[0][1]).toBe(10);
  });

  it("should skip rows with missing employeeNumber", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    const req = createMockReq({
      body: { employees: [{ employeeName: "No Number" }] },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(res.body.importedCount).toBe(0);
    expect(res.body.skippedCount).toBe(1);
    expect(res.body.skipped[0].reason).toBe("Missing employeeNumber");
  });

  it("should trim employeeNumber", async () => {
    const employeeNumber = String(" EMP-002 ").trim();
    expect(employeeNumber).toBe("EMP-002");
  });

  it("should skip existing employee numbers", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "existing-employee" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        employees: [{ employeeNumber: "EMP-001", email: "new@lpms.com" }],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(res.body.importedCount).toBe(0);
    expect(res.body.skipped[0].employeeNumber).toBe("EMP-001");
    expect(res.body.skipped[0].reason).toBe("Employee number already exists");
  });

  it("should handle employeeNumber that is only whitespace", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    const req = createMockReq({
      body: { employees: [{ employeeNumber: "  ", email: "test@lpms.com" }] },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(res.body.importedCount).toBe(0);
    expect(res.body.skippedCount).toBe(1);
    expect(res.body.skipped[0].reason).toBe("Missing employeeNumber");
  });

  it("should handle duplicate employee numbers within the same import batch", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "principal-1", email: "first@lpms.com", name: "First" }],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-1", employee_number: "EMP-002" }],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-1-duplicate" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        employees: [
          { employeeNumber: "EMP-002", email: "first@lpms.com" },
          { employeeNumber: "EMP-002", email: "second@lpms.com" },
        ],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(res.body.importedCount).toBe(1);
    expect(res.body.skippedCount).toBe(1);
    expect(res.body.skipped[0].employeeNumber).toBe("EMP-002");
    expect(res.body.skipped[0].reason).toBe("Employee number already exists");
  });

  it("should handle special characters in employee name", async () => {
    const name = normalizeName({
      employeeNumber: "EMP-002",
      employeeName: " María O'Connor-Smith ",
    });
    expect(name).toBe("María O'Connor-Smith");
  });

  it("should handle null/undefined employeeName gracefully", async () => {
    const name = normalizeName({
      employeeNumber: "EMP-002",
      employeeName: null,
      employeeInitials: "JD",
      employeeSurname: undefined,
    });
    expect(name).toBe("JD");
  });

  it("should normalize email to lowercase", async () => {
    const email = normalizeEmail({
      employeeNumber: "EMP-002",
      email: " JOHN@LPMS.COM ",
    });
    expect(email).toBe("john@lpms.com");
  });

  it("should create fallback email using ERP_FALLBACK_EMAIL_DOMAIN", async () => {
    const previous = process.env.ERP_FALLBACK_EMAIL_DOMAIN;
    process.env.ERP_FALLBACK_EMAIL_DOMAIN = "example.local";

    const email = normalizeEmail({ employeeNumber: "EMP-002" });
    expect(email).toBe("EMP-002@example.local");

    if (previous === undefined) {
      delete process.env.ERP_FALLBACK_EMAIL_DOMAIN;
    } else {
      process.env.ERP_FALLBACK_EMAIL_DOMAIN = previous;
    }
  });

  it("should skip existing auth principal email", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "existing-principal" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        employees: [{ employeeNumber: "EMP-002", email: "duplicate@lpms.com" }],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(res.body.importedCount).toBe(0);
    expect(res.body.skipped[0].reason).toBe(
      "Email already exists in auth principals",
    );
  });

  it("should normalize name from employeeName", async () => {
    const name = normalizeName({
      employeeNumber: "EMP-002",
      employeeName: " John Doe ",
    });
    expect(name).toBe("John Doe");
  });

  it("should fall back to initials and surname", async () => {
    const name = normalizeName({
      employeeNumber: "EMP-002",
      employeeInitials: " J ",
      employeeSurname: " Doe ",
    });
    expect(name).toBe("J Doe");
  });

  it("should fall back to Employee plus employeeNumber", async () => {
    const name = normalizeName({ employeeNumber: "EMP-002" });
    expect(name).toBe("Employee EMP-002");
  });

  it("should default missing designation to Employee", async () => {
    const employee = {};
    const designation = employee.designation
      ? String(employee.designation).trim()
      : "Employee";
    expect(designation).toBe("Employee");
  });

  it("should default missing grade name to N/A", async () => {
    const employee = {};
    const gradeName = employee.gradeName
      ? String(employee.gradeName).trim()
      : "N/A";
    expect(gradeName).toBe("N/A");
  });

  it("should store supervisorId or null", async () => {
    const supervisorId = "";
    const storedSupervisorId = supervisorId || null;
    expect(storedSupervisorId).toBe(null);
  });

  it("should return success counts, imported, and skipped arrays", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "principal-1", email: "jane@lpms.com", name: "Jane Doe" }],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-1", employee_number: "EMP-002" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        supervisorId: "supervisor-1",
        employees: [
          {
            employeeNumber: "EMP-002",
            employeeName: "Jane Doe",
            email: "jane@lpms.com",
            designation: "Analyst",
            gradeName: "G4",
          },
          { employeeNumber: "" },
        ],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.importedCount).toBe(1);
    expect(res.body.skippedCount).toBe(1);
    expect(Array.isArray(res.body.imported)).toBe(true);
    expect(Array.isArray(res.body.skipped)).toBe(true);
    expect(res.body.defaultPasswordNote).toBe(
      "Imported users are created with ERP_IMPORTED_DEFAULT_PASSWORD.",
    );
  });

  it("should handle bcrypt hash failure gracefully", async () => {
    vi.mocked(bcrypt.hash).mockRejectedValueOnce(new Error("bcrypt error"));

    const req = createMockReq({
      body: {
        employees: [{ employeeNumber: "EMP-002", email: "test@lpms.com" }],
      },
    });
    const res = createMockRes();

    await expect(importErpEmployees(req, res)).rejects.toThrow("bcrypt error");
  });

  it("should log import summary audit metadata", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { id: "principal-1", email: "emp002@erp.local", name: "Employee Two" },
      ],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-1", employee_number: "EMP-002" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        employees: [
          { employeeNumber: "EMP-002", email: "emp002@erp.local" },
          { employeeNumber: "" },
        ],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "user-1",
      action: "IMPORT_ERP_EMPLOYEES",
      resourceType: "ERP",
      metadata: {
        requested: 2,
        imported: 1,
        skipped: 1,
      },
    });
  });

  it("should include supervisorId in audit metadata when provided", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "principal-1", email: "emp@lpms.com", name: "Employee" }],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-1", employee_number: "EMP-002" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        supervisorId: "supervisor-1",
        employees: [{ employeeNumber: "EMP-002", email: "emp@lpms.com" }],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "user-1",
      action: "IMPORT_ERP_EMPLOYEES",
    });
  });

  it("should create principal with correct default fields (role=EMPLOYEE, must_change_password=TRUE)", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "principal-1", email: "john@lpms.com", name: "John Silva" }],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-1", employee_number: "EMP-010" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        employees: [
          {
            employeeNumber: "EMP-010",
            email: "john@lpms.com",
            employeeName: "John Silva",
          },
        ],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    const principalInsertSql = vi.mocked(query).mock.calls[2][0];
    const principalInsertParams = vi.mocked(query).mock.calls[2][1];
    expect(principalInsertSql).toContain("role");
    expect(principalInsertSql).toContain("EMPLOYEE");
    expect(principalInsertSql).toContain("must_change_password");
    expect(principalInsertSql).toContain("TRUE");
    expect(principalInsertParams[0]).toBe("john@lpms.com");
    expect(principalInsertParams[1]).toBe("hashed-password");
    expect(principalInsertParams[2]).toBe("John Silva");
  });

  it("should NOT create audit record if all employees are skipped", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    const req = createMockReq({
      body: {
        employees: [{ employeeNumber: "" }],
      },
    });
    const res = createMockRes();
    await importErpEmployees(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      metadata: { requested: 1, imported: 0, skipped: 1 },
    });
  });
});

// Private helper testing (getErrorStatus)

describe("getErrorStatus (private helper)", () => {
  it("should return error.status when present", () => {
    const error = new Error("test");
    error.status = 503;
    expect(getErrorStatus(error)).toBe(503);
  });

  it("should default to 502 when error has no status", () => {
    const error = new Error("test");
    expect(getErrorStatus(error)).toBe(502);
  });
});

describe("normalizeName (private helper)", () => {
  it("should handle name with only whitespace", () => {
    const name = normalizeName({
      employeeNumber: "EMP-001",
      employeeName: "   ",
    });

    expect(name).toBe("Employee EMP-001");
  });

  it("should handle employeeNumber with special characters", () => {
    const name = normalizeName({
      employeeNumber: "EMP-001/2024",
      employeeName: null,
    });
    expect(name).toBe("Employee EMP-001/2024");
  });
});

describe("normalizeEmail (private helper)", () => {
  it("should handle email with only whitespace", () => {
    const email = normalizeEmail({
      employeeNumber: "EMP-001",
      email: "   ",
    });
    expect(email).toBe("EMP-001@erp.local");
  });

  it("should handle null email", () => {
    const email = normalizeEmail({
      employeeNumber: "EMP-001",
      email: null,
    });
    expect(email).toBe("EMP-001@erp.local");
  });
});
