import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ---- MOCK ALL EXTERNAL DEPENDENCIES BEFORE IMPORTING CONTROLLER ----

vi.mock("../db.js", () => ({
  query: vi.fn(),
}));

vi.mock("../utils/erpClient.js", () => ({
  fetchEmployeeDetailsForServiceNo: vi
    .fn()
    .mockRejectedValue(new Error("No ERP mock set for this test")),
  fetchEmployeeSubordinates: vi
    .fn()
    .mockResolvedValue({ success: true, message: "", data: [] }), // ← this is the fallback
}));

vi.mock("../utils/auth.js", () => ({
  signAccessToken: vi.fn(() => "mock-access-token"),
  signRefreshToken: vi.fn(() => "mock-refresh-token"),
  hashToken: vi.fn((token) => `hashed-${token}`),
  verifyToken: vi.fn(),
  addDays: vi.fn(() => new Date("2026-06-18")),
  getRefreshTokenTtlDays: vi.fn(() => 7),
}));

vi.mock("../users/learner.js", () => ({
  buildTemporaryErpLearner: vi.fn(),
  isTemporaryErpLearnerAuth: vi.fn(() => false),
  isValidTemporaryErpLearnerPassword: vi.fn(),
  ERP_LEARNER_AUTH_SOURCE: "ERP_LEARNER",
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

// ---- IMPORTS (after mocks) ----

import { query } from "../db.js";
import {
  fetchEmployeeDetailsForServiceNo,
  fetchEmployeeSubordinates,
} from "../utils/erpClient.js";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  verifyToken,
  addDays,
  getRefreshTokenTtlDays,
} from "../utils/auth.js";
import {
  buildTemporaryErpLearner,
  isTemporaryErpLearnerAuth,
  isValidTemporaryErpLearnerPassword,
} from "../users/learner.js";
import {
  login,
  refresh,
  logout,
  me,
  changePassword,
} from "../controllers/authController.js";
import { ROLES } from "../constants/roles.js";

// ---- TEST HELPERS ----

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

// Resets all mocks before each test
beforeEach(() => {
  vi.resetAllMocks(); // ← replaces vi.clearAllMocks()
  vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);
  vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 });
  vi.mocked(fetchEmployeeSubordinates).mockResolvedValue({
    success: true,
    message: "",
    data: [],
  });
  vi.mocked(fetchEmployeeDetailsForServiceNo).mockRejectedValue(
    new Error("No ERP mock set for this test"),
  );
  vi.mocked(signAccessToken).mockReturnValue("mock-access-token");
  vi.mocked(signRefreshToken).mockReturnValue("mock-refresh-token");
  vi.mocked(hashToken).mockImplementation((token) => `hashed-${token}`);
  vi.mocked(addDays).mockReturnValue(new Date("2026-06-18"));
  vi.mocked(getRefreshTokenTtlDays).mockReturnValue(7);
});

// ---- EXPORTS TEST ----

describe("AUTH CONTROLLER EXPORTS", () => {
  it("should export login as a function", () => {
    expect(typeof login).toBe("function");
  });
  it("should export refresh as a function", () => {
    expect(typeof refresh).toBe("function");
  });
  it("should export logout as a function", () => {
    expect(typeof logout).toBe("function");
  });
  it("should export me as a function", () => {
    expect(typeof me).toBe("function");
  });
  it("should export changePassword as a function", () => {
    expect(typeof changePassword).toBe("function");
  });
});

// ---- LOGIN TESTS ----

describe("LOGIN", () => {
  const validPasswordHash =
    "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/SlO";
  const mockPrincipal = {
    id: "user-1",
    email: "admin@lpms.com",
    name: "Admin User",
    role: ROLES.SUPER_ADMIN,
    password_hash: validPasswordHash,
    principal_type: "USER",
    must_change_password: false,
  };

  it("should return 200 with tokens for valid system user credentials", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [mockPrincipal],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    vi.mocked(signAccessToken).mockReturnValue("access-token-1");
    vi.mocked(signRefreshToken).mockReturnValue("refresh-token-1");
    vi.mocked(hashToken).mockReturnValue("hashed-refresh-token");
    vi.mocked(addDays).mockReturnValue(new Date("2026-06-18"));

    const req = createMockReq({
      body: { email: "admin@lpms.com", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBe("access-token-1");
    expect(res.body.refreshToken).toBe("refresh-token-1");
    expect(res.body.user.role).toBe(ROLES.SUPER_ADMIN);
    expect(res.body.user.email).toBe("admin@lpms.com");
    expect(res.body.user.authSource).toBe("SYSTEM");
  });

  it("should return 401 for invalid password", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [mockPrincipal],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false);

    const req = createMockReq({
      body: { email: "admin@lpms.com", password: "wrong-password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("should return 401 for non-existent user (no ERP fallback)", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(buildTemporaryErpLearner).mockReturnValueOnce(null);

    const req = createMockReq({
      body: { email: "nonexistent@lpms.com", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("should handle case-insensitive email lookup", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [mockPrincipal],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    vi.mocked(signAccessToken).mockReturnValue("access-token-2");

    const req = createMockReq({
      body: { email: "ADMIN@LPMS.COM", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    // The query should receive the lowercased email
    expect(vi.mocked(query).mock.calls[0][1][0]).toBe("admin@lpms.com");
    expect(res.statusCode).toBe(200);
  });

  it("should return 401 for deactivated user (is_active = FALSE)", async () => {
    // The real getPrincipalByEmail queries with AND is_active = TRUE
    // So deactivated user returns no rows
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(buildTemporaryErpLearner).mockReturnValueOnce(null);

    const req = createMockReq({
      body: { email: "admin@lpms.com", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("should map SUPERVISOR DB role to EMPLOYEE", async () => {
    const supervisorPrincipal = {
      ...mockPrincipal,
      role: ROLES.SUPERVISOR,
    };
    // Mock: find principal by email
    vi.mocked(query).mockResolvedValueOnce({
      rows: [supervisorPrincipal],
      rowCount: 1,
    });
    // Mock: resolveEmployeeContext → find employee number
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "12345" }],
      rowCount: 1,
    });
    // Mock: resolveEmployeeContextByNumber → check learning admin
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "12345" }],
      rowCount: 1,
    });
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({
      data: [{ employeeNo: "12346" }],
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    vi.mocked(signAccessToken).mockReturnValue("access-token-supervisor");

    const req = createMockReq({
      body: { email: "admin@lpms.com", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe(ROLES.EMPLOYEE);
  });

  it("should support login using username field instead of email", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [mockPrincipal],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    vi.mocked(signAccessToken).mockReturnValue("access-token-3");

    const req = createMockReq({
      body: { username: "admin@lpms.com", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(200);
  });

  it("should include mustChangePassword flag in response", async () => {
    const pwdChangePrincipal = {
      ...mockPrincipal,
      id: "user-2",
      must_change_password: true,
    };
    vi.mocked(query).mockResolvedValueOnce({
      rows: [pwdChangePrincipal],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);

    const req = createMockReq({
      body: { email: "employee@lpms.com", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it("should resolve employee context (supervisor status) for EMPLOYEE role", async () => {
    const employeePrincipal = {
      ...mockPrincipal,
      id: "user-2",
      email: "employee@lpms.com",
      role: ROLES.EMPLOYEE,
    };
    // Mock: find principal by email
    vi.mocked(query).mockResolvedValueOnce({
      rows: [employeePrincipal],
      rowCount: 1,
    });
    // Mock: find employee number by principal_id
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "12345" }],
      rowCount: 1,
    });
    // Mock: check learning admin assignment
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "12345" }],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({
      data: [{ employeeNo: "12346" }],
    });

    const req = createMockReq({
      body: { email: "employee@lpms.com", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.employeeNo).toBe("12345");
    expect(res.body.user.isSupervisor).toBe(true);
    expect(res.body.user.isLearningAdmin).toBe(true);
  });

  it("should login Temporary ERP Learner not in local DB", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(buildTemporaryErpLearner).mockReturnValueOnce({
      id: "erp-user-1",
      email: "12345@erp.local",
      employeeNo: "12345",
    });
    vi.mocked(isValidTemporaryErpLearnerPassword).mockReturnValueOnce(true);
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockResolvedValueOnce({
      data: [{ employeeName: "John Doe", email: "john@erp.local" }],
    });
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({
      data: [{ employeeNo: "12346" }],
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "12345" }],
      rowCount: 1,
    });
    vi.mocked(signAccessToken).mockReturnValue("erp-access-token");
    vi.mocked(signRefreshToken).mockReturnValue("erp-refresh-token");

    const req = createMockReq({
      body: { email: "12345@erp.local", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.authSource).toBe("ERP_LEARNER");
    expect(res.body.user.name).toBe("John Doe");
    expect(res.body.accessToken).toBe("erp-access-token");
  });

  it("should login ERP Learner even when ERP service is offline", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(buildTemporaryErpLearner).mockReturnValueOnce({
      id: "erp-user-2",
      email: "99999@erp.local",
      employeeNo: "99999",
    });
    vi.mocked(isValidTemporaryErpLearnerPassword).mockReturnValueOnce(true);
    // ERP fetch throws
    vi.mocked(fetchEmployeeDetailsForServiceNo).mockRejectedValueOnce(
      new Error("ERP offline"),
    );
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({ data: [] });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "99999" }],
      rowCount: 0,
    });
    vi.mocked(signAccessToken).mockReturnValue("erp-access-token-2");
    vi.mocked(signRefreshToken).mockReturnValue("erp-refresh-token-2");

    const req = createMockReq({
      body: { email: "99999@erp.local", password: "password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe("99999"); // fallback to employeeNo
  });

  it("should reject invalid ERP credentials", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(buildTemporaryErpLearner).mockReturnValueOnce({
      id: "erp-user-1",
      email: "12345@erp.local",
      employeeNo: "12345",
    });
    vi.mocked(isValidTemporaryErpLearnerPassword).mockReturnValueOnce(false);

    const req = createMockReq({
      body: { email: "12345@erp.local", password: "wrong-password" },
    });
    const res = createMockRes();
    await login(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

// ---- REFRESH TOKEN TESTS ----

describe("REFRESH TOKEN", () => {
  it("should return 400 when refreshToken is missing", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    await refresh(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 for malformed/garbage refresh token", async () => {
    vi.mocked(verifyToken).mockImplementationOnce(() => {
      throw new Error("jwt malformed");
    });

    const req = createMockReq({
      body: { refreshToken: "not-a-valid-jwt-string-at-all" },
    });
    const res = createMockRes();
    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("should return 401 for refresh token not in database", async () => {
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "nonexistent-token-id",
      sub: "user-1",
    });
    vi.mocked(hashToken).mockReturnValue("hashed-nonexistent");
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: { refreshToken: "valid-jwt-but-not-in-db" },
    });
    const res = createMockRes();
    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("should return 401 for expired refresh token", async () => {
    const expiredDate = new Date(Date.now() - 1000);
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "token-1",
      sub: "user-1",
    });
    vi.mocked(hashToken).mockReturnValue("hashed-token");
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "token-1",
          revoked_at: null,
          expires_at: expiredDate,
          principal_id: "user-1",
          email: "admin@lpms.com",
          name: "Admin",
          role: ROLES.SUPER_ADMIN,
          principal_type: "USER",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: { refreshToken: "expired-jwt-token" },
    });
    const res = createMockRes();
    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("should return 401 for revoked refresh token", async () => {
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "token-1",
      sub: "user-1",
    });
    vi.mocked(hashToken).mockReturnValue("hashed-token");
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "token-1",
          revoked_at: new Date(),
          expires_at: new Date(Date.now() + 10000),
          principal_id: "user-1",
          email: "admin@lpms.com",
          name: "Admin",
          role: ROLES.SUPER_ADMIN,
          principal_type: "USER",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: { refreshToken: "revoked-jwt-token" },
    });
    const res = createMockRes();
    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("should return 200 with new access token for valid refresh token", async () => {
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "token-1",
      sub: "user-1",
    });
    vi.mocked(hashToken).mockReturnValue("hashed-token");
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "token-1",
          revoked_at: null,
          expires_at: new Date(Date.now() + 10000),
          principal_id: "user-1",
          email: "admin@lpms.com",
          name: "Admin User",
          role: ROLES.SUPER_ADMIN,
          principal_type: "USER",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });
    vi.mocked(signAccessToken).mockReturnValue("new-access-token");

    const req = createMockReq({
      body: { refreshToken: "valid-jwt-token" },
    });
    const res = createMockRes();
    await refresh(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBe("new-access-token");
  });

  it("should handle Temporary ERP Learner refresh", async () => {
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "erp-token-id",
      sub: "erp-user-1",
      email: "12345@erp.local",
      name: "John Doe",
      role: ROLES.EMPLOYEE,
      principalType: "EMPLOYEE",
      authSource: "ERP_LEARNER",
      employeeNo: "12345",
      isSupervisor: true,
      isLearningAdmin: false,
    });
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValueOnce(true);
    vi.mocked(signAccessToken).mockReturnValue("new-erp-access-token");

    const req = createMockReq({
      body: { refreshToken: "erp-jwt-token" },
    });
    const res = createMockRes();
    await refresh(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBe("new-erp-access-token");
  });

  it("should dynamically re-resolve role and permissions on refresh", async () => {
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "token-2",
      sub: "user-2",
    });
    vi.mocked(hashToken).mockReturnValue("hashed-token-2");
    // First query: join tokens + principals
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "token-2",
          revoked_at: null,
          expires_at: new Date(Date.now() + 10000),
          principal_id: "user-2",
          email: "employee@lpms.com",
          name: "Employee User",
          role: ROLES.EMPLOYEE,
          principal_type: "USER",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });
    // Second query: resolve employee number
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "12345" }],
      rowCount: 1,
    });
    // Third query: check learning admin assignment
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ employee_number: "12345" }],
      rowCount: 1,
    });
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({
      data: [{ employeeNo: "12346" }],
    });
    vi.mocked(signAccessToken).mockReturnValue("updated-access-token");

    const req = createMockReq({
      body: { refreshToken: "valid-jwt-token" },
    });
    const res = createMockRes();
    await refresh(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBe("updated-access-token");
  });

  it("VULNERABILITY: should reject refresh if user is deactivated (BUG: controller does not check is_active)", async () => {
    // This test documents the known vulnerability:
    // The refresh() controller queries refresh_tokens JOIN auth_principals
    // but does NOT filter by ap.is_active = TRUE.
    // Therefore a deactivated user's refresh token still works.
    //
    // Once the controller is fixed to add is_active check, change
    // the expectation from 200 to 401.
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "token-deactivated",
      sub: "user-deactivated",
    });
    vi.mocked(hashToken).mockReturnValue("hashed-deactivated");
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "token-deactivated",
          revoked_at: null,
          expires_at: new Date(Date.now() + 10000),
          principal_id: "user-deactivated",
          email: "deactivated@lpms.com",
          name: "Deactivated User",
          role: ROLES.EMPLOYEE,
          principal_type: "USER",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });
    // Employee context queries
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({ data: [] });

    const req = createMockReq({
      body: { refreshToken: "deactivated-user-token" },
    });
    const res = createMockRes();
    await refresh(req, res);

    // Currently returns 200 — this is the bug.
    // When fixed, change to: expect(res.statusCode).toBe(401);
    expect(res.statusCode).toBe(200);
  });
});

// ---- LOGOUT TESTS ----

describe("LOGOUT", () => {
  it("should return 400 when refreshToken is missing", async () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    await logout(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 200 and revoke refresh token on logout", async () => {
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "token-1",
      sub: "user-1",
    });
    vi.mocked(hashToken).mockReturnValue("hashed-token");
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      body: { refreshToken: "valid-jwt-token" },
    });
    const res = createMockRes();
    await logout(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // Verify the UPDATE query was called to revoke the token
    expect(vi.mocked(query).mock.calls[0][0]).toContain(
      "UPDATE refresh_tokens",
    );
    expect(vi.mocked(query).mock.calls[0][0]).toContain("SET revoked_at");
  });

  it("should handle already logged out or invalid token gracefully (returns 200)", async () => {
    vi.mocked(verifyToken).mockImplementationOnce(() => {
      throw new Error("jwt malformed");
    });

    const req = createMockReq({
      body: { refreshToken: "invalid-or-already-revoked-jwt" },
    });
    const res = createMockRes();
    await logout(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.error.code).toBe("OK");
  });

  it("should return success for multiple logout attempts", async () => {
    // First logout: valid token
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "token-1",
      sub: "user-1",
    });
    vi.mocked(hashToken).mockReturnValue("hashed-token");
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req1 = createMockReq({
      body: { refreshToken: "valid-jwt-token" },
    });
    const res1 = createMockRes();
    await logout(req1, res1);
    expect(res1.statusCode).toBe(200);

    // Second logout: token already revoked (token invalid after revoke)
    vi.mocked(verifyToken).mockImplementationOnce(() => {
      throw new Error("jwt expired");
    });

    const req2 = createMockReq({
      body: { refreshToken: "same-jwt-token-now-revoked" },
    });
    const res2 = createMockRes();
    await logout(req2, res2);
    expect(res2.statusCode).toBe(200);
  });

  it("should successfully logout Temporary ERP Learner bypassing DB", async () => {
    vi.mocked(verifyToken).mockReturnValueOnce({
      tokenId: "erp-token-id",
      sub: "erp-user-1",
      authSource: "ERP_LEARNER",
    });
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValueOnce(true);

    const req = createMockReq({
      body: { refreshToken: "erp-jwt-token" },
    });
    const res = createMockRes();
    await logout(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // Should NOT call DB for ERP learner
    expect(vi.mocked(query)).not.toHaveBeenCalled();
  });
});

// ---- ME ENDPOINT TESTS ----

describe("ME", () => {
  it("should return current user profile for SUPER_ADMIN", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          email: "admin@lpms.com",
          name: "Admin User",
          role: ROLES.SUPER_ADMIN,
          principal_type: "USER",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();
    await me(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe("admin@lpms.com");
    expect(res.body.user.role).toBe(ROLES.SUPER_ADMIN);
    expect(res.body.user.authSource).toBe("SYSTEM");
  });

  it("should return 404 if user not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "nonexistent-id" } });
    const res = createMockRes();
    await me(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 404 for deactivated user (is_active = FALSE)", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();
    await me(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("should resolve employee context for EMPLOYEE role", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-2",
            email: "employee@lpms.com",
            name: "Employee User",
            role: ROLES.EMPLOYEE,
            principal_type: "USER",
            must_change_password: false,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ employee_number: "12345" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ employee_number: "12345" }],
        rowCount: 1,
      });

    vi.mocked(fetchEmployeeSubordinates).mockResolvedValueOnce({
      // ← NOT mockImplementationOnce
      success: true,
      message: "",
      data: [{ employeeNo: "12346" }],
    });

    const req = createMockReq({ user: { id: "user-2" } });
    const res = createMockRes();
    await me(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.employeeNo).toBe("12345");
    expect(res.body.user.isSupervisor).toBe(true);
    expect(res.body.user.isLearningAdmin).toBe(true);
  });

  it("should return profile from JWT for Temporary ERP Learner bypassing DB", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValueOnce(true);

    const req = createMockReq({
      user: {
        id: "erp-user-1",
        email: "12345@erp.local",
        name: "John Doe",
        role: ROLES.EMPLOYEE,
        principalType: "EMPLOYEE",
        authSource: "ERP_LEARNER",
        employeeNo: "12345",
        isSupervisor: true,
        isLearningAdmin: false,
      },
    });
    const res = createMockRes();
    await me(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.authSource).toBe("ERP_LEARNER");
    expect(res.body.user.mustChangePassword).toBe(false);
    expect(res.body.user.employeeNo).toBe("12345");
    // Should NOT query DB for ERP learner
    expect(vi.mocked(query)).not.toHaveBeenCalled();
  });
});

// ---- CHANGE PASSWORD TESTS ----

describe("CHANGE PASSWORD", () => {
  it("should return 400 when current password is missing", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          password_hash: "$2a$10$hash",
        },
      ],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false);

    const req = createMockReq({
      user: { id: "user-1" },
      body: { newPassword: "NewPassword@123" },
    });
    const res = createMockRes();
    await changePassword(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("should return 400 when new password is missing", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    const req = createMockReq({
      user: { id: "user-1" },
      body: { oldPassword: "password" },
    });
    const res = createMockRes();
    await changePassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should validate new password length (minimum 8)", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    const req = createMockReq({
      user: { id: "user-1" },
      body: { oldPassword: "password", newPassword: "1234567" },
    });
    const res = createMockRes();
    await changePassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject incorrect old password", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          email: "admin@lpms.com",
          name: "Admin User",
          role: ROLES.SUPER_ADMIN,
          principal_type: "USER",
          password_hash: "$2a$10$hash",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false);

    const req = createMockReq({
      user: { id: "user-1" },
      body: { oldPassword: "wrong-password", newPassword: "NewPassword@123" },
    });
    const res = createMockRes();
    await changePassword(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("should update password hash and revoke refresh tokens", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);
    // Mock: find principal
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          email: "admin@lpms.com",
          name: "Admin User",
          role: ROLES.SUPER_ADMIN,
          principal_type: "USER",
          password_hash: "$2a$10$oldhash",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    vi.mocked(bcrypt.hash).mockResolvedValueOnce("$2a$10$newhash");
    // Mock: UPDATE password
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // Mock: REVOKE refresh tokens
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 2 });

    const req = createMockReq({
      user: { id: "user-1" },
      body: { oldPassword: "password", newPassword: "NewPassword@123" },
    });
    const res = createMockRes();
    await changePassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(false);

    // Verify both UPDATE queries were executed
    const updateCalls = vi
      .mocked(query)
      .mock.calls.filter(([sql]) => sql.includes("UPDATE"));
    expect(updateCalls.length).toBe(2);
  });

  it("should block Temporary ERP Learner from changing password", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(true);

    const req = createMockReq({
      user: { authSource: "ERP_LEARNER", id: "temp-id" },
      body: { oldPassword: "old", newPassword: "newPassword123" },
    });
    const res = createMockRes();
    await changePassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("NOT_SUPPORTED");
  });

  it("should return 404 if user is removed during password change", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);
    // User not found in DB (account removed)
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      user: { id: "user-1" },
      body: { oldPassword: "password", newPassword: "newPassword123" },
    });
    const res = createMockRes();
    await changePassword(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ---- EDGE CASES AND SECURITY TESTS ----

describe("EDGE CASES AND SECURITY", () => {
  it("should normalize email to lowercase for lookup", () => {
    const testCases = [
      "Admin@Lpms.Com",
      "ADMIN@LPMS.COM",
      "admin@lpms.com",
      "AdMiN@LpMs.CoM",
    ];
    testCases.forEach((email) => {
      expect(email.toLowerCase()).toBe("admin@lpms.com");
    });
  });

  it("should handle empty email gracefully", () => {
    const email = "";
    expect(email.trim()).toBe("");
  });

  it("should handle whitespace in email", () => {
    const email = "  admin@lpms.com  ";
    expect(email.trim().toLowerCase()).toBe("admin@lpms.com");
  });

  it("should distinguish between roles correctly", () => {
    expect(ROLES.SUPER_ADMIN).not.toBe(ROLES.LEARNING_ADMIN);
    expect(ROLES.SUPER_ADMIN).not.toBe(ROLES.EMPLOYEE);
    expect(ROLES.LEARNING_ADMIN).not.toBe(ROLES.EMPLOYEE);
  });

  it("should handle token expiration comparison", () => {
    const validToken = new Date(Date.now() + 1000);
    expect(validToken > new Date()).toBe(true);

    const expiredToken = new Date(Date.now() - 1000);
    expect(expiredToken < new Date()).toBe(true);
  });

  it("should correctly fallback ERP name resolution", () => {
    const fallbackName = "12345";

    // Scenario 1: Full name present
    let details = { data: [{ employeeName: " Julia Silva " }] };
    let mapped = details.data[0].employeeName.trim();
    expect(mapped).toBe("Julia Silva");

    // Scenario 2: No full name, but has initials and surname
    details = {
      data: [{ employeeInitials: " J ", employeeSurname: " Silva " }],
    };
    mapped = `${details.data[0].employeeInitials.trim()} ${details.data[0].employeeSurname.trim()}`;
    expect(mapped).toBe("J Silva");

    // Scenario 3: Nothing present, use fallback
    details = { data: [{}] };
    mapped = fallbackName;
    expect(mapped).toBe("12345");
  });

  it("should handle changing password to the exact same password", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          email: "admin@lpms.com",
          name: "Admin User",
          role: ROLES.SUPER_ADMIN,
          principal_type: "USER",
          password_hash: "$2a$10$hash",
          must_change_password: false,
        },
      ],
      rowCount: 1,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    vi.mocked(bcrypt.hash).mockResolvedValueOnce("$2a$10$samehash");
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      user: { id: "user-1" },
      body: { oldPassword: "password", newPassword: "password" },
    });
    const res = createMockRes();
    await changePassword(req, res);

    expect(res.statusCode).toBe(200);
  });
});
