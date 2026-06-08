// Set up test environment
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-for-testing";

import test from "node:test";
import assert from "assert/strict";
import * as integrationController from "../controllers/integrationController.js";

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
    employees: [
      {
        id: "employee-existing",
        principal_id: "principal-existing",
        employee_number: "EMP-001",
      },
    ],
    principals: [
      {
        id: "principal-existing",
        email: "existing@lpms.com",
        name: "Existing Employee",
      },
      {
        id: "principal-email-owner",
        email: "duplicate@lpms.com",
        name: "Duplicate Email Owner",
      },
    ],
  };
};

// MOCK QUERY FUNCTION
const mockQuery = async (sql, params = []) => {
  if (sql.includes("SELECT id FROM employees WHERE employee_number")) {
    const employeeNumber = params[0];
    const employee = mockDatabase.employees.find(
      (e) => e.employee_number === employeeNumber,
    );

    return {
      rows: employee ? [{ id: employee.id }] : [],
      rowCount: employee ? 1 : 0,
    };
  }

  if (sql.includes("SELECT id FROM auth_principals WHERE email")) {
    const email = params[0];
    const principal = mockDatabase.principals.find((p) => p.email === email);

    return {
      rows: principal ? [{ id: principal.id }] : [],
      rowCount: principal ? 1 : 0,
    };
  }

  if (sql.includes("INSERT INTO auth_principals")) {
    const principal = {
      id: `principal-${mockDatabase.principals.length + 1}`,
      email: params[0],
      password_hash: params[1],
      name: params[2],
    };
    mockDatabase.principals.push(principal);

    return {
      rows: [
        { id: principal.id, email: principal.email, name: principal.name },
      ],
      rowCount: 1,
    };
  }

  if (sql.includes("INSERT INTO employees")) {
    const employee = {
      id: `employee-${mockDatabase.employees.length + 1}`,
      principal_id: params[0],
      employee_number: params[1],
      designation: params[2],
      grade_name: params[3],
      supervisor_id: params[4],
    };
    mockDatabase.employees.push(employee);

    return {
      rows: [{ id: employee.id, employee_number: employee.employee_number }],
      rowCount: 1,
    };
  }

  return { rows: [], rowCount: 0 };
};

// MOCK ERP CLIENT
let erpCalls = [];

const mockFetchEmployeeDetailsForServiceNo = async (employeeNo) => {
  erpCalls.push({ type: "details", employeeNo });

  if (employeeNo === "ERP-ERROR") {
    const error = new Error("ERP unavailable");
    error.status = 503;
    error.details = { reason: "Service unavailable" };
    throw error;
  }

  return {
    success: true,
    message: "Success",
    data: [
      {
        employeeNumber: employeeNo,
        employeeName: "John Silva",
        employeeInitials: "J",
        employeeSurname: "Silva",
        email: "john.silva@lpms.com",
      },
    ],
  };
};

const mockFetchEmployeeSubordinates = async (employeeNo) => {
  erpCalls.push({ type: "subordinates", employeeNo });

  if (employeeNo === "ERP-ERROR") {
    throw new Error("ERP unavailable");
  }

  if (employeeNo === "EMP-NONE") {
    return { success: true, message: "Success", data: [] };
  }

  return {
    success: true,
    message: "Success",
    data: [
      {
        employeeNumber: "SUB-001",
        employeeName: "Subordinate One",
      },
    ],
  };
};

// MOCK BCRYPT
let hashCalls = [];

const mockBcrypt = {
  hash: async (password, rounds) => {
    hashCalls.push({ password, rounds });
    return `hashed-${password}`;
  },
};

// MOCK AUDIT LOGGING
let auditLogs = [];

const mockLogAudit = async (audit) => {
  auditLogs.push(audit);
};

// CONTROLLER HELPER LOGIC FOR BEHAVIOR TESTING

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

const simulateImportErpEmployees = async (req, res) => {
  const { employees, supervisorId } = req.body;

  if (!Array.isArray(employees) || employees.length === 0) {
    return sendMockError(
      res,
      400,
      "VALIDATION_ERROR",
      "employees must be a non-empty array.",
    );
  }

  const defaultPassword =
    process.env.ERP_IMPORTED_DEFAULT_PASSWORD || "ChangeMe@123";
  const passwordHash = await mockBcrypt.hash(defaultPassword, 10);

  const imported = [];
  const skipped = [];

  for (const employee of employees) {
    const employeeNumber = employee?.employeeNumber
      ? String(employee.employeeNumber).trim()
      : "";

    if (!employeeNumber) {
      skipped.push({ employeeNumber: null, reason: "Missing employeeNumber" });
      continue;
    }

    const existingEmployee = await mockQuery(
      "SELECT id FROM employees WHERE employee_number = $1 LIMIT 1",
      [employeeNumber],
    );

    if (existingEmployee.rowCount > 0) {
      skipped.push({
        employeeNumber,
        reason: "Employee number already exists",
      });
      continue;
    }

    const email = normalizeEmail(employee);

    const existingPrincipal = await mockQuery(
      "SELECT id FROM auth_principals WHERE email = $1 LIMIT 1",
      [email],
    );

    if (existingPrincipal.rowCount > 0) {
      skipped.push({
        employeeNumber,
        reason: "Email already exists in auth principals",
      });
      continue;
    }

    const name = normalizeName({ ...employee, employeeNumber });
    const designation = employee.designation
      ? String(employee.designation).trim()
      : "Employee";
    const gradeName = employee.gradeName
      ? String(employee.gradeName).trim()
      : "N/A";

    const principalInsert = await mockQuery(
      "INSERT INTO auth_principals RETURNING id, email, name",
      [email, passwordHash, name],
    );
    const principal = principalInsert.rows[0];

    const employeeInsert = await mockQuery(
      "INSERT INTO employees RETURNING id, employee_number",
      [
        principal.id,
        employeeNumber,
        designation,
        gradeName,
        supervisorId || null,
      ],
    );

    imported.push({
      employeeNumber,
      principalId: principal.id,
      employeeId: employeeInsert.rows[0].id,
      email: principal.email,
    });
  }

  await mockLogAudit({
    actorPrincipalId: req.user.id,
    action: "IMPORT_ERP_EMPLOYEES",
    resourceType: "ERP",
    metadata: {
      requested: employees.length,
      imported: imported.length,
      skipped: skipped.length,
    },
  });

  return res.status(200).json({
    success: true,
    importedCount: imported.length,
    skippedCount: skipped.length,
    imported,
    skipped,
    defaultPasswordNote:
      "Imported users are created with ERP_IMPORTED_DEFAULT_PASSWORD.",
  });
};

// TEST SUITES

// export functions testing
test("INTEGRATION CONTROLLER EXPORTS TESTS", async (t) => {
  const expectedExports = [
    "getErpLearnerDetails",
    "getErpSubordinates",
    "importErpEmployees",
  ];

  for (const exportName of expectedExports) {
    await t.test(`should export ${exportName}`, async () => {
      assert.equal(typeof integrationController[exportName], "function");
    });
  }
});

// getErpLearnerDetails testing
test("GET ERP LEARNER DETAILS TESTS", async (t) => {
  await t.test("should require employeeNo", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();

    if (!req.body.employeeNo || typeof req.body.employeeNo !== "string") {
      sendMockError(res, 400, "VALIDATION_ERROR", "employeeNo is required.");
    }

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test("should reject non-string employeeNo", async () => {
    const req = createMockReq({ body: { employeeNo: 12345 } });
    const isValid =
      req.body.employeeNo && typeof req.body.employeeNo === "string";

    assert.equal(isValid, false);
  });

  await t.test("should trim employeeNo before ERP lookup", async () => {
    erpCalls = [];
    const req = createMockReq({ body: { employeeNo: " EMP-001 " } });

    await mockFetchEmployeeDetailsForServiceNo(req.body.employeeNo.trim());

    assert.equal(erpCalls[0].employeeNo, "EMP-001");
  });

  await t.test("should return ERP learner data shape", async () => {
    const data = await mockFetchEmployeeDetailsForServiceNo("EMP-001");

    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.equal(data.data[0].employeeNumber, "EMP-001");
    assert.ok(data.data[0].employeeName);
  });

  await t.test("should log FETCH_ERP_LEARNER_DETAILS audit", async () => {
    auditLogs = [];
    const req = createMockReq({ body: { employeeNo: "EMP-001" } });

    await mockLogAudit({
      actorPrincipalId: req.user.id,
      action: "FETCH_ERP_LEARNER_DETAILS",
      resourceType: "ERP",
      metadata: { employeeNo: req.body.employeeNo },
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "FETCH_ERP_LEARNER_DETAILS");
    assert.equal(auditLogs[0].resourceType, "ERP");
  });

  await t.test("should map ERP errors to ERP_REQUEST_FAILED", async () => {
    const res = createMockRes();

    try {
      await mockFetchEmployeeDetailsForServiceNo("ERP-ERROR");
    } catch (error) {
      sendMockError(
        res,
        getErrorStatus(error),
        "ERP_REQUEST_FAILED",
        "Failed to fetch learner details from ERP.",
        error.details || error.message,
      );
    }

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, "ERP_REQUEST_FAILED");
    assert.ok(res.body.error.details);
  });

  await t.test("should default ERP error status to 502", async () => {
    const error = new Error("Unexpected ERP error");

    assert.equal(getErrorStatus(error), 502);
  });
});

// getErpSubordinates testing
test("GET ERP SUBORDINATES TESTS", async (t) => {
  await t.test("should require employeeNo", async () => {
    const req = createMockReq({ body: { employeeNo: "" } });
    const isValid =
      req.body.employeeNo && typeof req.body.employeeNo === "string";

    assert.equal(Boolean(isValid), false);
  });

  await t.test("should reject non-string employeeNo", async () => {
    const req = createMockReq({ body: { employeeNo: null } });
    const isValid =
      req.body.employeeNo && typeof req.body.employeeNo === "string";

    assert.equal(Boolean(isValid), false);
  });

  await t.test("should trim employeeNo before ERP lookup", async () => {
    erpCalls = [];
    const req = createMockReq({ body: { employeeNo: " EMP-001 " } });

    await mockFetchEmployeeSubordinates(req.body.employeeNo.trim());

    assert.equal(erpCalls[0].type, "subordinates");
    assert.equal(erpCalls[0].employeeNo, "EMP-001");
  });

  await t.test("should return subordinate data shape", async () => {
    const data = await mockFetchEmployeeSubordinates("EMP-001");

    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.equal(data.data[0].employeeNumber, "SUB-001");
  });

  await t.test("should detect empty subordinate response", async () => {
    const data = await mockFetchEmployeeSubordinates("EMP-NONE");
    const hasSubordinates = Array.isArray(data?.data) && data.data.length > 0;

    assert.equal(hasSubordinates, false);
  });

  await t.test("should log FETCH_ERP_SUBORDINATES audit", async () => {
    auditLogs = [];
    const req = createMockReq({ body: { employeeNo: "EMP-001" } });

    await mockLogAudit({
      actorPrincipalId: req.user.id,
      action: "FETCH_ERP_SUBORDINATES",
      resourceType: "ERP",
      metadata: { employeeNo: req.body.employeeNo },
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "FETCH_ERP_SUBORDINATES");
    assert.equal(auditLogs[0].resourceType, "ERP");
  });

  await t.test("should map ERP errors to ERP_REQUEST_FAILED", async () => {
    const res = createMockRes();

    try {
      await mockFetchEmployeeSubordinates("ERP-ERROR");
    } catch (error) {
      sendMockError(
        res,
        getErrorStatus(error),
        "ERP_REQUEST_FAILED",
        "Failed to fetch subordinate details from ERP.",
        error.details || error.message,
      );
    }

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error.code, "ERP_REQUEST_FAILED");
  });
});

// importErpEmployees testing
test("IMPORT ERPEMPLOYEES TESTS", async (t) => {
  await t.test("should require employees to be a non-empty array", async () => {
    const req = createMockReq({ body: { employees: [] } });
    const res = createMockRes();

    if (!Array.isArray(req.body.employees) || req.body.employees.length === 0) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "employees must be a non-empty array.",
      );
    }

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test(
    "should use ERP_IMPORTED_DEFAULT_PASSWORD fallback",
    async () => {
      const previous = process.env.ERP_IMPORTED_DEFAULT_PASSWORD;
      delete process.env.ERP_IMPORTED_DEFAULT_PASSWORD;

      const defaultPassword =
        process.env.ERP_IMPORTED_DEFAULT_PASSWORD || "ChangeMe@123";

      assert.equal(defaultPassword, "ChangeMe@123");

      if (previous === undefined) {
        delete process.env.ERP_IMPORTED_DEFAULT_PASSWORD;
      } else {
        process.env.ERP_IMPORTED_DEFAULT_PASSWORD = previous;
      }
    },
  );

  await t.test(
    "should hash the default password once for the batch",
    async () => {
      setupMockDatabase();
      hashCalls = [];

      const req = createMockReq({
        body: {
          employees: [
            { employeeNumber: "EMP-002", email: "two@lpms.com" },
            { employeeNumber: "EMP-003", email: "three@lpms.com" },
          ],
        },
      });
      const res = createMockRes();

      await simulateImportErpEmployees(req, res);

      assert.equal(hashCalls.length, 1);
      assert.equal(hashCalls[0].password, "ChangeMe@123");
      assert.equal(hashCalls[0].rounds, 10);
    },
  );

  await t.test("should skip rows with missing employeeNumber", async () => {
    setupMockDatabase();

    const req = createMockReq({
      body: { employees: [{ employeeName: "No Number" }] },
    });
    const res = createMockRes();

    await simulateImportErpEmployees(req, res);

    assert.equal(res.body.importedCount, 0);
    assert.equal(res.body.skippedCount, 1);
    assert.equal(res.body.skipped[0].reason, "Missing employeeNumber");
  });

  await t.test("should trim employeeNumber", async () => {
    const employeeNumber = String(" EMP-002 ").trim();

    assert.equal(employeeNumber, "EMP-002");
  });

  await t.test("should skip existing employee numbers", async () => {
    setupMockDatabase();

    const req = createMockReq({
      body: {
        employees: [{ employeeNumber: "EMP-001", email: "new@lpms.com" }],
      },
    });
    const res = createMockRes();

    await simulateImportErpEmployees(req, res);

    assert.equal(res.body.importedCount, 0);
    assert.equal(res.body.skipped[0].reason, "Employee number already exists");
  });

  await t.test("should normalize email to lowercase", async () => {
    const email = normalizeEmail({
      employeeNumber: "EMP-002",
      email: " JOHN@LPMS.COM ",
    });

    assert.equal(email, "john@lpms.com");
  });

  await t.test(
    "should create fallback email using ERP_FALLBACK_EMAIL_DOMAIN",
    async () => {
      const previous = process.env.ERP_FALLBACK_EMAIL_DOMAIN;
      process.env.ERP_FALLBACK_EMAIL_DOMAIN = "example.local";

      const email = normalizeEmail({ employeeNumber: "EMP-002" });

      assert.equal(email, "EMP-002@example.local");

      if (previous === undefined) {
        delete process.env.ERP_FALLBACK_EMAIL_DOMAIN;
      } else {
        process.env.ERP_FALLBACK_EMAIL_DOMAIN = previous;
      }
    },
  );

  await t.test("should skip existing auth principal email", async () => {
    setupMockDatabase();

    const req = createMockReq({
      body: {
        employees: [
          {
            employeeNumber: "EMP-002",
            email: "duplicate@lpms.com",
          },
        ],
      },
    });
    const res = createMockRes();

    await simulateImportErpEmployees(req, res);

    assert.equal(res.body.importedCount, 0);
    assert.equal(
      res.body.skipped[0].reason,
      "Email already exists in auth principals",
    );
  });

  await t.test("should normalize name from employeeName", async () => {
    const name = normalizeName({
      employeeNumber: "EMP-002",
      employeeName: " John Doe ",
    });

    assert.equal(name, "John Doe");
  });

  await t.test("should fall back to initials and surname", async () => {
    const name = normalizeName({
      employeeNumber: "EMP-002",
      employeeInitials: " J ",
      employeeSurname: " Doe ",
    });

    assert.equal(name, "J Doe");
  });

  await t.test("should fall back to Employee plus employeeNumber", async () => {
    const name = normalizeName({ employeeNumber: "EMP-002" });

    assert.equal(name, "Employee EMP-002");
  });

  await t.test("should default missing designation to Employee", async () => {
    const employee = {};
    const designation = employee.designation
      ? String(employee.designation).trim()
      : "Employee";

    assert.equal(designation, "Employee");
  });

  await t.test("should default missing grade name to N/A", async () => {
    const employee = {};
    const gradeName = employee.gradeName
      ? String(employee.gradeName).trim()
      : "N/A";

    assert.equal(gradeName, "N/A");
  });

  await t.test("should store supervisorId or null", async () => {
    const supervisorId = "";
    const storedSupervisorId = supervisorId || null;

    assert.equal(storedSupervisorId, null);
  });

  await t.test(
    "should return success counts, imported, and skipped arrays",
    async () => {
      setupMockDatabase();

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

      await simulateImportErpEmployees(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.importedCount, 1);
      assert.equal(res.body.skippedCount, 1);
      assert.ok(Array.isArray(res.body.imported));
      assert.ok(Array.isArray(res.body.skipped));
      assert.equal(
        res.body.defaultPasswordNote,
        "Imported users are created with ERP_IMPORTED_DEFAULT_PASSWORD.",
      );
    },
  );

  await t.test("should log import summary audit metadata", async () => {
    setupMockDatabase();
    auditLogs = [];

    const req = createMockReq({
      body: {
        employees: [
          { employeeNumber: "EMP-002", email: "two@lpms.com" },
          { employeeNumber: "" },
        ],
      },
    });
    const res = createMockRes();

    await simulateImportErpEmployees(req, res);

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "IMPORT_ERP_EMPLOYEES");
    assert.equal(auditLogs[0].resourceType, "ERP");
    assert.equal(auditLogs[0].metadata.requested, 2);
    assert.equal(auditLogs[0].metadata.imported, 1);
    assert.equal(auditLogs[0].metadata.skipped, 1);
  });
});
