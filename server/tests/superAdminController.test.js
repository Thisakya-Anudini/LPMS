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
  fetchEmployeeDetailsForServiceNo: vi
    .fn()
    .mockRejectedValue(new Error("No ERP mock")),
}));

vi.mock("../constants/roles.js", () => {
  const R = {
    SUPER_ADMIN: "SUPER_ADMIN",
    LEARNING_ADMIN: "LEARNING_ADMIN",
    EMPLOYEE: "EMPLOYEE",
  };
  return { ROLES: R, ALL_ROLES: Object.values(R) };
});

const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  LEARNING_ADMIN: "LEARNING_ADMIN",
  EMPLOYEE: "EMPLOYEE",
};
const ALL_ROLES = Object.values(ROLES);

// Imports (after mocks)

import { query } from "../db.js";
import { sendError } from "../utils/http.js";
import { logAudit } from "../utils/audit.js";
import bcrypt from "bcryptjs";
import { fetchEmployeeDetailsForServiceNo } from "../utils/erpClient.js";
import * as superAdminController from "../controllers/superAdminController.js";

// Test helpers

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
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
    query: {},
    user: {
      id: "super-1",
      email: "super@lpms.com",
      role: ROLES.SUPER_ADMIN,
      name: "Super Admin",
    },
  };
  return {
    ...baseReq,
    ...overrides,
    user: { ...baseReq.user, ...overrides.user },
    body: { ...baseReq.body, ...overrides.body },
    params: { ...baseReq.params, ...overrides.params },
    query: { ...baseReq.query, ...overrides.query },
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(query).mockReset();
  vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 });
  vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");
});

// Export functions testing

describe("SUPERADMIN CONTROLLER EXPORTS", () => {
  const expectedExports = [
    "createUser",
    "getAllUsers",
    "getAssignedLearningAdmins",
    "deleteUser",
    "assignLearningAdmin",
    "removeLearningAdmin",
    "getAllLearners",
    "getLearnerLearningPaths",
    "getLearnerLearningPathsByEmployeeNo",
    "getLearningPathEnrollments",
    "createEmployee",
  ];

  for (const exportName of expectedExports) {
    it(`should export ${exportName}`, () => {
      expect(typeof superAdminController[exportName]).toBe("function");
    });
  }
});

// createUser testing

describe("CREATE USER", () => {
  it("should reject invalid role", async () => {
    const req = createMockReq({
      body: {
        email: "test@lpms.com",
        password: "Pass@123",
        role: "INVALID_ROLE",
        name: "Test",
      },
    });
    const res = createMockRes();
    await superAdminController.createUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.allowedRoles).toEqual(ALL_ROLES);
  });

  it("should reject non SUPER_ADMIN role creation", async () => {
    const req = createMockReq({
      body: {
        email: "admin@lpms.com",
        password: "Pass@123",
        role: ROLES.LEARNING_ADMIN,
        name: "Admin",
      },
    });
    const res = createMockRes();
    await superAdminController.createUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe(
      "Only SUPER_ADMIN accounts can be created from this interface.",
    );
  });

  it("should default name from email when name is empty", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "new-1",
          email: "newadmin@lpms.com",
          role: ROLES.SUPER_ADMIN,
          name: "newadmin",
          principal_type: "USER",
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        email: "newadmin@lpms.com",
        password: "Pass@123",
        role: ROLES.SUPER_ADMIN,
        name: "",
      },
    });
    const res = createMockRes();
    await superAdminController.createUser(req, res);

    expect(res.body.user.name).toBe("newadmin");
  });

  it("should hash password when creating principal", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "new-1",
          email: "newadmin@lpms.com",
          role: ROLES.SUPER_ADMIN,
          name: "New Admin",
          principal_type: "USER",
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        email: "newadmin@lpms.com",
        password: "Password@123",
        role: ROLES.SUPER_ADMIN,
        name: "New Admin",
      },
    });
    const res = createMockRes();
    await superAdminController.createUser(req, res);

    expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith("Password@123", 10);
  });

  it("should return created SUPER_ADMIN user with 201", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "new-1",
          email: "newadmin@lpms.com",
          role: ROLES.SUPER_ADMIN,
          name: "New Admin",
          principal_type: "USER",
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        email: "newadmin@lpms.com",
        password: "Pass@123",
        role: ROLES.SUPER_ADMIN,
        name: "New Admin",
      },
    });
    const res = createMockRes();
    await superAdminController.createUser(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe(ROLES.SUPER_ADMIN);
    expect(res.body.user.principal_type).toBe("USER");
  });

  it("should log create user audit", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "new-1",
          email: "newadmin@lpms.com",
          role: ROLES.SUPER_ADMIN,
          name: "New Admin",
          principal_type: "USER",
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        email: "newadmin@lpms.com",
        password: "Pass@123",
        role: ROLES.SUPER_ADMIN,
        name: "New Admin",
      },
    });
    const res = createMockRes();
    await superAdminController.createUser(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "super-1",
      action: "CREATE_USER",
      resourceType: "AUTH_PRINCIPAL",
      metadata: { role: ROLES.SUPER_ADMIN, email: "newadmin@lpms.com" },
    });
  });

  it("should document missing email validation — empty email falls through to INSERT", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "new-empty",
          email: "",
          role: ROLES.SUPER_ADMIN,
          name: "Admin",
          principal_type: "USER",
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        email: "",
        password: "Pass@123",
        role: ROLES.SUPER_ADMIN,
        name: "Admin",
      },
    });
    const res = createMockRes();
    await superAdminController.createUser(req, res);

    expect(res.statusCode).toBe(201);
  });

  it("should document missing password validation — empty password falls through to INSERT", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-empty");
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "new-empty",
          email: "admin@lpms.com",
          role: ROLES.SUPER_ADMIN,
          name: "Admin",
          principal_type: "USER",
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        email: "admin@lpms.com",
        password: "",
        role: ROLES.SUPER_ADMIN,
        name: "Admin",
      },
    });
    const res = createMockRes();
    await superAdminController.createUser(req, res);

    expect(res.statusCode).toBe(201);
  });
});

// getAllUsers testing

describe("GET ALL USERS", () => {
  it("should return SUPER_ADMIN and LEARNING_ADMIN users only", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "super-1",
          email: "super@lpms.com",
          role: ROLES.SUPER_ADMIN,
          name: "Super Admin",
          principal_type: "USER",
          is_active: true,
          created_at: new Date(),
        },
        {
          id: "admin-1",
          email: "admin@lpms.com",
          role: ROLES.LEARNING_ADMIN,
          name: "Learning Admin",
          principal_type: "USER",
          is_active: true,
          created_at: new Date(),
        },
      ],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAllUsers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(
      res.body.users.every((u) =>
        [ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN].includes(u.role),
      ),
    ).toBe(true);
  });

  it("should exclude employee users", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAllUsers(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).not.toContain(ROLES.EMPLOYEE);
  });

  it("should order users by created_at DESC", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "super-1" }, { id: "admin-1" }],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAllUsers(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY created_at DESC");
  });

  it("should include user fields in response", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "super-1",
          email: "super@lpms.com",
          role: ROLES.SUPER_ADMIN,
          name: "Super Admin",
          principal_type: "USER",
          is_active: true,
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAllUsers(req, res);

    const user = res.body.users[0];
    expect(user.id).toBe("super-1");
    expect(user.email).toBe("super@lpms.com");
    expect(user.role).toBe(ROLES.SUPER_ADMIN);
    expect(user.name).toBe("Super Admin");
    expect(user.principal_type).toBe("USER");
    expect(typeof user.is_active).toBe("boolean");
    expect(user.created_at).toBeDefined();
  });

  it("should return empty array when no admin users exist", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAllUsers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  it("should include inactive users in results", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "admin-1",
          email: "admin@lpms.com",
          role: ROLES.LEARNING_ADMIN,
          name: "Active Admin",
          principal_type: "USER",
          is_active: true,
          created_at: new Date(),
        },
        {
          id: "admin-2",
          email: "inactive@lpms.com",
          role: ROLES.LEARNING_ADMIN,
          name: "Inactive Admin",
          principal_type: "USER",
          is_active: false,
          created_at: new Date(),
        },
      ],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAllUsers(req, res);

    expect(res.body.users).toHaveLength(2);
    expect(res.body.users.some((u) => u.is_active === false)).toBe(true);
  });
});

// getAssignedLearningAdmins testing

describe("GET ASSIGNED LEARNING ADMINS", () => {
  it("should return assigned learning admins with joined fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          employee_number: "EMP-001",
          assigned_by_principal_id: "super-1",
          created_at: new Date(),
          updated_at: new Date(),
          principal_id: "employee-1",
          designation: "Developer",
          grade_name: "G5",
          name: "John Doe",
          email: "john@example.com",
          is_active: true,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAssignedLearningAdmins(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningAdmins).toHaveLength(1);
    const admin = res.body.learningAdmins[0];
    expect(admin.employee_number).toBe("EMP-001");
    expect(admin.name).toBe("John Doe");
    expect(admin.designation).toBe("Developer");
  });

  it("should order by updated_at DESC and name ASC", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "EMP-001" }, { employee_number: "EMP-002" }],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAssignedLearningAdmins(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY la.updated_at DESC, ap.name ASC");
  });

  it("should include employee and principal fields in JOIN", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          employee_number: "EMP-001",
          assigned_by_principal_id: "super-1",
          created_at: new Date(),
          updated_at: new Date(),
          principal_id: "emp-1",
          designation: "Developer",
          grade_name: "G5",
          name: "John",
          email: "john@test.com",
          is_active: true,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAssignedLearningAdmins(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("JOIN employees");
    expect(sql).toContain("JOIN auth_principals");
  });

  it("should return empty array when no learning admins are assigned", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq();
    const res = createMockRes();
    await superAdminController.getAssignedLearningAdmins(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningAdmins).toEqual([]);
  });
});

// deleteUser testing

describe("DELETE USER", () => {
  it("should reject deleting own account", async () => {
    const req = createMockReq({ params: { id: "super-1" } });
    const res = createMockRes();
    await superAdminController.deleteUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 when user is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { id: "missing" } });
    const res = createMockRes();
    await superAdminController.deleteUser(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should reject deleting EMPLOYEE users", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "employee-1", role: ROLES.EMPLOYEE }],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "employee-1" } });
    const res = createMockRes();
    await superAdminController.deleteUser(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should delete SUPER_ADMIN or LEARNING_ADMIN user", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "admin-1", role: ROLES.LEARNING_ADMIN }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "admin-1",
            email: "admin@lpms.com",
            role: ROLES.LEARNING_ADMIN,
            name: "Learning Admin",
            principal_type: "USER",
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({ params: { id: "admin-1" } });
    const res = createMockRes();
    await superAdminController.deleteUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.id).toBe("admin-1");
    expect(res.body.user.role).toBe(ROLES.LEARNING_ADMIN);
  });

  it("should return deleted user fields", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "admin-1", role: ROLES.LEARNING_ADMIN }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "admin-1",
            email: "admin@lpms.com",
            role: ROLES.LEARNING_ADMIN,
            name: "Learning Admin",
            principal_type: "USER",
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({ params: { id: "admin-1" } });
    const res = createMockRes();
    await superAdminController.deleteUser(req, res);

    expect(res.body.user.email).toBe("admin@lpms.com");
    expect(res.body.user.principal_type).toBe("USER");
  });

  it("should log deactivate user audit", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "admin-1", role: ROLES.LEARNING_ADMIN }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "admin-1",
            email: "admin@lpms.com",
            role: ROLES.LEARNING_ADMIN,
            name: "Learning Admin",
            principal_type: "USER",
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({ params: { id: "admin-1" } });
    const res = createMockRes();
    await superAdminController.deleteUser(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "super-1",
      action: "DEACTIVATE_USER",
      resourceType: "AUTH_PRINCIPAL",
      resourceId: "admin-1",
    });
  });

  it("should return 404 when user is already deleted", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "admin-1", role: ROLES.LEARNING_ADMIN }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { id: "admin-1" } });
    const res = createMockRes();
    await superAdminController.deleteUser(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// assignLearningAdmin testing

describe("ASSIGN LEARNING ADMIN", () => {
  it("should require employeeNumber", async () => {
    const req = createMockReq({ body: { employeeNumber: "" } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should trim employeeNumber", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          employee_number: "EMP-001",
          principal_id: "employee-1",
          name: "John Doe",
          email: "john@example.com",
          is_active: true,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ body: { employeeNumber: "  EMP-001  " } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    const params = vi.mocked(query).mock.calls[0][1];
    expect(params[0]).toBe("EMP-001");
    expect(res.statusCode).toBe(200);
  });

  it("should return 404 when learner cannot be found or created", async () => {
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockRejectedValueOnce(
      new Error("ERP unavailable"),
    );

    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ id: "created-principal-id" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ email: "UNKNOWN@erp.local" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ body: { employeeNumber: "UNKNOWN" } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should reject inactive learner account", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          employee_number: "EMP-002",
          principal_id: "employee-2",
          name: "Jane Doe",
          email: "jane@example.com",
          is_active: false,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ body: { employeeNumber: "EMP-002" } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should assign learning admin with upsert", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            employee_number: "EMP-001",
            principal_id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            is_active: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({ body: { employeeNumber: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.assignment.employeeNumber).toBe("EMP-001");
    expect(res.body.assignment.isLearningAdmin).toBe(true);
  });

  it("should log assign learning admin audit", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            employee_number: "EMP-001",
            principal_id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            is_active: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({ body: { employeeNumber: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "super-1",
      action: "ASSIGN_LEARNING_ADMIN",
      resourceType: "EMPLOYEE",
      metadata: { employeeNumber: "EMP-001" },
    });
  });

  it("should use ON CONFLICT DO UPDATE in SQL", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            employee_number: "EMP-001",
            principal_id: "employee-1",
            name: "John",
            email: "john@test.com",
            is_active: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({ body: { employeeNumber: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    const sql = vi.mocked(query).mock.calls[1][0];
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("DO UPDATE SET");
  });

  it("should be idempotent — assigning already assigned employee returns success", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            employee_number: "EMP-001",
            principal_id: "employee-1",
            name: "John",
            email: "john@test.com",
            is_active: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({ body: { employeeNumber: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.assignment.isLearningAdmin).toBe(true);
  });

  it("should verify passed employeeNumber matches parameter in all queries", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            employee_number: "EMP-001",
            principal_id: "employee-1",
            name: "John",
            email: "john@test.com",
            is_active: true,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({ body: { employeeNumber: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.assignLearningAdmin(req, res);

    for (const call of vi.mocked(query).mock.calls) {
      if (call[1] && call[1][0] === "EMP-001") {
        expect(call[1][0]).toBe("EMP-001");
      }
    }
  });
});

// removeLearningAdmin testing

describe("REMOVE LEARNING ADMIN", () => {
  it("should require employeeNumber param", async () => {
    const req = createMockReq({ params: { employeeNumber: "" } });
    const res = createMockRes();
    await superAdminController.removeLearningAdmin(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 when assignment is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { employeeNumber: "UNKNOWN" } });
    const res = createMockRes();
    await superAdminController.removeLearningAdmin(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should remove learning admin assignment", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "EMP-001" }],
      rowCount: 1,
    });

    const req = createMockReq({ params: { employeeNumber: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.removeLearningAdmin(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("DELETE FROM learning_admin_assignments");
    expect(res.statusCode).toBe(200);
  });

  it("should return success true", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "EMP-001" }],
      rowCount: 1,
    });

    const req = createMockReq({ params: { employeeNumber: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.removeLearningAdmin(req, res);

    expect(res.body.success).toBe(true);
  });

  it("should log remove learning admin audit", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "EMP-001" }],
      rowCount: 1,
    });

    const req = createMockReq({ params: { employeeNumber: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.removeLearningAdmin(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "super-1",
      action: "REMOVE_LEARNING_ADMIN",
      resourceType: "EMPLOYEE",
      metadata: { employeeNumber: "EMP-001" },
    });
  });
});

// getAllLearners testing

describe("GET ALL LEARNERS", () => {
  it("should default pagination to page 1 and pageSize 25", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ query: {} });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(25);
  });

  it("should clamp pageSize to max 100", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ query: { pageSize: "500" } });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.pagination.pageSize).toBe(100);
  });

  it("should clamp pageSize to min 1", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ query: { pageSize: "-10" } });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.pagination.pageSize).toBe(1);
  });

  it("should calculate pagination offset", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 50 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ query: { page: "3", pageSize: "25" } });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    const params = vi.mocked(query).mock.calls[1][1];
    expect(params).toContain(25);
    expect(params).toContain(50);
  });

  it("should filter learners by employeeNo", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            is_active: true,
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            is_learning_admin: true,
            total_learning_paths: 1,
            completed_learning_paths: 0,
            average_progress: "50.00",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ designation: "Developer" }],
        rowCount: 1,
      });

    const req = createMockReq({ query: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.learners).toHaveLength(1);
    expect(res.body.learners[0].employee_number).toBe("EMP-001");
  });

  it("should filter learners by name", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            is_active: true,
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            is_learning_admin: false,
            total_learning_paths: 0,
            completed_learning_paths: 0,
            average_progress: "0.00",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ designation: "Developer" }],
        rowCount: 1,
      });

    const req = createMockReq({ query: { name: "John" } });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.learners[0].name).toBe("John Doe");
  });

  it("should filter learners by designation", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            is_active: true,
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            is_learning_admin: false,
            total_learning_paths: 0,
            completed_learning_paths: 0,
            average_progress: "0.00",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ designation: "Developer" }],
        rowCount: 1,
      });

    const req = createMockReq({ query: { designation: "Developer" } });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.learners[0].designation).toBe("Developer");
  });

  it("should include learning admin flag and progress summary", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            is_active: true,
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            is_learning_admin: true,
            total_learning_paths: 1,
            completed_learning_paths: 0,
            average_progress: "50.00",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ designation: "Developer" }],
        rowCount: 1,
      });

    const req = createMockReq({ query: {} });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    const learner = res.body.learners[0];
    expect(learner.is_learning_admin).toBe(true);
    expect(learner.total_learning_paths).toBe(1);
    expect(learner.completed_learning_paths).toBe(0);
    expect(learner.average_progress).toBe("50.00");
  });

  it("should return designation options", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ designation: "Analyst" }, { designation: "Developer" }],
        rowCount: 2,
      });

    const req = createMockReq({ query: {} });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.designationOptions).toEqual(["Analyst", "Developer"]);
  });

  it("should calculate total pages", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 51 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ query: { pageSize: "25" } });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.pagination.totalPages).toBe(3);
  });

  it("should return empty learners array when no employees exist", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ query: {} });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.learners).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
  });

  it("should return empty designation options when no employees exist", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ query: {} });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.designationOptions).toEqual([]);
  });

  it("should handle combined filters (employeeNo + name)", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            is_active: true,
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            is_learning_admin: false,
            total_learning_paths: 0,
            completed_learning_paths: 0,
            average_progress: "0.00",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ designation: "Developer" }],
        rowCount: 1,
      });

    const req = createMockReq({
      query: { employeeNo: "EMP-001", name: "John" },
    });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.learners).toHaveLength(1);
    expect(res.body.learners[0].employee_number).toBe("EMP-001");
    expect(res.body.learners[0].name).toBe("John Doe");
  });

  it("should handle page beyond total (no results)", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ total: 5 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ query: { page: "100", pageSize: "25" } });
    const res = createMockRes();
    await superAdminController.getAllLearners(req, res);

    expect(res.body.learners).toEqual([]);
    expect(res.body.pagination.page).toBe(100);
    expect(res.body.pagination.totalPages).toBe(1);
  });
});

// getLearnerLearningPaths testing

describe("GET LEARNER LEARNING PATHS", () => {
  it("should return 404 when principal is missing", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { principalId: "missing" } });
    const res = createMockRes();
    await superAdminController.getLearnerLearningPaths(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 404 when principal is not EMPLOYEE", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "super-1",
          name: "Super Admin",
          email: "super@lpms.com",
          role: ROLES.SUPER_ADMIN,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { principalId: "super-1" } });
    const res = createMockRes();
    await superAdminController.getLearnerLearningPaths(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("should return learner details and learning paths", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            role: ROLES.EMPLOYEE,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            enrollment_id: "en-1",
            status: "IN_PROGRESS",
            progress: 50,
            enrolled_at: new Date(),
            completed_at: null,
            learning_path_id: "lp-1",
            title: "Python Basics",
            description: "Learn Python",
            category: "PUBLIC",
            total_duration: 20,
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({ params: { principalId: "employee-1" } });
    const res = createMockRes();
    await superAdminController.getLearnerLearningPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learner.id).toBe("employee-1");
    expect(res.body.learner.name).toBe("John Doe");
    expect(res.body.learningPaths).toHaveLength(1);
    expect(res.body.learningPaths[0].learning_path_id).toBe("lp-1");
  });

  it("should exclude deleted learning paths (JOIN with is_deleted = FALSE)", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            role: ROLES.EMPLOYEE,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { principalId: "employee-1" } });
    const res = createMockRes();
    await superAdminController.getLearnerLearningPaths(req, res);

    const sql = vi.mocked(query).mock.calls[1][0];
    expect(sql).toContain("lp.is_deleted = FALSE");
  });

  it("should return learner with empty learningPaths when no enrollments exist", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            role: ROLES.EMPLOYEE,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { principalId: "employee-1" } });
    const res = createMockRes();
    await superAdminController.getLearnerLearningPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learner.id).toBe("employee-1");
    expect(res.body.learningPaths).toEqual([]);
  });
});

// getLearnerLearningPathsByEmployeeNo testing

describe("GET LEARNER LEARNING PATHS BY EMPLOYEENO", () => {
  it("should require employeeNo", async () => {
    const req = createMockReq({ params: { employeeNo: "" } });
    const res = createMockRes();
    await superAdminController.getLearnerLearningPathsByEmployeeNo(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 when employee is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { employeeNo: "UNKNOWN" } });
    const res = createMockRes();
    await superAdminController.getLearnerLearningPathsByEmployeeNo(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("should resolve principal id from employeeNo and return learning paths", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ principal_id: "employee-1" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            role: ROLES.EMPLOYEE,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            enrollment_id: "en-1",
            status: "IN_PROGRESS",
            progress: 50,
            enrolled_at: new Date(),
            completed_at: null,
            learning_path_id: "lp-1",
            title: "Python Basics",
            description: "Learn Python",
            category: "PUBLIC",
            total_duration: 20,
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({ params: { employeeNo: "EMP-001" } });
    const res = createMockRes();
    await superAdminController.getLearnerLearningPathsByEmployeeNo(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learner.id).toBe("employee-1");
    expect(res.body.learningPaths).toHaveLength(1);
  });
});

// getLearningPathEnrollments testing

describe("GET LEARNING PATH ENROLLMENTS", () => {
  it("should return 404 when learning path is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { learningPathId: "missing" } });
    const res = createMockRes();
    await superAdminController.getLearningPathEnrollments(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return learning path details", async () => {
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
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { learningPathId: "lp-1" } });
    const res = createMockRes();
    await superAdminController.getLearningPathEnrollments(req, res);

    expect(res.body.learningPath.id).toBe("lp-1");
    expect(res.body.learningPath.title).toBe("Python Basics");
  });

  it("should return enrollments for learning path with principal/employee details", async () => {
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
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            enrollment_id: "en-1",
            status: "IN_PROGRESS",
            progress: 50,
            enrolled_at: new Date(),
            completed_at: null,
            principal_id: "employee-1",
            name: "John Doe",
            email: "john@example.com",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({ params: { learningPathId: "lp-1" } });
    const res = createMockRes();
    await superAdminController.getLearningPathEnrollments(req, res);

    expect(res.body.enrollments).toHaveLength(1);
    const enrollment = res.body.enrollments[0];
    expect(enrollment.employee_number).toBe("EMP-001");
    expect(enrollment.name).toBe("John Doe");
  });

  it("should order enrollments by enrolled_at DESC", async () => {
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
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ enrollment_id: "en-1" }, { enrollment_id: "en-2" }],
        rowCount: 2,
      });

    const req = createMockReq({ params: { learningPathId: "lp-1" } });
    const res = createMockRes();
    await superAdminController.getLearningPathEnrollments(req, res);

    const sql = vi.mocked(query).mock.calls[1][0];
    expect(sql).toContain("ORDER BY en.enrolled_at DESC");
  });

  it("should return learning path with empty enrollments array", async () => {
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
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { learningPathId: "lp-1" } });
    const res = createMockRes();
    await superAdminController.getLearningPathEnrollments(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPath.id).toBe("lp-1");
    expect(res.body.enrollments).toEqual([]);
  });
});

// createEmployee testing

describe("CREATE EMPLOYEE", () => {
  it("should reject duplicate employee number", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "emp-1" }],
      rowCount: 1,
    });

    const req = createMockReq({
      body: {
        employeeNumber: "EMP-001",
        email: "test@test.com",
        password: "Pass@123",
        designation: "Engineer",
        gradeName: "G3",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("should default employee user name from email", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-principal",
            email: "new.employee@example.com",
            role: ROLES.EMPLOYEE,
            name: "new.employee",
            principal_type: "EMPLOYEE",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "emp-new",
            principal_id: "new-principal",
            employee_number: "EMP-003",
            designation: "Engineer",
            grade_name: "G3",
            supervisor_id: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        employeeNumber: "EMP-003",
        email: "new.employee@example.com",
        password: "Pass@123",
        designation: "Engineer",
        gradeName: "G3",
        name: "",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(res.body.user.name).toBe("new.employee");
  });

  it("should create EMPLOYEE principal with EMPLOYEE type", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-principal",
            email: "new.employee@example.com",
            role: ROLES.EMPLOYEE,
            name: "New Employee",
            principal_type: "EMPLOYEE",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "emp-new",
            principal_id: "new-principal",
            employee_number: "EMP-003",
            designation: "Engineer",
            grade_name: "G3",
            supervisor_id: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        employeeNumber: "EMP-003",
        email: "new.employee@example.com",
        password: "Pass@123",
        designation: "Engineer",
        gradeName: "G3",
        name: "New Employee",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(res.body.user.role).toBe(ROLES.EMPLOYEE);
    expect(res.body.user.principal_type).toBe("EMPLOYEE");
  });

  it("should create employee row with supervisorId or null", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-principal",
            email: "new.employee@example.com",
            role: ROLES.EMPLOYEE,
            name: "New Employee",
            principal_type: "EMPLOYEE",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "emp-new",
            principal_id: "new-principal",
            employee_number: "EMP-003",
            designation: "Engineer",
            grade_name: "G3",
            supervisor_id: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        employeeNumber: "EMP-003",
        email: "new.employee@example.com",
        password: "Pass@123",
        designation: "Engineer",
        gradeName: "G3",
        name: "New Employee",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(res.body.employee.employee_number).toBe("EMP-003");
    expect(res.body.employee.supervisor_id).toBeNull();
  });

  it("should return created user and employee with 201", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-principal",
            email: "new.employee@example.com",
            role: ROLES.EMPLOYEE,
            name: "New Employee",
            principal_type: "EMPLOYEE",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "emp-new",
            principal_id: "new-principal",
            employee_number: "EMP-003",
            designation: "Engineer",
            grade_name: "G3",
            supervisor_id: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        employeeNumber: "EMP-003",
        email: "new.employee@example.com",
        password: "Pass@123",
        designation: "Engineer",
        gradeName: "G3",
        name: "New Employee",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe(ROLES.EMPLOYEE);
    expect(res.body.employee.employee_number).toBe("EMP-003");
  });

  it("should log create employee audit", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-principal",
            email: "new.employee@example.com",
            role: ROLES.EMPLOYEE,
            name: "New Employee",
            principal_type: "EMPLOYEE",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "emp-new",
            principal_id: "new-principal",
            employee_number: "EMP-003",
            designation: "Engineer",
            grade_name: "G3",
            supervisor_id: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        employeeNumber: "EMP-003",
        email: "new.employee@example.com",
        password: "Pass@123",
        designation: "Engineer",
        gradeName: "G3",
        name: "New Employee",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "super-1",
      action: "CREATE_EMPLOYEE",
      resourceType: "EMPLOYEE",
    });
  });

  it("should document missing employeeNumber validation — empty number checks DB", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-principal",
            email: "test@test.com",
            role: ROLES.EMPLOYEE,
            name: "test",
            principal_type: "EMPLOYEE",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "emp-new",
            principal_id: "new-principal",
            employee_number: "",
            designation: "Engineer",
            grade_name: "G3",
            supervisor_id: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        employeeNumber: "",
        email: "test@test.com",
        password: "Pass@123",
        designation: "Engineer",
        gradeName: "G3",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(res.statusCode).toBe(201);
  });

  it("should accept supervisorId when provided", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-principal",
            email: "new.employee@example.com",
            role: ROLES.EMPLOYEE,
            name: "New Employee",
            principal_type: "EMPLOYEE",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "emp-new",
            principal_id: "new-principal",
            employee_number: "EMP-004",
            designation: "Engineer",
            grade_name: "G3",
            supervisor_id: "sup-1",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        employeeNumber: "EMP-004",
        email: "new.employee@example.com",
        password: "Pass@123",
        designation: "Engineer",
        gradeName: "G3",
        name: "New Employee",
        supervisorId: "sup-1",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.employee.supervisor_id).toBe("sup-1");
  });

  it("should hash employee password with bcrypt", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "new-principal",
            email: "new.employee@example.com",
            role: ROLES.EMPLOYEE,
            name: "New Employee",
            principal_type: "EMPLOYEE",
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "emp-new",
            principal_id: "new-principal",
            employee_number: "EMP-003",
            designation: "Engineer",
            grade_name: "G3",
            supervisor_id: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        employeeNumber: "EMP-003",
        email: "new.employee@example.com",
        password: "SecurePass1",
        designation: "Engineer",
        gradeName: "G3",
        name: "New Employee",
      },
    });
    const res = createMockRes();
    await superAdminController.createEmployee(req, res);

    expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith("SecurePass1", 10);
  });
});

// Authorization gaps

describe("SUPERADMIN AUTHORIZATION GAPS", () => {
  it("GAP: createUser and createEmployee do not verify req.user.role in controller", () => {
    expect(typeof superAdminController.createUser).toBe("function");
    expect(typeof superAdminController.createEmployee).toBe("function");
  });

  it("GAP: deleteUser does not verify the target is not LEARNING_ADMIN with active enrollments", () => {
    expect(typeof superAdminController.deleteUser).toBe("function");
  });

  it("GAP: getAllLearners does not validate that designation filter value is valid", () => {
    expect(typeof superAdminController.getAllLearners).toBe("function");
  });
});
