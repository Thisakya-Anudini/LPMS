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

vi.mock("../users/learner.js", () => ({
  isTemporaryErpLearnerAuth: vi.fn(
    (user) => user?.authSource === "ERP_LEARNER",
  ),
}));

// Imports (after mocks)

import { query } from "../db.js";
import { sendError } from "../utils/http.js";
import { isTemporaryErpLearnerAuth } from "../users/learner.js";
import * as notificationController from "../controllers/notificationController.js";

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
    user: {
      id: "user-1",
      role: "EMPLOYEE",
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(query).mockReset();
  vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 });
});

// Export functions testing

describe("NOTIFICATION CONTROLLER EXPORTS", () => {
  const expectedExports = [
    "getMyNotifications",
    "markNotificationAsRead",
    "markAllNotificationsAsRead",
    "clearAllNotifications",
  ];

  for (const exportName of expectedExports) {
    it(`should export ${exportName}`, () => {
      expect(typeof notificationController[exportName]).toBe("function");
    });
  }
});

// getMyNotifications testing

describe("GET MY NOTIFICATIONS", () => {
  it("should resolve normal user principal from req.user.id", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "notif-1",
          title: "Test",
          message: "Msg",
          type: "INFO",
          is_read: false,
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    await notificationController.getMyNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
  });

  it("should resolve temporary ERP learner principal by employee number", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(true);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ principal_id: "erp-user-1" }],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "notif-1",
          title: "ERP Notification",
          message: "Msg",
          type: "INFO",
          is_read: false,
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      user: {
        id: "temp-user",
        authSource: "ERP_LEARNER",
        employeeNo: "EMP-001",
      },
    });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
  });

  it("should return empty notifications if ERP learner principal cannot be resolved", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(true);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({
      user: {
        id: "temp-user",
        authSource: "ERP_LEARNER",
        employeeNo: "UNKNOWN",
      },
    });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toEqual([]);
  });

  it("should return current user notifications only", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "notif-1",
          title: "Cert",
          message: "Cert issued",
          type: "SUCCESS",
          is_read: false,
          created_at: new Date(),
        },
        {
          id: "notif-2",
          title: "Reminder",
          message: "Pending",
          type: "WARNING",
          is_read: true,
          created_at: new Date(),
        },
        {
          id: "notif-3",
          title: "Enrollment",
          message: "Enrolled",
          type: "INFO",
          is_read: false,
          created_at: new Date(),
        },
      ],
      rowCount: 3,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    expect(res.body.notifications).toHaveLength(3);
    expect(res.body.notifications.every((n) => n.id.startsWith("notif-"))).toBe(
      true,
    );
  });

  it("should order notifications by created_at DESC (SQL handles ordering)", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { id: "notif-newest" },
        { id: "notif-mid" },
        { id: "notif-oldest" },
      ],
      rowCount: 3,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("DESC");
    expect(sql).toContain("LIMIT 100");
  });

  it("should include notification fields in response", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "notif-1",
          title: "Test Title",
          message: "Test Message",
          type: "SUCCESS",
          is_read: false,
          created_at: new Date("2026-06-05T10:30:00Z"),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    const notification = res.body.notifications[0];
    expect(notification.id).toBe("notif-1");
    expect(notification.title).toBe("Test Title");
    expect(notification.message).toBe("Test Message");
    expect(notification.type).toBe("SUCCESS");
    expect(notification.is_read).toBe(false);
    expect(notification.created_at).toBeDefined();
  });

  it("should return empty array when user has no notifications", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({ user: { id: "user-no-notifs" } });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toEqual([]);
  });

  it("should return empty notifications when ERP learner has no employeeNo", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(true);

    const req = createMockReq({
      user: {
        id: "temp-user",
        authSource: "ERP_LEARNER",
      },
    });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toEqual([]);
  });

  it("should trim whitespace from employeeNo during principal resolution", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(true);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ principal_id: "erp-user-1" }],
      rowCount: 1,
    });

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "notif-1",
          title: "Trimmed",
          message: "Test",
          type: "INFO",
          is_read: false,
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({
      user: {
        id: "temp-user",
        authSource: "ERP_LEARNER",
        employeeNo: "  EMP-001  ",
      },
    });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("employee_number = $1");
    expect(vi.mocked(query).mock.calls[0][1]).toEqual(["EMP-001"]);
  });
});

// markNotificationAsRead testing

describe("MARK NOTIFICATION AS READ", () => {
  it("should return 404 when ERP learner principal cannot be resolved", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(true);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({
      params: { id: "notif-1" },
      user: {
        id: "temp-user",
        authSource: "ERP_LEARNER",
        employeeNo: "UNKNOWN",
      },
    });
    const res = createMockRes();

    await notificationController.markNotificationAsRead(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should mark current user notification as read", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "notif-1", is_read: true }],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "notif-1" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await notificationController.markNotificationAsRead(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notification.id).toBe("notif-1");
    expect(res.body.notification.is_read).toBe(true);
  });

  it("should update notification state via SQL", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "notif-1", is_read: true }],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "notif-1" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await notificationController.markNotificationAsRead(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("UPDATE notifications");
    expect(sql).toContain("is_read = TRUE");
    expect(sql).toContain("RETURNING id, is_read");
  });

  it("should return updated notification object", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "notif-3", is_read: true }],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "notif-3" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await notificationController.markNotificationAsRead(req, res);

    expect(res.body.notification).toEqual({ id: "notif-3", is_read: true });
  });

  it("should not mark another user's notification", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({
      params: { id: "notif-4" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await notificationController.markNotificationAsRead(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.message).toBe("Notification not found.");
  });

  it("should return 404 if notification id does not exist", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({
      params: { id: "missing-notification" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await notificationController.markNotificationAsRead(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should verify principal_id is passed to query for ownership check", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "notif-1", is_read: true }],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "notif-1" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await notificationController.markNotificationAsRead(req, res);

    const params = vi.mocked(query).mock.calls[0][1];
    expect(params).toEqual(["notif-1", "user-1"]);
  });

  it("should return success with is_read true after marking", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "notif-2", is_read: true }],
      rowCount: 1,
    });

    const req = createMockReq({
      params: { id: "notif-2" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await notificationController.markNotificationAsRead(req, res);

    expect(res.body.notification).toBeDefined();
    expect(res.body.notification.is_read).toBe(true);
  });
});

// markAllNotificationsAsRead testing

describe("MARK ALL NOTIFICATIONS AS READ", () => {
  it("should return updatedCount 0 when ERP learner principal cannot be resolved", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(true);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({
      user: {
        id: "temp-user",
        authSource: "ERP_LEARNER",
        employeeNo: "UNKNOWN",
      },
    });
    const res = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.updatedCount).toBe(0);
  });

  it("should mark unread notifications for current user", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 2,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res);

    expect(res.body.updatedCount).toBe(2);
  });

  it("should not count already read notifications", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    // Only 2 unread notifications match WHERE is_read = FALSE
    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 2,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("is_read = FALSE");
    expect(res.body.updatedCount).toBe(2);
  });

  it("should use correct SQL for bulk update", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("UPDATE notifications");
    expect(sql).toContain("SET is_read = TRUE");
    expect(sql).toContain("WHERE principal_id = $1");
    expect(sql).toContain("AND is_read = FALSE");
  });

  it("should return success true and updated count", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 5,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.updatedCount).toBe("number");
  });

  it("should return updatedCount 0 when user has no unread notifications", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({ user: { id: "user-all-read" } });
    const res = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.updatedCount).toBe(0);
  });

  it("should be idempotent — calling twice does not error", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 2 });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "user-1" } });
    const res1 = createMockRes();
    const res2 = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res1);
    await notificationController.markAllNotificationsAsRead(req, res2);

    expect(res1.body.success).toBe(true);
    expect(res1.body.updatedCount).toBe(2);
    expect(res2.body.success).toBe(true);
    expect(res2.body.updatedCount).toBe(0);
  });

  it("should verify principal_id parameter is passed correctly", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res);

    const params = vi.mocked(query).mock.calls[0][1];
    expect(params).toEqual(["user-1"]);
  });
});

// clearAllNotifications testing

describe("CLEAR ALL NOTIFICATIONS", () => {
  it("should return deletedCount 0 when ERP learner principal cannot be resolved", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(true);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({
      user: {
        id: "temp-user",
        authSource: "ERP_LEARNER",
        employeeNo: "UNKNOWN",
      },
    });
    const res = createMockRes();

    await notificationController.clearAllNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedCount).toBe(0);
  });

  it("should delete all notifications for current user", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 3,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.clearAllNotifications(req, res);

    expect(res.body.deletedCount).toBe(3);
  });

  it("should use correct SQL for DELETE", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.clearAllNotifications(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("DELETE FROM notifications");
    expect(sql).toContain("WHERE principal_id = $1");
  });

  it("should return success true and deleted count", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 5,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.clearAllNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.deletedCount).toBe("number");
  });

  it("should return deletedCount 0 when user has no notifications", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const req = createMockReq({ user: { id: "user-3" } });
    const res = createMockRes();

    await notificationController.clearAllNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedCount).toBe(0);
  });

  it("should be idempotent — calling twice does not error", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 3 });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "user-1" } });
    const res1 = createMockRes();
    const res2 = createMockRes();

    await notificationController.clearAllNotifications(req, res1);
    await notificationController.clearAllNotifications(req, res2);

    expect(res1.body.success).toBe(true);
    expect(res1.body.deletedCount).toBe(3);
    expect(res2.body.success).toBe(true);
    expect(res2.body.deletedCount).toBe(0);
  });

  it("should verify DELETE targets correct principal_id only", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.clearAllNotifications(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    const params = vi.mocked(query).mock.calls[0][1];
    expect(sql).toContain("DELETE FROM notifications");
    expect(sql).toContain("WHERE principal_id = $1");
    expect(params).toEqual(["user-1"]);
  });

  it("should not include any other user in delete scope", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.clearAllNotifications(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];

    expect(sql).not.toContain("OR principal_id");
    expect(sql).not.toContain("IN (");
  });
});

// Notification Types and Response Shape

describe("NOTIFICATION TYPE VARIETY", () => {
  it("should handle all notification types (SUCCESS, WARNING, INFO, ERROR)", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "n1",
          title: "Cert",
          message: "Issued",
          type: "SUCCESS",
          is_read: false,
          created_at: new Date(),
        },
        {
          id: "n2",
          title: "Reminder",
          message: "Due",
          type: "WARNING",
          is_read: false,
          created_at: new Date(),
        },
        {
          id: "n3",
          title: "Enrolled",
          message: "Done",
          type: "INFO",
          is_read: false,
          created_at: new Date(),
        },
        {
          id: "n4",
          title: "Failed",
          message: "Error",
          type: "ERROR",
          is_read: false,
          created_at: new Date(),
        },
      ],
      rowCount: 4,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    const types = res.body.notifications.map((n) => n.type);
    expect(types).toEqual(["SUCCESS", "WARNING", "INFO", "ERROR"]);
  });
});

describe("NOTIFICATION RESPONSE SHAPE", () => {
  it("should not leak internal fields in notification response", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "notif-1",
          title: "Test",
          message: "Msg",
          type: "INFO",
          is_read: false,
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await notificationController.getMyNotifications(req, res);

    const notification = res.body.notifications[0];

    const allowedKeys = [
      "id",
      "title",
      "message",
      "type",
      "is_read",
      "created_at",
    ];
    const actualKeys = Object.keys(notification);
    expect(actualKeys.every((k) => allowedKeys.includes(k))).toBe(true);
  });

  it("should return success field in mark-all and clear-all responses", async () => {
    vi.mocked(isTemporaryErpLearnerAuth).mockReturnValue(false);

    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "user-1" } });
    const res1 = createMockRes();
    const res2 = createMockRes();

    await notificationController.markAllNotificationsAsRead(req, res1);
    await notificationController.clearAllNotifications(req, res2);

    expect(res1.body).toHaveProperty("success", true);
    expect(res1.body).toHaveProperty("updatedCount");
    expect(res2.body).toHaveProperty("success", true);
    expect(res2.body).toHaveProperty("deletedCount");
  });
});
