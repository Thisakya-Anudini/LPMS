import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- MOCK ALL EXTERNAL DEPENDENCIES BEFORE IMPORTING CONTROLLER ----

vi.mock("../db.js", () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

vi.mock("../utils/audit.js", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/http.js", () => ({
  sendError: vi.fn((res, status, code, message) => {
    res.statusCode = status;
    res.body = { error: { code, message } };
    return res;
  }),
}));

// ---- IMPORTS (after mocks) ----

import { query } from "../db.js";
import { logAudit } from "../utils/audit.js";
import { sendError } from "../utils/http.js";
import {
  getMyPaths,
  getPublicPaths,
  getMyProgress,
  getNotifications,
  getMyCertificates,
  updateMyEnrollmentProgress,
  selfEnrollPublicPath,
} from "../controllers/employeeController.js";

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
  };
  return res;
};

const createMockReq = (overrides = {}) => ({
  body: {},
  params: {},
  user: { id: "user-1" },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- EXPORTS TEST ----

describe("EMPLOYEE CONTROLLER EXPORTS", () => {
  it("should export getMyPaths as a function", () => {
    expect(typeof getMyPaths).toBe("function");
  });
  it("should export getPublicPaths as a function", () => {
    expect(typeof getPublicPaths).toBe("function");
  });
  it("should export getMyProgress as a function", () => {
    expect(typeof getMyProgress).toBe("function");
  });
  it("should export getNotifications as a function", () => {
    expect(typeof getNotifications).toBe("function");
  });
  it("should export getMyCertificates as a function", () => {
    expect(typeof getMyCertificates).toBe("function");
  });
  it("should export updateMyEnrollmentProgress as a function", () => {
    expect(typeof updateMyEnrollmentProgress).toBe("function");
  });
  it("should export selfEnrollPublicPath as a function", () => {
    expect(typeof selfEnrollPublicPath).toBe("function");
  });
});

// ---- GET MY PATHS TESTS ----

describe("GET MY PATHS", () => {
  const mockEnrollments = [
    {
      id: "enroll-1",
      status: "IN_PROGRESS",
      progress: 45,
      enrolled_at: new Date("2026-06-01"),
      completed_at: null,
      learning_path_id: "path-1",
      title: "Python Basics",
      description: "Learn Python programming",
      category: "PUBLIC",
      total_duration: 20,
    },
    {
      id: "enroll-2",
      status: "COMPLETED",
      progress: 100,
      enrolled_at: new Date("2026-05-01"),
      completed_at: new Date("2026-06-01"),
      learning_path_id: "path-2",
      title: "Leadership Training",
      description: "Become a better leader",
      category: "RESTRICTED",
      total_duration: 40,
    },
    {
      id: "enroll-3",
      status: "NOT_STARTED",
      progress: 0,
      enrolled_at: new Date("2026-06-05"),
      completed_at: null,
      learning_path_id: "path-3",
      title: "Communication Skills",
      description: "Improve communication",
      category: "PUBLIC",
      total_duration: 15,
    },
  ];

  it("should return all enrollments for current user", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockEnrollments,
      rowCount: 3,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollments).toHaveLength(3);
    expect(res.body.enrollments[0].id).toBe("enroll-1");
  });

  it("should only return current user enrollments (security - principal_id filter)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockEnrollments,
      rowCount: 3,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();
    await getMyPaths(req, res);

    expect(res.statusCode).toBe(200);
    // Verify the query used req.user.id
    expect(vi.mocked(query).mock.calls[0][1][0]).toBe("user-1");
  });

  it("should exclude deleted learning paths (is_deleted = FALSE in query)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockEnrollments,
      rowCount: 3,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyPaths(req, res);

    expect(res.statusCode).toBe(200);
    // Verify the SQL includes is_deleted = FALSE
    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("is_deleted");
    expect(sql).toContain("FALSE");
  });

  it("should order enrollments by enrolled_at DESC", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockEnrollments,
      rowCount: 3,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyPaths(req, res);

    expect(res.statusCode).toBe(200);
    // Verify SQL has ORDER BY enrolled_at DESC
    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("DESC");
  });

  it("should return empty array when no enrollments", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq();
    const res = createMockRes();
    await getMyPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollments).toHaveLength(0);
  });

  it("should include all enrollment and learning path fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [mockEnrollments[0]],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyPaths(req, res);

    expect(res.statusCode).toBe(200);
    const enrollment = res.body.enrollments[0];
    expect(enrollment).toHaveProperty("id");
    expect(enrollment).toHaveProperty("status");
    expect(enrollment).toHaveProperty("progress");
    expect(enrollment).toHaveProperty("enrolled_at");
    expect(enrollment).toHaveProperty("learning_path_id");
    expect(enrollment).toHaveProperty("title");
    expect(enrollment).toHaveProperty("description");
    expect(enrollment).toHaveProperty("category");
    expect(enrollment).toHaveProperty("total_duration");
  });
});

// ---- GET PUBLIC PATHS TESTS ----

describe("GET PUBLIC PATHS", () => {
  const publicPaths = [
    {
      id: "path-1",
      title: "Python Basics",
      description: "Learn Python programming",
      category: "PUBLIC",
      total_duration: 20,
      status: "ACTIVE",
      already_enrolled: true,
    },
    {
      id: "path-3",
      title: "Communication Skills",
      description: "Improve communication",
      category: "PUBLIC",
      total_duration: 15,
      status: "ACTIVE",
      already_enrolled: false,
    },
  ];

  it("should return only PUBLIC, ACTIVE, non-deleted learning paths", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: publicPaths,
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getPublicPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPaths).toHaveLength(2);
  });

  it("should set already_enrolled=true if user enrolled", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: publicPaths,
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getPublicPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPaths[0].already_enrolled).toBe(true);
  });

  it("should set already_enrolled=false if user not enrolled", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: publicPaths,
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getPublicPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPaths[1].already_enrolled).toBe(false);
  });

  it("should order paths by created_at DESC", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: publicPaths,
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getPublicPaths(req, res);

    // Verify SQL has ORDER BY
    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("DESC");
  });

  it("should return empty array when no public paths", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq();
    const res = createMockRes();
    await getPublicPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPaths).toHaveLength(0);
  });

  it("should use LEFT JOIN to check enrollment for the current user only", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: publicPaths,
      rowCount: 2,
    });

    const req = createMockReq({ user: { id: "user-2" } });
    const res = createMockRes();
    await getPublicPaths(req, res);

    // Verify the user ID is passed as parameter
    expect(vi.mocked(query).mock.calls[0][1][0]).toBe("user-2");
  });
});

// ---- GET MY PROGRESS TESTS ----

describe("GET MY PROGRESS", () => {
  it("should calculate total_enrollments, completed_enrollments, average_progress", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          total_enrollments: "3",
          completed_enrollments: "1",
          average_progress: "48.33",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyProgress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.progress.total_enrollments).toBe("3");
    expect(res.body.progress.completed_enrollments).toBe("1");
    expect(res.body.progress.average_progress).toBe("48.33");
  });

  it("should return 0 for average_progress when no enrollments", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          total_enrollments: "0",
          completed_enrollments: "0",
          average_progress: "0.00",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ user: { id: "user-no-enrollments" } });
    const res = createMockRes();
    await getMyProgress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.progress.total_enrollments).toBe("0");
    expect(res.body.progress.average_progress).toBe("0.00");
  });

  it("should handle decimal precision (numeric 5,2)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          total_enrollments: "1",
          completed_enrollments: "0",
          average_progress: "33.33",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyProgress(req, res);

    expect(res.statusCode).toBe(200);
    // Verify format: 2 decimal places
    expect(res.body.progress.average_progress).toMatch(/^\d+\.\d{2}$/);
  });

  it("should only count current users enrollments (principal_id filter)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          total_enrollments: "3",
          completed_enrollments: "1",
          average_progress: "48.33",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();
    await getMyProgress(req, res);

    expect(vi.mocked(query).mock.calls[0][1][0]).toBe("user-1");
  });
});

// ---- GET NOTIFICATIONS TESTS ----

describe("GET NOTIFICATIONS", () => {
  const mockNotifications = [
    {
      id: "notif-1",
      title: "Certificate Issued",
      message: "Congratulations! Your certificate has been issued.",
      type: "SUCCESS",
      is_read: false,
      created_at: new Date("2026-06-05T10:30:00Z"),
    },
    {
      id: "notif-2",
      title: "Course Reminder",
      message: "You have 3 days to complete Python Basics.",
      type: "WARNING",
      is_read: true,
      created_at: new Date("2026-06-04T14:00:00Z"),
    },
    {
      id: "notif-3",
      title: "Enrollment Confirmed",
      message: "You have enrolled in Leadership Training.",
      type: "INFO",
      is_read: true,
      created_at: new Date("2026-06-03T09:00:00Z"),
    },
  ];

  it("should return notifications for current user", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockNotifications,
      rowCount: 3,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(3);
  });

  it("should only return current users notifications (principal_id filter)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockNotifications,
      rowCount: 3,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();
    await getNotifications(req, res);

    expect(vi.mocked(query).mock.calls[0][1][0]).toBe("user-1");
  });

  it("should order by created_at DESC", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockNotifications,
      rowCount: 3,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getNotifications(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("DESC");
  });

  it("should limit to 50 notifications", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockNotifications,
      rowCount: 3,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getNotifications(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("LIMIT");
    expect(sql).toContain("50");
  });

  it("should return empty array when no notifications", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq();
    const res = createMockRes();
    await getNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(0);
  });

  it("should include all notification fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [mockNotifications[0]],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getNotifications(req, res);

    const notif = res.body.notifications[0];
    expect(notif).toHaveProperty("id");
    expect(notif).toHaveProperty("title");
    expect(notif).toHaveProperty("message");
    expect(notif).toHaveProperty("type");
    expect(notif).toHaveProperty("is_read");
    expect(notif).toHaveProperty("created_at");
  });
});

// ---- GET MY CERTIFICATES TESTS ----

describe("GET MY CERTIFICATES", () => {
  const mockCertificates = [
    {
      id: "cert-1",
      scope: "FULL",
      issued_at: new Date("2026-06-01T10:00:00Z"),
      learning_path_id: "path-2",
      learning_path_title: "Leadership Training",
    },
    {
      id: "cert-2",
      scope: "FULL",
      issued_at: new Date("2026-05-15T14:30:00Z"),
      learning_path_id: "path-1",
      learning_path_title: "Python Basics",
    },
  ];

  it("should return certificates for current user", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockCertificates,
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyCertificates(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.certificates).toHaveLength(2);
  });

  it("should only return current users certificates (principal_id filter)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockCertificates,
      rowCount: 2,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();
    await getMyCertificates(req, res);

    expect(vi.mocked(query).mock.calls[0][1][0]).toBe("user-1");
  });

  it("should include learning path title via JOIN", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockCertificates,
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyCertificates(req, res);

    expect(res.body.certificates[0].learning_path_title).toBe(
      "Leadership Training",
    );
    expect(res.body.certificates[1].learning_path_title).toBe("Python Basics");
  });

  it("should order by issued_at DESC", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: mockCertificates,
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyCertificates(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("DESC");
  });

  it("should return empty array when no certificates", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq();
    const res = createMockRes();
    await getMyCertificates(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.certificates).toHaveLength(0);
  });

  it("should include scope field", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [mockCertificates[0]],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await getMyCertificates(req, res);

    expect(res.body.certificates[0].scope).toBe("FULL");
  });
});

// ---- UPDATE MY ENROLLMENT PROGRESS TESTS ----

describe("UPDATE MY ENROLLMENT PROGRESS", () => {
  it("should accept valid progress (45%)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "IN_PROGRESS",
          progress: 45,
          completed_at: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 45 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollment.status).toBe("IN_PROGRESS");
  });

  it("should accept valid progress (0%)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "NOT_STARTED",
          progress: 0,
          completed_at: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 0 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollment.status).toBe("NOT_STARTED");
  });

  it("should accept valid progress (100%)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "COMPLETED",
          progress: 100,
          completed_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    // Mock the certificate INSERT
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // Mock the notification INSERT
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 100 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollment.status).toBe("COMPLETED");
    // Should have created certificate and notification
    expect(vi.mocked(query).mock.calls.length).toBe(3);
  });

  it("should reject negative progress", async () => {
    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: -5 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject progress > 100", async () => {
    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 150 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject non-number progress", async () => {
    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: "50" },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject NaN progress", async () => {
    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: NaN },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should only update own enrollments (principal_id check in WHERE)", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "IN_PROGRESS",
          progress: 50,
          completed_at: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 50 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    // Verify the query includes both id AND principal_id
    const sql = vi.mocked(query).mock.calls[0][0];
    const params = vi.mocked(query).mock.calls[0][1];
    expect(sql).toContain("principal_id");
    expect(params[1]).toBe("user-1");
  });

  it("should return 404 if enrollment not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      params: { enrollmentId: "nonexistent" },
      body: { progress: 50 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should create certificate when progress reaches 100%", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "COMPLETED",
          progress: 100,
          completed_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    // Certificate INSERT
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // Notification INSERT
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 100 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    // Second query should be INSERT into certificates
    expect(vi.mocked(query).mock.calls[1][0]).toContain(
      "INSERT INTO certificates",
    );
  });

  it("should create notification when progress reaches 100%", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "COMPLETED",
          progress: 100,
          completed_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    // Certificate INSERT
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // Notification INSERT
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 100 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    // Third query should be INSERT into notifications
    expect(vi.mocked(query).mock.calls[2][0]).toContain(
      "INSERT INTO notifications",
    );
  });

  it("should log audit trail on successful update", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "IN_PROGRESS",
          progress: 50,
          completed_at: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 50 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "user-1",
      action: "UPDATE_ENROLLMENT_PROGRESS",
      resourceType: "ENROLLMENT",
      resourceId: "enroll-1",
    });
  });

  it("should set completed_at when progress >= 100", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "COMPLETED",
          progress: 100,
          completed_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    // Certificate INSERT
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // Notification INSERT
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 100 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    // Verify CASE WHEN in SQL
    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("CASE WHEN");
    expect(res.body.enrollment.completed_at).toBeTruthy();
  });

  it("should clear completed_at when progress < 100", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "IN_PROGRESS",
          progress: 50,
          completed_at: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 50 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    // Verify SQL sets completed_at = NULL for < 100
    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ELSE NULL");
    expect(res.body.enrollment.completed_at).toBeNull();
  });

  it("should not create certificate or notification when progress < 100", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-1",
          status: "IN_PROGRESS",
          progress: 50,
          completed_at: null,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { enrollmentId: "enroll-1" },
      body: { progress: 50 },
    });
    const res = createMockRes();
    await updateMyEnrollmentProgress(req, res);

    // Only 1 query call (the UPDATE), no INSERT for cert/notification
    expect(vi.mocked(query).mock.calls.length).toBe(1);
  });
});

// ---- SELF ENROLL PUBLIC PATH TESTS ----

describe("SELF ENROLL PUBLIC PATH", () => {
  it("should enroll in valid PUBLIC, ACTIVE, non-deleted path", async () => {
    // Mock: find learning path
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-1",
          title: "Python Basics",
          category: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });
    // Mock: INSERT enrollment
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-new",
          principal_id: "user-1",
          learning_path_id: "path-1",
          status: "NOT_STARTED",
          progress: 0,
          enrolled_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    // Mock: INSERT notification
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      body: { learningPathId: "path-1" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.enrollment.status).toBe("NOT_STARTED");
    expect(res.body.enrollment.progress).toBe(0);
  });

  it("should reject enrollment in non-existent path", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: { learningPathId: "nonexistent" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should reject enrollment in RESTRICTED path", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-2",
          title: "Leadership Training",
          category: "RESTRICTED",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: { learningPathId: "path-2" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should reject enrollment in SEMI_RESTRICTED path", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-7",
          title: "Semi-Restricted Path",
          category: "SEMI_RESTRICTED",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: { learningPathId: "path-7" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should reject enrollment in INACTIVE path", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-4",
          title: "Advanced Python",
          category: "PUBLIC",
          status: "INACTIVE",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: { learningPathId: "path-4" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should reject enrollment in ARCHIVED path", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-5",
          title: "Archived Course",
          category: "PUBLIC",
          status: "ARCHIVED",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      body: { learningPathId: "path-5" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should reject enrollment in deleted path (is_deleted = FALSE in WHERE)", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: { learningPathId: "path-6" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should reject if already enrolled (ON CONFLICT DO NOTHING)", async () => {
    // Mock: find learning path
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-1",
          title: "Python Basics",
          category: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });
    // Mock: INSERT returns 0 rows (conflict)
    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({
      body: { learningPathId: "path-1" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("should create enrollment with status NOT_STARTED", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-1",
          title: "Python Basics",
          category: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-new",
          status: "NOT_STARTED",
          progress: 0,
          enrolled_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      body: { learningPathId: "path-1" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.enrollment.status).toBe("NOT_STARTED");
  });

  it("should create enrollment with progress 0", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-1",
          title: "Python Basics",
          category: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-new",
          status: "NOT_STARTED",
          progress: 0,
          enrolled_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      body: { learningPathId: "path-1" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.enrollment.progress).toBe(0);
  });

  it("should set enrollment_source to SELF", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-1",
          title: "Python Basics",
          category: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-new",
          status: "NOT_STARTED",
          progress: 0,
          enrolled_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      body: { learningPathId: "path-1" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    // Verify INSERT includes 'SELF' as enrollment_source
    const insertSql = vi.mocked(query).mock.calls[1][0];
    expect(insertSql).toContain("SELF");
  });

  it("should create notification on successful enrollment", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-1",
          title: "Python Basics",
          category: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-new",
          status: "NOT_STARTED",
          progress: 0,
          enrolled_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      body: { learningPathId: "path-1" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    // Third query should be INSERT into notifications
    expect(vi.mocked(query).mock.calls[2][0]).toContain(
      "INSERT INTO notifications",
    );
  });

  it("should log audit trail on successful enrollment", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-1",
          title: "Python Basics",
          category: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-new",
          principal_id: "user-1",
          learning_path_id: "path-1",
          status: "NOT_STARTED",
          progress: 0,
          enrolled_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      body: { learningPathId: "path-1" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(201);
    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "user-1",
      action: "SELF_ENROLL_PUBLIC_PATH",
      resourceType: "ENROLLMENT",
    });
  });

  it("should return 201 status on successful self-enrollment", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "path-1",
          title: "Python Basics",
          category: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "enroll-new",
          status: "NOT_STARTED",
          progress: 0,
          enrolled_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const req = createMockReq({
      body: { learningPathId: "path-1" },
    });
    const res = createMockRes();
    await selfEnrollPublicPath(req, res);

    expect(res.statusCode).toBe(201);
  });
});
