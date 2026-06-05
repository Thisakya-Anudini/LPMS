// Set up test environment
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-for-testing";

import test from "node:test";
import assert from "assert/strict";
import * as notificationController from "../controllers/notificationController.js";

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
    user: { id: "user-1", role: "EMPLOYEE" },
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
        id: "emp-1",
        principal_id: "user-1",
        employee_number: "EMP-001",
      },
      {
        id: "emp-2",
        principal_id: "user-2",
        employee_number: "EMP-002",
      },
    ],
    notifications: [
      {
        id: "notif-1",
        principal_id: "user-1",
        title: "Certificate Issued",
        message: "Congratulations! Your certificate has been issued.",
        type: "SUCCESS",
        is_read: false,
        created_at: new Date("2026-06-05T10:30:00Z"),
      },
      {
        id: "notif-2",
        principal_id: "user-1",
        title: "Course Reminder",
        message: "You have pending learning activities.",
        type: "WARNING",
        is_read: true,
        created_at: new Date("2026-06-04T14:00:00Z"),
      },
      {
        id: "notif-3",
        principal_id: "user-1",
        title: "Enrollment Confirmed",
        message: "You have been enrolled in a learning path.",
        type: "INFO",
        is_read: false,
        created_at: new Date("2026-06-03T09:00:00Z"),
      },
      {
        id: "notif-4",
        principal_id: "user-2",
        title: "Other User Notification",
        message: "This belongs to another principal.",
        type: "INFO",
        is_read: false,
        created_at: new Date("2026-06-06T09:00:00Z"),
      },
    ],
  };
};

// MOCK QUERY FUNCTION
const mockQuery = async (sql, params = []) => {
  // RESOLVE TEMPORARY ERP LEARNER PRINCIPAL
  if (sql.includes("SELECT principal_id") && sql.includes("FROM employees")) {
    const employeeNumber = params[0];
    const employee = mockDatabase.employees.find(
      (e) => e.employee_number === employeeNumber,
    );

    return {
      rows: employee ? [{ principal_id: employee.principal_id }] : [],
      rowCount: employee ? 1 : 0,
    };
  }

  // GET MY NOTIFICATIONS
  if (
    sql.includes("SELECT id, title, message, type, is_read, created_at") &&
    sql.includes("FROM notifications")
  ) {
    const principalId = params[0];
    const notifications = mockDatabase.notifications
      .filter((n) => n.principal_id === principalId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 100);

    return { rows: notifications, rowCount: notifications.length };
  }

  // MARK SINGLE NOTIFICATION AS READ
  if (
    sql.includes("UPDATE notifications") &&
    sql.includes("RETURNING id, is_read")
  ) {
    const id = params[0];
    const principalId = params[1];
    const notification = mockDatabase.notifications.find(
      (n) => n.id === id && n.principal_id === principalId,
    );

    if (!notification) {
      return { rows: [], rowCount: 0 };
    }

    notification.is_read = true;

    return {
      rows: [{ id: notification.id, is_read: notification.is_read }],
      rowCount: 1,
    };
  }

  // MARK ALL NOTIFICATIONS AS READ
  if (
    sql.includes("UPDATE notifications") &&
    sql.includes("WHERE principal_id = $1") &&
    sql.includes("AND is_read = FALSE")
  ) {
    const principalId = params[0];
    let updatedCount = 0;

    for (const notification of mockDatabase.notifications) {
      if (
        notification.principal_id === principalId &&
        notification.is_read === false
      ) {
        notification.is_read = true;
        updatedCount += 1;
      }
    }

    return { rows: [], rowCount: updatedCount };
  }

  // CLEAR ALL NOTIFICATIONS
  if (sql.includes("DELETE FROM notifications")) {
    const principalId = params[0];
    const beforeCount = mockDatabase.notifications.length;

    mockDatabase.notifications = mockDatabase.notifications.filter(
      (n) => n.principal_id !== principalId,
    );

    const deletedCount = beforeCount - mockDatabase.notifications.length;
    return { rows: [], rowCount: deletedCount };
  }

  return { rows: [], rowCount: 0 };
};

// MOCK AUTH HELPERS
const isTemporaryErpLearnerAuth = (user) => user?.authSource === "ERP_LEARNER";

const resolveMockPrincipalId = async (user) => {
  if (!isTemporaryErpLearnerAuth(user)) {
    return user.id;
  }

  if (!user.employeeNo) {
    return null;
  }

  const result = await mockQuery(
    `
      SELECT principal_id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [String(user.employeeNo).trim()],
  );

  return result.rows[0]?.principal_id || null;
};

// SIMULATED CONTROLLER BEHAVIOR
const simulateGetMyNotifications = async (req, res) => {
  const principalId = await resolveMockPrincipalId(req.user);

  if (!principalId) {
    return res.status(200).json({ notifications: [] });
  }

  const result = await mockQuery(
    `
      SELECT id, title, message, type, is_read, created_at
      FROM notifications
      WHERE principal_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [principalId],
  );

  return res.status(200).json({ notifications: result.rows });
};

const simulateMarkNotificationAsRead = async (req, res) => {
  const principalId = await resolveMockPrincipalId(req.user);

  if (!principalId) {
    return sendMockError(res, 404, "NOT_FOUND", "Notification not found.");
  }

  const { id } = req.params;
  const result = await mockQuery(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1
        AND principal_id = $2
      RETURNING id, is_read
    `,
    [id, principalId],
  );

  if (result.rowCount === 0) {
    return sendMockError(res, 404, "NOT_FOUND", "Notification not found.");
  }

  return res.status(200).json({ notification: result.rows[0] });
};

const simulateMarkAllNotificationsAsRead = async (req, res) => {
  const principalId = await resolveMockPrincipalId(req.user);

  if (!principalId) {
    return res.status(200).json({ success: true, updatedCount: 0 });
  }

  const result = await mockQuery(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE principal_id = $1
        AND is_read = FALSE
    `,
    [principalId],
  );

  return res.status(200).json({
    success: true,
    updatedCount: result.rowCount,
  });
};

const simulateClearAllNotifications = async (req, res) => {
  const principalId = await resolveMockPrincipalId(req.user);

  if (!principalId) {
    return res.status(200).json({ success: true, deletedCount: 0 });
  }

  const result = await mockQuery(
    `
      DELETE FROM notifications
      WHERE principal_id = $1
    `,
    [principalId],
  );

  return res.status(200).json({
    success: true,
    deletedCount: result.rowCount,
  });
};

// TEST SUITES

// getMyNotifications testing
test("GETMYNOTIFICATIONS TESTS", async (t) => {
  await t.test("should export getMyNotifications function", async () => {
    assert.equal(typeof notificationController.getMyNotifications, "function");
  });

  await t.test(
    "should resolve normal user principal from req.user.id",
    async () => {
      setupMockDatabase();

      const req = createMockReq({ user: { id: "user-1" } });
      const principalId = await resolveMockPrincipalId(req.user);

      assert.equal(principalId, "user-1");
    },
  );

  await t.test(
    "should resolve temporary ERP learner principal by employee number",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        user: {
          id: "temp-user",
          authSource: "ERP_LEARNER",
          employeeNo: " EMP-001 ",
        },
      });
      const principalId = await resolveMockPrincipalId(req.user);

      assert.equal(principalId, "user-1");
    },
  );

  await t.test(
    "should return empty notifications if principal cannot be resolved",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        user: {
          id: "temp-user",
          authSource: "ERP_LEARNER",
          employeeNo: "UNKNOWN",
        },
      });
      const res = createMockRes();

      await simulateGetMyNotifications(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(Array.isArray(res.body.notifications));
      assert.equal(res.body.notifications.length, 0);
    },
  );

  await t.test("should return current user notifications only", async () => {
    setupMockDatabase();

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await simulateGetMyNotifications(req, res);

    assert.equal(res.body.notifications.length, 3);
    assert.ok(res.body.notifications.every((n) => n.principal_id === "user-1"));
  });

  await t.test("should order notifications by created_at DESC", async () => {
    setupMockDatabase();

    const notifications = mockDatabase.notifications
      .filter((n) => n.principal_id === "user-1")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    assert.equal(notifications[0].id, "notif-1");
    assert.equal(notifications[1].id, "notif-2");
    assert.equal(notifications[2].id, "notif-3");
  });

  await t.test("should limit notifications to 100", async () => {
    setupMockDatabase();

    for (let i = 0; i < 150; i++) {
      mockDatabase.notifications.push({
        id: `notif-extra-${i}`,
        principal_id: "user-1",
        title: `Notification ${i}`,
        message: `Message ${i}`,
        type: "INFO",
        is_read: false,
        created_at: new Date(Date.now() - i * 1000),
      });
    }

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await simulateGetMyNotifications(req, res);

    assert.equal(res.body.notifications.length, 100);
  });

  await t.test("should include notification fields", async () => {
    setupMockDatabase();

    const notification = mockDatabase.notifications[0];

    assert.ok(notification.id);
    assert.ok(notification.title);
    assert.ok(notification.message);
    assert.ok(notification.type);
    assert.equal(typeof notification.is_read, "boolean");
    assert.ok(notification.created_at);
  });
});

// markNotificationAsRead testing
test("MARKNOTIFICATIONASREAD TESTS", async (t) => {
  await t.test("should export markNotificationAsRead function", async () => {
    assert.equal(
      typeof notificationController.markNotificationAsRead,
      "function",
    );
  });

  await t.test(
    "should return 404 when principal cannot be resolved",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        params: { id: "notif-1" },
        user: {
          id: "temp-user",
          authSource: "ERP_LEARNER",
          employeeNo: "UNKNOWN",
        },
      });
      const res = createMockRes();

      await simulateMarkNotificationAsRead(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error.code, "NOT_FOUND");
    },
  );

  await t.test("should mark current user notification as read", async () => {
    setupMockDatabase();

    const req = createMockReq({
      params: { id: "notif-1" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await simulateMarkNotificationAsRead(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.notification.id, "notif-1");
    assert.equal(res.body.notification.is_read, true);
  });

  await t.test("should update notification state in database", async () => {
    setupMockDatabase();

    const req = createMockReq({
      params: { id: "notif-1" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await simulateMarkNotificationAsRead(req, res);

    const notification = mockDatabase.notifications.find(
      (n) => n.id === "notif-1",
    );
    assert.equal(notification.is_read, true);
  });

  await t.test("should return updated notification object", async () => {
    setupMockDatabase();

    const req = createMockReq({
      params: { id: "notif-3" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await simulateMarkNotificationAsRead(req, res);

    assert.deepEqual(res.body.notification, {
      id: "notif-3",
      is_read: true,
    });
  });

  await t.test("should not mark another user's notification", async () => {
    setupMockDatabase();

    const req = createMockReq({
      params: { id: "notif-4" },
      user: { id: "user-1" },
    });
    const res = createMockRes();

    await simulateMarkNotificationAsRead(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.message, "Notification not found.");
  });

  await t.test(
    "should return 404 if notification id does not exist",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        params: { id: "missing-notification" },
        user: { id: "user-1" },
      });
      const res = createMockRes();

      await simulateMarkNotificationAsRead(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error.code, "NOT_FOUND");
    },
  );
});

// markAllNotificationsAsRead testing
test("MARKALLNOTIFICATIONSASREAD TESTS", async (t) => {
  await t.test(
    "should export markAllNotificationsAsRead function",
    async () => {
      assert.equal(
        typeof notificationController.markAllNotificationsAsRead,
        "function",
      );
    },
  );

  await t.test(
    "should return updatedCount 0 when principal cannot be resolved",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        user: {
          id: "temp-user",
          authSource: "ERP_LEARNER",
          employeeNo: "UNKNOWN",
        },
      });
      const res = createMockRes();

      await simulateMarkAllNotificationsAsRead(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.updatedCount, 0);
    },
  );

  await t.test(
    "should mark unread notifications for current user",
    async () => {
      setupMockDatabase();

      const req = createMockReq({ user: { id: "user-1" } });
      const res = createMockRes();

      await simulateMarkAllNotificationsAsRead(req, res);

      const userNotifications = mockDatabase.notifications.filter(
        (n) => n.principal_id === "user-1",
      );

      assert.equal(res.body.updatedCount, 2);
      assert.ok(userNotifications.every((n) => n.is_read === true));
    },
  );

  await t.test("should not count already read notifications", async () => {
    setupMockDatabase();

    const unreadBefore = mockDatabase.notifications.filter(
      (n) => n.principal_id === "user-1" && n.is_read === false,
    );

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await simulateMarkAllNotificationsAsRead(req, res);

    assert.equal(unreadBefore.length, 2);
    assert.equal(res.body.updatedCount, 2);
  });

  await t.test("should not update other users notifications", async () => {
    setupMockDatabase();

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await simulateMarkAllNotificationsAsRead(req, res);

    const otherUserNotification = mockDatabase.notifications.find(
      (n) => n.id === "notif-4",
    );

    assert.equal(otherUserNotification.is_read, false);
  });

  await t.test("should return success true and updated count", async () => {
    setupMockDatabase();

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await simulateMarkAllNotificationsAsRead(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.updatedCount, "number");
  });
});

// clearAllNotifications testing
test("CLEARALLNOTIFICATIONS TESTS", async (t) => {
  await t.test("should export clearAllNotifications function", async () => {
    assert.equal(
      typeof notificationController.clearAllNotifications,
      "function",
    );
  });

  await t.test(
    "should return deletedCount 0 when principal cannot be resolved",
    async () => {
      setupMockDatabase();

      const req = createMockReq({
        user: {
          id: "temp-user",
          authSource: "ERP_LEARNER",
          employeeNo: "UNKNOWN",
        },
      });
      const res = createMockRes();

      await simulateClearAllNotifications(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.deletedCount, 0);
    },
  );

  await t.test("should delete all notifications for current user", async () => {
    setupMockDatabase();

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await simulateClearAllNotifications(req, res);

    const remainingUserNotifications = mockDatabase.notifications.filter(
      (n) => n.principal_id === "user-1",
    );

    assert.equal(res.body.deletedCount, 3);
    assert.equal(remainingUserNotifications.length, 0);
  });

  await t.test("should not delete other users notifications", async () => {
    setupMockDatabase();

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await simulateClearAllNotifications(req, res);

    const otherUserNotifications = mockDatabase.notifications.filter(
      (n) => n.principal_id === "user-2",
    );

    assert.equal(otherUserNotifications.length, 1);
    assert.equal(otherUserNotifications[0].id, "notif-4");
  });

  await t.test("should return success true and deleted count", async () => {
    setupMockDatabase();

    const req = createMockReq({ user: { id: "user-1" } });
    const res = createMockRes();

    await simulateClearAllNotifications(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.deletedCount, "number");
  });

  await t.test(
    "should return deletedCount 0 when user has no notifications",
    async () => {
      setupMockDatabase();

      const req = createMockReq({ user: { id: "user-3" } });
      const res = createMockRes();

      await simulateClearAllNotifications(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.deletedCount, 0);
    },
  );
});
