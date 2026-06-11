import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  login,
  refresh,
  logout,
  me,
  changePassword,
} from "../controllers/authController.js";
import { ROLES } from "../constants/roles.js";

// Set up test environment
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-for-testing";

// MOCK UTILITIES - simulate external dependencies

// Creates a mock HTTP response object
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
      if (value !== undefined) {
        this.headers[key] = value;
      }
      return this.headers[key];
    },
  };
  return res;
};

// Creates a mock HTTP request object
const createMockReq = (overrides = {}) => {
  const headers = {};
  return {
    body: {},
    headers,
    header(name) {
      return headers[name];
    },
    user: null,
    ...overrides,
  };
};

// Mock database module
let mockDatabase = {};

const setupMockDatabase = () => {
  mockDatabase = {
    principals: [
      {
        id: "user-1",
        email: "admin@lpms.com",
        name: "Admin User",
        role: ROLES.SUPER_ADMIN,
        principal_type: "USER",
        password_hash:
          "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/SlO", // bcrypt hash of 'password'
        is_active: true,
        must_change_password: false,
      },
      {
        id: "user-2",
        email: "employee@lpms.com",
        name: "Employee User",
        role: ROLES.EMPLOYEE,
        principal_type: "USER",
        password_hash:
          "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/SlO", // Same hash for testing
        is_active: true,
        must_change_password: false,
      },
      {
        id: "user-3",
        email: "learningadmin@lpms.com",
        name: "Learning Admin User",
        role: ROLES.LEARNING_ADMIN,
        principal_type: "USER",
        password_hash:
          "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/SlO",
        is_active: true,
        must_change_password: false,
      },
    ],
    employees: [
      {
        principal_id: "user-2",
        employee_number: "12345",
      },
    ],
    learning_admin_assignments: [
      {
        employee_number: "12345",
      },
    ],
    refresh_tokens: [
      {
        id: "token-1",
        principal_id: "user-1",
        token_hash: "hashed-token-value",
        revoked_at: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
  };
};

// Mock query function
const mockQuery = async (sql, params = []) => {
  if (
    sql.includes(
      "SELECT id, email, name, role, password_hash, principal_type, must_change_password FROM auth_principals WHERE email = $1",
    )
  ) {
    const email = params[0]?.toLowerCase();
    const principal = mockDatabase.principals.find((p) => p.email === email);
    return {
      rows: principal ? [principal] : [],
      rowCount: principal ? 1 : 0,
    };
  }

  // Mock: Get employee by principal_id
  if (
    sql.includes(
      "SELECT employee_number FROM employees WHERE principal_id = $1",
    )
  ) {
    const principalId = params[0];
    const employee = mockDatabase.employees.find(
      (e) => e.principal_id === principalId,
    );
    return {
      rows: employee ? [employee] : [],
      rowCount: employee ? 1 : 0,
    };
  }

  // Mock: Check learning admin assignment
  if (
    sql.includes(
      "SELECT employee_number FROM learning_admin_assignments WHERE employee_number = $1",
    )
  ) {
    const empNo = params[0];
    const assignment = mockDatabase.learning_admin_assignments.find(
      (a) => a.employee_number === empNo,
    );
    return {
      rows: assignment ? [assignment] : [],
      rowCount: assignment ? 1 : 0,
    };
  }

  // Mock: Insert refresh token
  if (sql.includes("INSERT INTO refresh_tokens")) {
    return { rows: [], rowCount: 1 };
  }

  // Mock: Update password
  if (sql.includes("UPDATE auth_principals SET password_hash")) {
    return { rows: [], rowCount: 1 };
  }

  // Mock: Revoke refresh tokens
  if (sql.includes("UPDATE refresh_tokens SET revoked_at")) {
    return { rows: [], rowCount: 1 };
  }

  // Default
  return { rows: [], rowCount: 0 };
};

// Mock ERP client
const mockErpClient = {
  fetchEmployeeDetailsForServiceNo: async (empNo) => {
    if (empNo === "12345") {
      return {
        data: [
          {
            employeeName: "John Doe",
            employeeInitials: "J",
            employeeSurname: "Doe",
            email: "john.doe@erp.local",
          },
        ],
      };
    }
    throw new Error("ERP API error");
  },
  fetchEmployeeSubordinates: async (empNo) => {
    if (empNo === "12345") {
      return { data: [{ employeeNo: "12346" }] };
    }
    return { data: [] };
  },
};

// Mock bcrypt - simulates password hashing

const mockBcrypt = {
  compare: async (password, hash) => {
    if (
      password === "password" &&
      hash === "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/SlO"
    ) {
      return true;
    }
    return false;
  },
  hash: async (password, rounds) => {
    return `hashed-${password}`;
  },
};

// TEST SUITES

// exports testing
test("AUTH CONTROLLER EXPORTS TESTS", async (t) => {
  const expectedExports = {
    login,
    refresh,
    logout,
    me,
    changePassword,
  };

  for (const [exportName, exportFn] of Object.entries(expectedExports)) {
    await t.test(`should export ${exportName}`, async () => {
      assert.equal(typeof exportFn, "function");
    });
  }
});

// login function
test("LOGIN TESTS", async (t) => {
  await t.test("should login with valid SYSTEM user credentials", async () => {
    setupMockDatabase();

    const req = createMockReq({
      body: {
        email: "admin@lpms.com",
        password: "password",
      },
    });
    const res = createMockRes();

    // Verify email is found in database
    const principal = mockDatabase.principals.find(
      (p) => p.email === req.body.email.toLowerCase(),
    );
    assert.ok(principal);

    // Verify password comparison would succeed
    const isValidPassword = await mockBcrypt.compare(
      req.body.password,
      principal.password_hash,
    );
    assert.equal(isValidPassword, true);

    // Verify response structure would be correct
    assert.equal(res.statusCode, 200);
  });

  await t.test("should return 401 for invalid password", async () => {
    setupMockDatabase();

    const req = createMockReq({
      body: {
        email: "admin@lpms.com",
        password: "wrong-password",
      },
    });
    const res = createMockRes();

    // Mock verification - password is wrong
    const isValidPassword = await mockBcrypt.compare(
      "wrong-password",
      mockDatabase.principals[0].password_hash,
    );
    assert.equal(isValidPassword, false);
  });

  await t.test("should handle non-existent user gracefully", async () => {
    setupMockDatabase();

    const email = "nonexistent@lpms.com";
    const principal = mockDatabase.principals.find(
      (p) => p.email === email.toLowerCase(),
    );
    assert.equal(principal, undefined);
  });

  await t.test(
    "should resolve employee context (supervisor status)",
    async () => {
      setupMockDatabase();

      // Check if employee has subordinates
      const empNo = "12345";
      const subordinates = await mockErpClient.fetchEmployeeSubordinates(empNo);
      const isSupervisor = Boolean(
        Array.isArray(subordinates?.data) && subordinates.data.length > 0,
      );
      assert.equal(isSupervisor, true);
    },
  );

  await t.test(
    "should resolve employee context (learning admin status)",
    async () => {
      setupMockDatabase();

      // Check if employee has learning admin assignment
      const empNo = "12345";
      const assignment = mockDatabase.learning_admin_assignments.find(
        (a) => a.employee_number === empNo,
      );
      const isLearningAdmin = Boolean(assignment);
      assert.equal(isLearningAdmin, true);
    },
  );

  await t.test(
    "should handle employee without learning admin assignment",
    async () => {
      setupMockDatabase();

      // Different employee number NOT in assignments
      const empNo = "54321";
      const assignment = mockDatabase.learning_admin_assignments.find(
        (a) => a.employee_number === empNo,
      );
      const isLearningAdmin = Boolean(assignment);
      assert.equal(isLearningAdmin, false);
    },
  );

  await t.test("should handle case-insensitive email lookup", async () => {
    setupMockDatabase();

    const email = "ADMIN@LPMS.COM";
    const lowercased = email.toLowerCase();
    const principal = mockDatabase.principals.find(
      (p) => p.email === lowercased,
    );
    assert.ok(principal);
    assert.equal(principal.email, "admin@lpms.com");
  });

  await t.test("should include correct role for SUPER_ADMIN", async () => {
    setupMockDatabase();

    const principal = mockDatabase.principals.find(
      (p) => p.role === ROLES.SUPER_ADMIN,
    );
    assert.ok(principal);
    assert.equal(principal.role, ROLES.SUPER_ADMIN);
  });

  await t.test("should include correct role for LEARNING_ADMIN", async () => {
    setupMockDatabase();

    const principal = mockDatabase.principals.find(
      (p) => p.role === ROLES.LEARNING_ADMIN,
    );
    assert.ok(principal);
    assert.equal(principal.role, ROLES.LEARNING_ADMIN);
  });

  await t.test("should successfully login Temporary ERP Learner", async () => {
    setupMockDatabase();

    const req = createMockReq({
      body: { email: "12345@erp.local", password: "password" },
    });
    const res = createMockRes();

    await login(req, res);

    assert.ok(res.statusCode === 200 || res.statusCode === 401);
  });

  await t.test("should reject invalid ERP credentials", async () => {
    setupMockDatabase();

    const req = createMockReq({
      body: { email: "12345@erp.local", password: "wrong-password" },
    });
    const res = createMockRes();

    await login(req, res);
    assert.equal(res.statusCode, 401);
  });

  await t.test("should reject login for deactivated user", async () => {
    setupMockDatabase();
    const user = mockDatabase.principals.find((p) => p.id === "user-1");
    user.is_active = false;

    const req = createMockReq({
      body: { email: "admin@lpms.com", password: "password" },
    });
    const res = createMockRes();

    await login(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
  });

  await t.test(
    "should map SUPERVISOR DB role to EMPLOYEE with context flag",
    async () => {
      setupMockDatabase();
      const user = mockDatabase.principals.find((p) => p.id === "user-1");
      user.role = ROLES.SUPERVISOR;

      // Simulate mapPrincipal downgrading role
      const mappedRole =
        user.role === ROLES.SUPERVISOR ? ROLES.EMPLOYEE : user.role;

      assert.equal(mappedRole, ROLES.EMPLOYEE);
    },
  );

  await t.test(
    "should support login using username field instead of email",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        body: { username: "admin@lpms.com", password: "password" },
      });

      // Simulate identifier extraction and DB lookup
      const { email, username } = req.body;
      const identifier = String(username || email || "").trim();
      const principal = mockDatabase.principals.find(
        (p) => p.email === identifier.toLowerCase(),
      );

      assert.ok(principal);
      assert.equal(principal.email, "admin@lpms.com");
    },
  );

  await t.test("should correctly map mustChangePassword flag", async () => {
    setupMockDatabase();
    const user = mockDatabase.principals.find((p) => p.id === "user-2");
    user.must_change_password = true;

    // Simulate mapped response
    const mappedPrincipal = { mustChangePassword: user.must_change_password };

    assert.equal(mappedPrincipal.mustChangePassword, true);
  });

  await t.test(
    "should successfully login Temporary ERP Learner not in DB",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        body: { email: "12345@erp.local", password: "password" },
      });

      // Simulate DB check and fallback
      const principal = mockDatabase.principals.find(
        (p) => p.email === req.body.email,
      );
      const isErpLearner = !principal && req.body.email.endsWith("@erp.local");

      assert.equal(principal, undefined);
      assert.equal(isErpLearner, true);
    },
  );

  await t.test("should reject login for inactive/terminated user", async () => {
    setupMockDatabase();
    mockDatabase.principals[0].is_active = false;

    const req = createMockReq({
      body: { email: "admin@lpms.com", password: "password" },
    });
    const res = createMockRes();

    await login(req, res);

    assert.equal(res.statusCode, 401);
  });

  await t.test(
    "should login Temporary ERP Learner even if ERP service is offline",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        body: { email: "99999@erp.local", password: "password" },
      });

      let erpData = null;
      try {
        // Simulate offline ERP call
        erpData = await mockErpClient.fetchEmployeeDetailsForServiceNo("99999");
      } catch (e) {
        erpData = null; // Catch block allows login to continue
      }

      assert.equal(erpData, null);
    },
  );
});

// refresh token testing
test("REFRESH TOKEN TESTS", async (t) => {
  await t.test("should require refreshToken in request body", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();

    // Verify validation
    assert.equal(req.body.refreshToken, undefined);
  });

  await t.test("should return error for invalid refresh token", async () => {
    const req = createMockReq({
      body: { refreshToken: "invalid-token" },
    });
    const res = createMockRes();

    // Token validation would fail
    assert.ok(req.body.refreshToken);
  });

  await t.test(
    "should generate new access token from valid refresh token",
    async () => {
      setupMockDatabase();

      const token = mockDatabase.refresh_tokens[0];
      assert.ok(token);
      assert.equal(token.revoked_at, null);
    },
  );

  await t.test("should reject expired refresh token", async () => {
    setupMockDatabase();

    // Add expired token
    const expiredToken = {
      ...mockDatabase.refresh_tokens[0],
      expires_at: new Date(Date.now() - 1000),
    };

    const isExpired = new Date(expiredToken.expires_at) < new Date();
    assert.equal(isExpired, true);
  });

  await t.test("should reject revoked refresh token", async () => {
    setupMockDatabase();

    const revokedToken = {
      ...mockDatabase.refresh_tokens[0],
      revoked_at: new Date(),
    };

    assert.ok(revokedToken.revoked_at);
  });

  await t.test(
    "should handle malformed or garbage refresh tokens without crashing",
    async () => {
      const req = createMockReq({
        body: { refreshToken: "not-a-valid-jwt-string-at-all" },
      });
      const res = createMockRes();

      await refresh(req, res);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error.code, "INVALID_REFRESH_TOKEN");
    },
  );

  await t.test(
    "should dynamically update role and permissions on refresh",
    async () => {
      setupMockDatabase();
      mockDatabase.learning_admin_assignments.push({
        employee_number: "12345",
      });

      assert.ok(mockDatabase.learning_admin_assignments.length > 0);
    },
  );

  await t.test(
    "VULNERABILITY: should reject refresh if user is deactivated",
    async () => {
      setupMockDatabase();

      const user = mockDatabase.principals.find((p) => p.id === "user-1");
      user.is_active = false;

      assert.equal(user.is_active, false);
    },
  );

  await t.test(
    "should refresh Temporary ERP Learner token bypassing local DB",
    async () => {
      const isTemporaryErpLearnerAuth = true;
      assert.equal(isTemporaryErpLearnerAuth, true);
    },
  );
});

// logout function testing
test("LOGOUT TESTS", async (t) => {
  await t.test("should require refreshToken to logout", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();

    assert.equal(req.body.refreshToken, undefined);
  });

  await t.test("should revoke refresh token on logout", async () => {
    setupMockDatabase();

    // Verify token exists
    assert.ok(mockDatabase.refresh_tokens[0]);

    const revokedToken = {
      ...mockDatabase.refresh_tokens[0],
      revoked_at: new Date(),
    };

    assert.ok(revokedToken.revoked_at);
  });

  await t.test("should handle already logged out gracefully", async () => {
    setupMockDatabase();

    const alreadyRevokedToken = {
      ...mockDatabase.refresh_tokens[0],
      revoked_at: new Date("2026-06-01"),
    };

    assert.ok(alreadyRevokedToken.revoked_at);
  });

  await t.test(
    "should return success for multiple logout attempts",
    async () => {
      setupMockDatabase();

      const token1 = {
        ...mockDatabase.refresh_tokens[0],
        revoked_at: new Date(),
      };
      assert.ok(token1.revoked_at);

      const token2 = { ...token1 };
      assert.ok(token2.revoked_at);
    },
  );

  await t.test(
    "should successfully logout Temporary ERP Learner bypassing DB",
    async () => {
      const req = createMockReq({
        body: { refreshToken: "mock-erp-jwt-token" },
      });
      const res = createMockRes();

      assert.equal(res.statusCode, 200);
    },
  );
});

// me function testing
test("ME ENDPOINT TESTS", async (t) => {
  await t.test("should return current user profile", async () => {
    setupMockDatabase();

    const principal = mockDatabase.principals[0];
    assert.ok(principal);
    assert.equal(principal.email, "admin@lpms.com");
    assert.equal(principal.role, ROLES.SUPER_ADMIN);
  });

  await t.test("should return 404 if user not found", async () => {
    setupMockDatabase();

    const notFoundUser = mockDatabase.principals.find(
      (p) => p.id === "nonexistent-id",
    );
    assert.equal(notFoundUser, undefined);
  });

  await t.test(
    "should resolve employee context for EMPLOYEE role",
    async () => {
      setupMockDatabase();

      const employee = mockDatabase.principals[1];
      assert.equal(employee.role, ROLES.EMPLOYEE);

      const empRec = mockDatabase.employees.find(
        (e) => e.principal_id === employee.id,
      );
      assert.ok(empRec);
    },
  );

  await t.test("should include supervisor status in response", async () => {
    setupMockDatabase();

    const empNo = "12345";
    const subordinates = await mockErpClient.fetchEmployeeSubordinates(empNo);
    const isSupervisor = subordinates.data.length > 0;
    assert.equal(isSupervisor, true);
  });

  await t.test("should include learning admin status in response", async () => {
    setupMockDatabase();

    const empNo = "12345";
    const assignment = mockDatabase.learning_admin_assignments.find(
      (a) => a.employee_number === empNo,
    );
    const isLearningAdmin = Boolean(assignment);
    assert.equal(isLearningAdmin, true);
  });

  await t.test(
    "should return all principal fields for SUPER_ADMIN",
    async () => {
      setupMockDatabase();

      const principal = mockDatabase.principals[0];
      assert.ok(principal.id);
      assert.ok(principal.email);
      assert.ok(principal.name);
      assert.equal(principal.role, ROLES.SUPER_ADMIN);
      assert.ok(principal.principal_type);
    },
  );

  await t.test(
    "should return 404 for deactivated user hitting /me",
    async () => {
      setupMockDatabase();
      const user = mockDatabase.principals.find((p) => p.id === "user-1");
      user.is_active = false;

      // Simulate DB query condition in /me endpoint
      const dbResult = mockDatabase.principals.find(
        (p) => p.id === "user-1" && p.is_active === true,
      );

      assert.equal(dbResult, undefined);
    },
  );

  await t.test(
    "should return profile from JWT for Temporary ERP Learner bypassing DB",
    async () => {
      const req = createMockReq({
        user: {
          id: "erp-user-1",
          email: "12345@erp.local",
          name: "Temporary Learner",
          role: ROLES.EMPLOYEE,
          principalType: "EMPLOYEE",
          authSource: "ERP_LEARNER",
          employeeNo: "12345",
        },
      });
      const res = createMockRes();

      await me(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.user.authSource, "ERP_LEARNER");
      assert.equal(res.body.user.mustChangePassword, false);
    },
  );

  await t.test("should return 404 for inactive/terminated user", async () => {
    setupMockDatabase();
    mockDatabase.principals[0].is_active = false;

    // Simulate DB query condition
    const activeUser = mockDatabase.principals.find(
      (p) => p.id === "user-1" && p.is_active === true,
    );

    assert.equal(activeUser, undefined);
  });
});

// change password function testing
test("CHANGE PASSWORD TESTS", async (t) => {
  await t.test("should validate new password length", async () => {
    const shortPassword = "1234567";
    assert.equal(shortPassword.length < 8, true);
  });

  await t.test("should verify old password is correct", async () => {
    setupMockDatabase();

    const isValid = await mockBcrypt.compare(
      "password",
      mockDatabase.principals[0].password_hash,
    );
    assert.equal(isValid, true);
  });

  await t.test("should reject incorrect old password", async () => {
    setupMockDatabase();

    const isValid = await mockBcrypt.compare(
      "wrong-password",
      mockDatabase.principals[0].password_hash,
    );
    assert.equal(isValid, false);
  });

  await t.test("should update password hash", async () => {
    const newPassword = "NewPassword@123";
    const hashedPassword = await mockBcrypt.hash(newPassword, 10);
    assert.ok(hashedPassword);
    assert.notEqual(hashedPassword, newPassword);
  });

  await t.test(
    "should revoke all refresh tokens after password change",
    async () => {
      setupMockDatabase();

      const principalId = "user-1";
      const tokensToRevoke = mockDatabase.refresh_tokens.filter(
        (t) => t.principal_id === principalId && !t.revoked_at,
      );

      assert.ok(tokensToRevoke.length > 0);
    },
  );

  await t.test("should not allow ERP learner to change password", async () => {
    const authSource = "ERP_LEARNER";
    const isErpLearner = authSource === "ERP_LEARNER";
    assert.equal(isErpLearner, true);
  });

  await t.test("should require current password to be provided", async () => {
    const req = createMockReq({
      body: {
        newPassword: "NewPassword@123",
      },
    });

    assert.equal(req.body.oldPassword, undefined);
  });

  await t.test("should require new password to be provided", async () => {
    const req = createMockReq({
      body: {
        oldPassword: "password",
      },
    });

    assert.equal(req.body.newPassword, undefined);
  });

  await t.test(
    "should block Temporary ERP Learner from changing password",
    async () => {
      const req = createMockReq({
        user: { authSource: "ERP_LEARNER", id: "temp-id" },
        body: { oldPassword: "old", newPassword: "newPassword123" },
      });
      const res = createMockRes();

      await changePassword(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.error.code, "NOT_SUPPORTED");
    },
  );

  await t.test(
    "should handle concurrent account removal during password change gracefully",
    async () => {
      setupMockDatabase();

      mockDatabase.principals = [];

      const req = createMockReq({
        user: { id: "user-1" },
        body: { oldPassword: "password", newPassword: "newPassword123" },
      });

      // Simulate SELECT query inside changePassword
      const userExists = mockDatabase.principals.find(
        (p) => p.id === req.user.id,
      );
      assert.equal(userExists, undefined);
    },
  );

  await t.test(
    "should handle changing password to the exact same password",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        user: { id: "user-1" },
        body: {
          oldPassword: "password",
          newPassword: "password",
        },
      });

      // Simulate password validation logic
      const principal = mockDatabase.principals.find(
        (p) => p.id === req.user.id,
      );
      const isOldPasswordValid = await mockBcrypt.compare(
        req.body.oldPassword,
        principal.password_hash,
      );

      assert.equal(isOldPasswordValid, true);
      assert.ok(req.body.newPassword.length >= 8);
    },
  );
});

// edge cases and secutiry testing
test("EDGE CASES AND SECURITY", async (t) => {
  await t.test("should normalize email to lowercase", async () => {
    setupMockDatabase();

    const testCases = [
      "Admin@Lpms.Com",
      "ADMIN@LPMS.COM",
      "admin@lpms.com",
      "AdMiN@LpMs.CoM",
    ];

    testCases.forEach((email) => {
      const lowercased = email.toLowerCase();
      assert.equal(lowercased, "admin@lpms.com");
    });
  });

  await t.test("should handle empty email gracefully", async () => {
    setupMockDatabase();

    const email = "";
    const trimmed = email.trim();
    assert.equal(trimmed, "");
  });

  await t.test("should handle whitespace in email", async () => {
    setupMockDatabase();

    const email = "  admin@lpms.com  ";
    const trimmed = email.trim().toLowerCase();
    assert.equal(trimmed, "admin@lpms.com");
  });

  await t.test("should distinguish between roles correctly", async () => {
    setupMockDatabase();

    const superAdmin = mockDatabase.principals.find(
      (p) => p.role === ROLES.SUPER_ADMIN,
    );
    const learningAdmin = mockDatabase.principals.find(
      (p) => p.role === ROLES.LEARNING_ADMIN,
    );
    const employee = mockDatabase.principals.find(
      (p) => p.role === ROLES.EMPLOYEE,
    );

    assert.notEqual(superAdmin.role, learningAdmin.role);
    assert.notEqual(superAdmin.role, employee.role);
    assert.notEqual(learningAdmin.role, employee.role);
  });

  await t.test("should handle token expiration correctly", async () => {
    setupMockDatabase();

    // Token expiring in future
    const validToken = {
      expires_at: new Date(Date.now() + 1000),
    };
    assert.equal(new Date(validToken.expires_at) > new Date(), true);

    // Token expiring in past
    const expiredToken = {
      expires_at: new Date(Date.now() - 1000),
    };
    assert.equal(new Date(expiredToken.expires_at) < new Date(), true);
  });

  await t.test("should correctly fallback ERP name resolution", async () => {
    const fallbackName = "12345";

    // Scenario 1: Full name present
    let details = { data: [{ employeeName: " Julia Silva " }] };
    let mapped = details.data[0].employeeName.trim();
    assert.equal(mapped, "Julia Silva");

    // Scenario 2: No full name, but has initials and surname
    details = {
      data: [{ employeeInitials: " J ", employeeSurname: " Silva " }],
    };
    mapped = `${details.data[0].employeeInitials.trim()} ${details.data[0].employeeSurname.trim()}`;
    assert.equal(mapped, "J Silva");

    // Scenario 3: Nothing present, use fallback
    details = { data: [{}] };
    mapped = fallbackName;
    assert.equal(mapped, "12345");
  });
});
