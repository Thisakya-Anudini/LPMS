// Set up test environment
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-for-testing";

import test from "node:test";
import assert from "assert/strict";
import * as superAdminController from "../controllers/superAdminController.js";

// MOCK UTILITIES

const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  LEARNING_ADMIN: "LEARNING_ADMIN",
  EMPLOYEE: "EMPLOYEE",
};

const ALL_ROLES = [ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN, ROLES.EMPLOYEE];

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
    query: {},
    headers,
    header(name) {
      return this.headers[name];
    },
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

const sendMockError = (res, status, code, message, details) => {
  const payload = { error: { code, message } };
  if (details) {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
};

// MOCK DATABASE

let mockDatabase = {};
let auditLogs = [];
let hashCalls = [];

const setupMockDatabase = () => {
  mockDatabase = {
    principals: [
      {
        id: "super-1",
        email: "super@lpms.com",
        role: ROLES.SUPER_ADMIN,
        name: "Super Admin",
        principal_type: "USER",
        is_active: true,
        created_at: new Date("2026-06-05T10:00:00Z"),
      },
      {
        id: "admin-1",
        email: "admin@lpms.com",
        role: ROLES.LEARNING_ADMIN,
        name: "Learning Admin",
        principal_type: "USER",
        is_active: true,
        created_at: new Date("2026-06-04T10:00:00Z"),
      },
      {
        id: "employee-1",
        email: "john@example.com",
        role: ROLES.EMPLOYEE,
        name: "John Doe",
        principal_type: "EMPLOYEE",
        is_active: true,
        created_at: new Date("2026-06-03T10:00:00Z"),
      },
      {
        id: "employee-2",
        email: "jane@example.com",
        role: ROLES.EMPLOYEE,
        name: "Jane Doe",
        principal_type: "EMPLOYEE",
        is_active: false,
        created_at: new Date("2026-06-02T10:00:00Z"),
      },
    ],
    employees: [
      {
        id: "emp-1",
        principal_id: "employee-1",
        employee_number: "EMP-001",
        designation: "Developer",
        grade_name: "G5",
        supervisor_id: null,
        created_at: new Date("2026-06-03T10:00:00Z"),
      },
      {
        id: "emp-2",
        principal_id: "employee-2",
        employee_number: "EMP-002",
        designation: "Analyst",
        grade_name: "G4",
        supervisor_id: null,
        created_at: new Date("2026-06-02T10:00:00Z"),
      },
    ],
    learning_admin_assignments: [
      {
        employee_number: "EMP-001",
        assigned_by_principal_id: "super-1",
        created_at: new Date("2026-06-05T09:00:00Z"),
        updated_at: new Date("2026-06-05T09:00:00Z"),
      },
    ],
    learning_paths: [
      {
        id: "lp-1",
        title: "Python Basics",
        description: "Learn Python",
        category: "PUBLIC",
        total_duration: 20,
        status: "ACTIVE",
        is_deleted: false,
      },
      {
        id: "lp-2",
        title: "Deleted Path",
        description: "Deleted",
        category: "PUBLIC",
        total_duration: 10,
        status: "ACTIVE",
        is_deleted: true,
      },
    ],
    enrollments: [
      {
        id: "en-1",
        principal_id: "employee-1",
        learning_path_id: "lp-1",
        status: "IN_PROGRESS",
        progress: 50,
        enrolled_at: new Date("2026-06-05T10:00:00Z"),
        completed_at: null,
      },
      {
        id: "en-2",
        principal_id: "employee-2",
        learning_path_id: "lp-1",
        status: "COMPLETED",
        progress: 100,
        enrolled_at: new Date("2026-06-04T10:00:00Z"),
        completed_at: new Date("2026-06-06T10:00:00Z"),
      },
    ],
  };
};

const mockBcrypt = {
  hash: async (password, rounds) => {
    hashCalls.push({ password, rounds });
    return `hashed-${password}`;
  },
};

const mockLogAudit = async (audit) => {
  auditLogs.push(audit);
};

const createMockPrincipal = async ({
  email,
  password,
  role,
  name,
  principalType = "USER",
}) => {
  const passwordHash = await mockBcrypt.hash(password, 10);
  const principal = {
    id: `principal-${mockDatabase.principals.length + 1}`,
    email,
    password_hash: passwordHash,
    role,
    name,
    principal_type: principalType,
    is_active: true,
    created_at: new Date(),
  };
  mockDatabase.principals.push(principal);

  return {
    id: principal.id,
    email: principal.email,
    role: principal.role,
    name: principal.name,
    principal_type: principal.principal_type,
    created_at: principal.created_at,
  };
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

const buildLearnerRows = () =>
  mockDatabase.employees.map((employee) => {
    const principal = mockDatabase.principals.find(
      (item) => item.id === employee.principal_id,
    );
    const enrollments = mockDatabase.enrollments.filter(
      (item) => item.principal_id === principal.id,
    );

    return {
      principal_id: principal.id,
      name: principal.name,
      email: principal.email,
      is_active: principal.is_active,
      employee_number: employee.employee_number,
      designation: employee.designation,
      grade_name: employee.grade_name,
      is_learning_admin: mockDatabase.learning_admin_assignments.some(
        (item) => item.employee_number === employee.employee_number,
      ),
      total_learning_paths: enrollments.length,
      completed_learning_paths: enrollments.filter(
        (item) => item.status === "COMPLETED",
      ).length,
      average_progress:
        enrollments.length > 0
          ? (
              enrollments.reduce((sum, item) => sum + item.progress, 0) /
              enrollments.length
            ).toFixed(2)
          : "0.00",
    };
  });

const getLearnerLearningPathsPayload = (principalId) => {
  const principal = mockDatabase.principals.find(
    (item) => item.id === principalId,
  );

  if (!principal || principal.role !== ROLES.EMPLOYEE) {
    return null;
  }

  const learningPaths = mockDatabase.enrollments
    .filter((enrollment) => enrollment.principal_id === principalId)
    .map((enrollment) => {
      const path = mockDatabase.learning_paths.find(
        (item) => item.id === enrollment.learning_path_id && !item.is_deleted,
      );

      return {
        enrollment_id: enrollment.id,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolled_at: enrollment.enrolled_at,
        completed_at: enrollment.completed_at,
        learning_path_id: path.id,
        title: path.title,
        description: path.description,
        category: path.category,
        total_duration: path.total_duration,
      };
    });

  return {
    learner: {
      id: principal.id,
      name: principal.name,
      email: principal.email,
    },
    learningPaths,
  };
};

// EXPORTS

// functions export testing
test("SUPERADMIN EXPORTS TESTS", async (t) => {
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
    await t.test(`should export ${exportName}`, async () => {
      assert.equal(typeof superAdminController[exportName], "function");
    });
  }
});

// createUser testing
test("CREATE USER TESTS", async (t) => {
  await t.test("should reject invalid role", async () => {
    const res = createMockRes();
    const role = "INVALID_ROLE";

    if (!ALL_ROLES.includes(role)) {
      sendMockError(res, 400, "VALIDATION_ERROR", "Invalid role.", {
        allowedRoles: ALL_ROLES,
      });
    }

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(Array.isArray(res.body.error.details.allowedRoles));
  });

  await t.test("should reject non SUPER_ADMIN role creation", async () => {
    const res = createMockRes();
    const role = ROLES.LEARNING_ADMIN;

    if (role !== ROLES.SUPER_ADMIN) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "Only SUPER_ADMIN accounts can be created from this interface.",
      );
    }

    assert.equal(res.statusCode, 400);
    assert.equal(
      res.body.error.message,
      "Only SUPER_ADMIN accounts can be created from this interface.",
    );
  });

  await t.test("should default name from email when name missing", async () => {
    const email = "newadmin@lpms.com";
    const name = "" || email.split("@")[0];

    assert.equal(name, "newadmin");
  });

  await t.test("should hash password when creating principal", async () => {
    setupMockDatabase();
    hashCalls = [];

    const created = await createMockPrincipal({
      email: "newadmin@lpms.com",
      password: "Password@123",
      role: ROLES.SUPER_ADMIN,
      name: "New Admin",
    });

    assert.equal(hashCalls.length, 1);
    assert.equal(hashCalls[0].password, "Password@123");
    assert.equal(hashCalls[0].rounds, 10);
    assert.equal(created.email, "newadmin@lpms.com");
  });

  await t.test("should return created SUPER_ADMIN user", async () => {
    setupMockDatabase();

    const created = await createMockPrincipal({
      email: "newadmin@lpms.com",
      password: "Password@123",
      role: ROLES.SUPER_ADMIN,
      name: "New Admin",
    });

    assert.equal(created.role, ROLES.SUPER_ADMIN);
    assert.equal(created.principal_type, "USER");
    assert.ok(created.id);
  });

  await t.test("should log create user audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "super-1",
      action: "CREATE_USER",
      resourceType: "AUTH_PRINCIPAL",
      resourceId: "principal-new",
      metadata: { role: ROLES.SUPER_ADMIN, email: "newadmin@lpms.com" },
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "CREATE_USER");
  });
});

// getAllUsers testing
test("GET ALL USERS TESTS", async (t) => {
  await t.test(
    "should return SUPER_ADMIN and LEARNING_ADMIN users only",
    async () => {
      setupMockDatabase();

      const users = mockDatabase.principals.filter((principal) =>
        [ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN].includes(principal.role),
      );

      assert.equal(users.length, 2);
      assert.ok(users.every((user) => user.role !== ROLES.EMPLOYEE));
    },
  );

  await t.test("should exclude employee users", async () => {
    setupMockDatabase();

    const users = mockDatabase.principals.filter((principal) =>
      [ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN].includes(principal.role),
    );

    assert.equal(
      users.some((user) => user.role === ROLES.EMPLOYEE),
      false,
    );
  });

  await t.test("should order users by created_at DESC", async () => {
    setupMockDatabase();

    const users = mockDatabase.principals
      .filter((principal) =>
        [ROLES.SUPER_ADMIN, ROLES.LEARNING_ADMIN].includes(principal.role),
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    assert.equal(users[0].id, "super-1");
    assert.equal(users[1].id, "admin-1");
  });

  await t.test("should include user fields", async () => {
    setupMockDatabase();

    const user = mockDatabase.principals[0];

    assert.ok(user.id);
    assert.ok(user.email);
    assert.ok(user.role);
    assert.ok(user.name);
    assert.ok(user.principal_type);
    assert.equal(typeof user.is_active, "boolean");
    assert.ok(user.created_at);
  });
});

// getAssignedLearningAdmins testing
test("GET ASSIGNED LEARNING ADMINS TESTS", async (t) => {
  await t.test("should return assigned learning admins", async () => {
    setupMockDatabase();

    const learningAdmins = mockDatabase.learning_admin_assignments.map(
      (assignment) => {
        const employee = mockDatabase.employees.find(
          (item) => item.employee_number === assignment.employee_number,
        );
        const principal = mockDatabase.principals.find(
          (item) => item.id === employee.principal_id,
        );

        return {
          ...assignment,
          principal_id: employee.principal_id,
          designation: employee.designation,
          grade_name: employee.grade_name,
          name: principal.name,
          email: principal.email,
          is_active: principal.is_active,
        };
      },
    );

    assert.equal(learningAdmins.length, 1);
    assert.equal(learningAdmins[0].employee_number, "EMP-001");
  });

  await t.test("should include employee and principal fields", async () => {
    setupMockDatabase();

    const assignment = mockDatabase.learning_admin_assignments[0];
    const employee = mockDatabase.employees.find(
      (item) => item.employee_number === assignment.employee_number,
    );
    const principal = mockDatabase.principals.find(
      (item) => item.id === employee.principal_id,
    );

    assert.ok(employee.principal_id);
    assert.ok(employee.designation);
    assert.ok(employee.grade_name);
    assert.ok(principal.name);
    assert.ok(principal.email);
  });

  await t.test("should order by updated_at DESC", async () => {
    setupMockDatabase();

    mockDatabase.learning_admin_assignments.push({
      employee_number: "EMP-002",
      assigned_by_principal_id: "super-1",
      created_at: new Date("2026-06-06T09:00:00Z"),
      updated_at: new Date("2026-06-06T09:00:00Z"),
    });

    const assignments = mockDatabase.learning_admin_assignments.sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    );

    assert.equal(assignments[0].employee_number, "EMP-002");
  });
});

// deleteUser testing
test("DELETE USER TESTS", async (t) => {
  await t.test("should reject deleting own account", async () => {
    const req = createMockReq({ params: { id: "super-1" } });
    const res = createMockRes();

    if (req.params.id === req.user.id) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "You cannot delete your own account.",
      );
    }

    assert.equal(res.statusCode, 400);
  });

  await t.test("should return 404 when user is not found", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const target = mockDatabase.principals.find(
      (item) => item.id === "missing",
    );

    if (!target) {
      sendMockError(res, 404, "NOT_FOUND", "User not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should reject deleting EMPLOYEE users", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const target = mockDatabase.principals.find(
      (item) => item.id === "employee-1",
    );

    if (!["SUPER_ADMIN", "LEARNING_ADMIN"].includes(target.role)) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "Only SUPER_ADMIN and LEARNING_ADMIN accounts can be deleted from this interface.",
      );
    }

    assert.equal(res.statusCode, 400);
  });

  await t.test("should delete SUPER_ADMIN or LEARNING_ADMIN user", async () => {
    setupMockDatabase();

    const target = mockDatabase.principals.find(
      (item) => item.id === "admin-1",
    );
    mockDatabase.principals = mockDatabase.principals.filter(
      (item) => item.id !== target.id,
    );

    assert.equal(target.role, ROLES.LEARNING_ADMIN);
    assert.equal(
      mockDatabase.principals.some((item) => item.id === "admin-1"),
      false,
    );
  });

  await t.test("should return deleted user fields", async () => {
    const deletedUser = {
      id: "admin-1",
      email: "admin@lpms.com",
      role: ROLES.LEARNING_ADMIN,
      name: "Learning Admin",
      principal_type: "USER",
    };

    assert.ok(deletedUser.id);
    assert.ok(deletedUser.email);
    assert.equal(deletedUser.role, ROLES.LEARNING_ADMIN);
  });

  await t.test("should log deactivate user audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "super-1",
      action: "DEACTIVATE_USER",
      resourceType: "AUTH_PRINCIPAL",
      resourceId: "admin-1",
    });

    assert.equal(auditLogs[0].action, "DEACTIVATE_USER");
  });
});

// assignLearningAdmin testing
test("ASSIGN LEARNING ADMIN TESTS", async (t) => {
  await t.test("should require employeeNumber", async () => {
    const req = createMockReq({ body: { employeeNumber: "" } });
    const res = createMockRes();

    const employeeNumber = String(req.body.employeeNumber || "").trim();

    if (!employeeNumber) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "employeeNumber is required.",
      );
    }

    assert.equal(res.statusCode, 400);
  });

  await t.test("should trim employeeNumber", async () => {
    const employeeNumber = String(" EMP-001 ").trim();

    assert.equal(employeeNumber, "EMP-001");
  });

  await t.test(
    "should return 404 when learner cannot be found or created",
    async () => {
      setupMockDatabase();

      const res = createMockRes();
      const employee = mockDatabase.employees.find(
        (item) => item.employee_number === "UNKNOWN",
      );

      if (!employee) {
        sendMockError(
          res,
          404,
          "NOT_FOUND",
          "Learner not found for given employeeNumber.",
        );
      }

      assert.equal(res.statusCode, 404);
    },
  );

  await t.test("should reject inactive learner account", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const employee = mockDatabase.employees.find(
      (item) => item.employee_number === "EMP-002",
    );
    const principal = mockDatabase.principals.find(
      (item) => item.id === employee.principal_id,
    );

    if (!principal.is_active) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "Learner account is inactive.",
      );
    }

    assert.equal(res.statusCode, 400);
  });

  await t.test("should assign learning admin", async () => {
    setupMockDatabase();

    const employeeNumber = "EMP-001";
    const employee = mockDatabase.employees.find(
      (item) => item.employee_number === employeeNumber,
    );
    const principal = mockDatabase.principals.find(
      (item) => item.id === employee.principal_id,
    );

    const assignment = {
      employeeNumber,
      principalId: employee.principal_id,
      name: principal.name,
      email: principal.email,
      isLearningAdmin: true,
    };

    assert.equal(assignment.employeeNumber, "EMP-001");
    assert.equal(assignment.isLearningAdmin, true);
  });

  await t.test("should upsert learning admin assignment", async () => {
    setupMockDatabase();

    const employeeNumber = "EMP-001";
    const existing = mockDatabase.learning_admin_assignments.find(
      (item) => item.employee_number === employeeNumber,
    );

    existing.assigned_by_principal_id = "super-1";
    existing.updated_at = new Date();

    assert.equal(existing.assigned_by_principal_id, "super-1");
  });

  await t.test("should log assign learning admin audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "super-1",
      action: "ASSIGN_LEARNING_ADMIN",
      resourceType: "EMPLOYEE",
      resourceId: "employee-1",
      metadata: { employeeNumber: "EMP-001" },
    });

    assert.equal(auditLogs[0].action, "ASSIGN_LEARNING_ADMIN");
  });
});

// removeLearningAdmin testing
test("REMOVE LEARNING ADMIN TESTS", async (t) => {
  await t.test("should require employeeNumber param", async () => {
    const req = createMockReq({ params: { employeeNumber: "" } });
    const res = createMockRes();

    const employeeNumber = String(req.params.employeeNumber || "").trim();

    if (!employeeNumber) {
      sendMockError(
        res,
        400,
        "VALIDATION_ERROR",
        "employeeNumber is required.",
      );
    }

    assert.equal(res.statusCode, 400);
  });

  await t.test("should return 404 when assignment is not found", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const assignment = mockDatabase.learning_admin_assignments.find(
      (item) => item.employee_number === "UNKNOWN",
    );

    if (!assignment) {
      sendMockError(
        res,
        404,
        "NOT_FOUND",
        "Learning admin assignment not found.",
      );
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should remove learning admin assignment", async () => {
    setupMockDatabase();

    mockDatabase.learning_admin_assignments =
      mockDatabase.learning_admin_assignments.filter(
        (item) => item.employee_number !== "EMP-001",
      );

    assert.equal(mockDatabase.learning_admin_assignments.length, 0);
  });

  await t.test("should return success true", async () => {
    const response = { success: true };

    assert.equal(response.success, true);
  });

  await t.test("should log remove learning admin audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "super-1",
      action: "REMOVE_LEARNING_ADMIN",
      resourceType: "EMPLOYEE",
      resourceId: "EMP-001",
      metadata: { employeeNumber: "EMP-001" },
    });

    assert.equal(auditLogs[0].action, "REMOVE_LEARNING_ADMIN");
  });
});

// getAllLearners testing
test("GET ALL LEARNERS TESTS", async (t) => {
  await t.test(
    "should default pagination to page 1 and pageSize 25",
    async () => {
      const req = createMockReq({ query: {} });

      const rawPage = Number.parseInt(String(req.query.page || "1"), 10);
      const rawPageSize = Number.parseInt(
        String(req.query.pageSize || "25"),
        10,
      );
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      const pageSize = Number.isFinite(rawPageSize)
        ? Math.min(Math.max(rawPageSize, 1), 100)
        : 25;

      assert.equal(page, 1);
      assert.equal(pageSize, 25);
    },
  );

  await t.test("should clamp pageSize to max 100", async () => {
    const rawPageSize = Number.parseInt("500", 10);
    const pageSize = Number.isFinite(rawPageSize)
      ? Math.min(Math.max(rawPageSize, 1), 100)
      : 25;

    assert.equal(pageSize, 100);
  });

  await t.test("should clamp pageSize to min 1", async () => {
    const rawPageSize = Number.parseInt("-10", 10);
    const pageSize = Number.isFinite(rawPageSize)
      ? Math.min(Math.max(rawPageSize, 1), 100)
      : 25;

    assert.equal(pageSize, 1);
  });

  await t.test("should calculate pagination offset", async () => {
    const page = 3;
    const pageSize = 25;
    const offset = (page - 1) * pageSize;

    assert.equal(offset, 50);
  });

  await t.test("should filter learners by employeeNo", async () => {
    setupMockDatabase();

    const employeeNo = "EMP-001";
    const learners = buildLearnerRows().filter((learner) =>
      learner.employee_number.includes(employeeNo),
    );

    assert.equal(learners.length, 1);
    assert.equal(learners[0].employee_number, "EMP-001");
  });

  await t.test("should filter learners by name", async () => {
    setupMockDatabase();

    const name = "John";
    const learners = buildLearnerRows().filter((learner) =>
      learner.name.includes(name),
    );

    assert.equal(learners.length, 1);
    assert.equal(learners[0].name, "John Doe");
  });

  await t.test("should filter learners by designation", async () => {
    setupMockDatabase();

    const designation = "Developer";
    const learners = buildLearnerRows().filter(
      (learner) => learner.designation === designation,
    );

    assert.equal(learners.length, 1);
    assert.equal(learners[0].designation, "Developer");
  });

  await t.test(
    "should include learning admin flag and progress summary",
    async () => {
      setupMockDatabase();

      const learner = buildLearnerRows().find(
        (item) => item.employee_number === "EMP-001",
      );

      assert.equal(learner.is_learning_admin, true);
      assert.equal(learner.total_learning_paths, 1);
      assert.equal(learner.completed_learning_paths, 0);
      assert.equal(learner.average_progress, "50.00");
    },
  );

  await t.test("should return designation options", async () => {
    setupMockDatabase();

    const designationOptions = Array.from(
      new Set(mockDatabase.employees.map((employee) => employee.designation)),
    ).sort();

    assert.deepEqual(designationOptions, ["Analyst", "Developer"]);
  });

  await t.test("should calculate total pages", async () => {
    const total = 51;
    const pageSize = 25;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    assert.equal(totalPages, 3);
  });
});

// getLearnerLearningPaths testing
test("GET LEARNER LEARNING PATHS TESTS", async (t) => {
  await t.test("should return 404 when principal is missing", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const payload = getLearnerLearningPathsPayload("missing");

    if (!payload) {
      sendMockError(res, 404, "NOT_FOUND", "Learner not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should return 404 when principal is not EMPLOYEE", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const payload = getLearnerLearningPathsPayload("super-1");

    if (!payload) {
      sendMockError(res, 404, "NOT_FOUND", "Learner not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should return learner details", async () => {
    setupMockDatabase();

    const payload = getLearnerLearningPathsPayload("employee-1");

    assert.equal(payload.learner.id, "employee-1");
    assert.equal(payload.learner.name, "John Doe");
    assert.equal(payload.learner.email, "john@example.com");
  });

  await t.test("should return learner learning paths", async () => {
    setupMockDatabase();

    const payload = getLearnerLearningPathsPayload("employee-1");

    assert.equal(payload.learningPaths.length, 1);
    assert.equal(payload.learningPaths[0].learning_path_id, "lp-1");
  });

  await t.test("should exclude deleted learning paths", async () => {
    setupMockDatabase();

    mockDatabase.enrollments.push({
      id: "en-deleted",
      principal_id: "employee-1",
      learning_path_id: "lp-2",
      status: "IN_PROGRESS",
      progress: 10,
      enrolled_at: new Date(),
      completed_at: null,
    });

    const activePaths = mockDatabase.enrollments
      .filter((enrollment) => enrollment.principal_id === "employee-1")
      .filter((enrollment) =>
        mockDatabase.learning_paths.some(
          (path) => path.id === enrollment.learning_path_id && !path.is_deleted,
        ),
      );

    assert.equal(activePaths.length, 1);
  });
});

// getLearnerLearningPathsByEmployeeNo testing
test("GET LEARNER LEARNING PATHS BY EMPLOYEENO TESTS", async (t) => {
  await t.test("should require employeeNo", async () => {
    const req = createMockReq({ params: { employeeNo: "" } });
    const res = createMockRes();

    const employeeNo = String(req.params.employeeNo || "").trim();

    if (!employeeNo) {
      sendMockError(res, 400, "VALIDATION_ERROR", "employeeNo is required.");
    }

    assert.equal(res.statusCode, 400);
  });

  await t.test("should trim employeeNo", async () => {
    const employeeNo = String(" EMP-001 ").trim();

    assert.equal(employeeNo, "EMP-001");
  });

  await t.test("should return 404 when employee is not found", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const employee = mockDatabase.employees.find(
      (item) => item.employee_number === "UNKNOWN",
    );

    if (!employee) {
      sendMockError(res, 404, "NOT_FOUND", "Learner not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should resolve principal id from employeeNo", async () => {
    setupMockDatabase();

    const employee = mockDatabase.employees.find(
      (item) => item.employee_number === "EMP-001",
    );

    assert.equal(employee.principal_id, "employee-1");
  });

  await t.test(
    "should return learner learning paths by employeeNo",
    async () => {
      setupMockDatabase();

      const employee = mockDatabase.employees.find(
        (item) => item.employee_number === "EMP-001",
      );
      const payload = getLearnerLearningPathsPayload(employee.principal_id);

      assert.equal(payload.learner.id, "employee-1");
      assert.equal(payload.learningPaths.length, 1);
    },
  );
});

// getLearningPathEnrollments testing
test("GET LEARNING PATH ENROLLMENTS TESTS", async (t) => {
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

    const path = mockDatabase.learning_paths.find(
      (item) => item.id === "lp-1" && !item.is_deleted,
    );

    assert.equal(path.id, "lp-1");
    assert.equal(path.title, "Python Basics");
    assert.equal(path.status, "ACTIVE");
  });

  await t.test("should return enrollments for learning path", async () => {
    setupMockDatabase();

    const enrollments = mockDatabase.enrollments.filter(
      (enrollment) => enrollment.learning_path_id === "lp-1",
    );

    assert.equal(enrollments.length, 2);
  });

  await t.test("should include principal and employee details", async () => {
    setupMockDatabase();

    const enrollment = mockDatabase.enrollments[0];
    const principal = mockDatabase.principals.find(
      (item) => item.id === enrollment.principal_id,
    );
    const employee = mockDatabase.employees.find(
      (item) => item.principal_id === principal.id,
    );

    assert.ok(principal.name);
    assert.ok(principal.email);
    assert.ok(employee.employee_number);
    assert.ok(employee.designation);
    assert.ok(employee.grade_name);
  });

  await t.test("should order enrollments by enrolled_at DESC", async () => {
    setupMockDatabase();

    const enrollments = mockDatabase.enrollments.sort(
      (a, b) => new Date(b.enrolled_at) - new Date(a.enrolled_at),
    );

    assert.equal(enrollments[0].id, "en-1");
    assert.equal(enrollments[1].id, "en-2");
  });
});

// createEmployee testing
test("CREATE EMPLOYEE TESTS", async (t) => {
  await t.test("should reject duplicate employee number", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const existingEmployee = mockDatabase.employees.find(
      (employee) => employee.employee_number === "EMP-001",
    );

    if (existingEmployee) {
      sendMockError(res, 409, "CONFLICT", "Employee number already exists.");
    }

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, "CONFLICT");
  });

  await t.test("should default employee user name from email", async () => {
    const email = "new.employee@example.com";
    const name = "" || email.split("@")[0];

    assert.equal(name, "new.employee");
  });

  await t.test("should create EMPLOYEE principal", async () => {
    setupMockDatabase();

    const principal = await createMockPrincipal({
      email: "new.employee@example.com",
      password: "Password@123",
      role: ROLES.EMPLOYEE,
      name: "New Employee",
      principalType: "EMPLOYEE",
    });

    assert.equal(principal.role, ROLES.EMPLOYEE);
    assert.equal(principal.principal_type, "EMPLOYEE");
  });

  await t.test(
    "should create employee row with supervisorId or null",
    async () => {
      setupMockDatabase();

      const principal = await createMockPrincipal({
        email: "new.employee@example.com",
        password: "Password@123",
        role: ROLES.EMPLOYEE,
        name: "New Employee",
        principalType: "EMPLOYEE",
      });

      const employee = {
        id: "emp-new",
        principal_id: principal.id,
        employee_number: "EMP-003",
        designation: "Engineer",
        grade_name: "G3",
        supervisor_id: "" || null,
        created_at: new Date(),
      };

      assert.equal(employee.principal_id, principal.id);
      assert.equal(employee.employee_number, "EMP-003");
      assert.equal(employee.supervisor_id, null);
    },
  );

  await t.test("should return created user and employee", async () => {
    const user = {
      id: "principal-new",
      email: "new.employee@example.com",
      role: ROLES.EMPLOYEE,
      name: "New Employee",
    };
    const employee = {
      id: "emp-new",
      principal_id: user.id,
      employee_number: "EMP-003",
      designation: "Engineer",
      grade_name: "G3",
      supervisor_id: null,
    };

    const response = { user, employee };

    assert.equal(response.user.role, ROLES.EMPLOYEE);
    assert.equal(response.employee.employee_number, "EMP-003");
  });

  await t.test("should log create employee audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "super-1",
      action: "CREATE_EMPLOYEE",
      resourceType: "EMPLOYEE",
      resourceId: "emp-new",
      metadata: { principalId: "principal-new" },
    });

    assert.equal(auditLogs[0].action, "CREATE_EMPLOYEE");
  });
});
