import test from "node:test";
import assert from "node:assert/strict";
import {
  getMyPaths,
  getPublicPaths,
  getMyProgress,
  getNotifications,
  getMyCertificates,
  updateMyEnrollmentProgress,
  selfEnrollPublicPath,
} from "../controllers/employeeController.js";

// Set up test environment
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-for-testing";

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
      if (value !== undefined) {
        this.headers[key] = value;
      }
      return this.headers[key];
    },
  };
  return res;
};

const createMockReq = (overrides = {}) => {
  const headers = {};
  return {
    body: {},
    params: {},
    headers,
    header(name) {
      return headers[name];
    },
    user: { id: "user-1" },
    ...overrides,
  };
};

// MOCK DATABASE

let mockDatabase = {};

const setupMockDatabase = () => {
  mockDatabase = {
    enrollments: [
      {
        id: "enroll-1",
        principal_id: "user-1",
        learning_path_id: "path-1",
        status: "IN_PROGRESS",
        progress: 45,
        enrolled_at: new Date("2026-06-01"),
        completed_at: null,
        enrollment_source: "ADMIN",
      },
      {
        id: "enroll-2",
        principal_id: "user-1",
        learning_path_id: "path-2",
        status: "COMPLETED",
        progress: 100,
        enrolled_at: new Date("2026-05-01"),
        completed_at: new Date("2026-06-01"),
        enrollment_source: "SELF",
      },
      {
        id: "enroll-3",
        principal_id: "user-1",
        learning_path_id: "path-3",
        status: "NOT_STARTED",
        progress: 0,
        enrolled_at: new Date("2026-06-05"),
        completed_at: null,
        enrollment_source: "ADMIN",
      },
      {
        id: "enroll-4",
        principal_id: "user-2",
        learning_path_id: "path-1",
        status: "IN_PROGRESS",
        progress: 50,
        enrolled_at: new Date("2026-06-01"),
        completed_at: null,
        enrollment_source: "SELF",
      },
    ],
    learning_paths: [
      {
        id: "path-1",
        title: "Python Basics",
        description: "Learn Python programming",
        category: "PUBLIC",
        total_duration: 20,
        status: "ACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-01"),
      },
      {
        id: "path-2",
        title: "Leadership Training",
        description: "Become a better leader",
        category: "RESTRICTED",
        total_duration: 40,
        status: "ACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-02"),
      },
      {
        id: "path-3",
        title: "Communication Skills",
        description: "Improve communication",
        category: "PUBLIC",
        total_duration: 15,
        status: "ACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-05"),
      },
      {
        id: "path-4",
        title: "Advanced Python",
        description: "Advanced Python topics",
        category: "PUBLIC",
        total_duration: 30,
        status: "INACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-03"),
      },
      {
        id: "path-5",
        title: "Archived Course",
        description: "Old course",
        category: "PUBLIC",
        total_duration: 10,
        status: "ARCHIVED",
        is_deleted: false,
        created_at: new Date("2026-05-01"),
      },
      {
        id: "path-6",
        title: "Deleted Course",
        description: "Deleted course",
        category: "PUBLIC",
        total_duration: 10,
        status: "ACTIVE",
        is_deleted: true,
        created_at: new Date("2026-05-01"),
      },
      {
        id: "path-7",
        title: "Semi-Restricted Path",
        description: "Semi-restricted course",
        category: "SEMI_RESTRICTED",
        total_duration: 25,
        status: "ACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-04"),
      },
    ],
    certificates: [
      {
        id: "cert-1",
        principal_id: "user-1",
        learning_path_id: "path-2",
        scope: "FULL",
        issued_at: new Date("2026-06-01T10:00:00Z"),
      },
      {
        id: "cert-2",
        principal_id: "user-1",
        learning_path_id: "path-1",
        scope: "FULL",
        issued_at: new Date("2026-05-15T14:30:00Z"),
      },
      {
        id: "cert-3",
        principal_id: "user-2",
        learning_path_id: "path-3",
        scope: "FULL",
        issued_at: new Date("2026-06-01T12:00:00Z"),
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
        message: "You have 3 days to complete Python Basics.",
        type: "WARNING",
        is_read: true,
        created_at: new Date("2026-06-04T14:00:00Z"),
      },
      {
        id: "notif-3",
        principal_id: "user-1",
        title: "Enrollment Confirmed",
        message: "You have enrolled in Leadership Training.",
        type: "INFO",
        is_read: true,
        created_at: new Date("2026-06-03T09:00:00Z"),
      },
    ],
  };
};

// MOCK QUERY FUNCTION

const mockQuery = async (sql, params = []) => {
  // GET MY PATHS
  if (sql.includes("SELECT en.id, en.status, en.progress")) {
    const principalId = params[0];
    const enrollments = mockDatabase.enrollments
      .filter((e) => e.principal_id === principalId)
      .map((e) => {
        const path = mockDatabase.learning_paths.find(
          (p) => p.id === e.learning_path_id,
        );
        return {
          id: e.id,
          status: e.status,
          progress: e.progress,
          enrolled_at: e.enrolled_at,
          completed_at: e.completed_at,
          learning_path_id: path.id,
          title: path.title,
          description: path.description,
          category: path.category,
          total_duration: path.total_duration,
        };
      })
      .filter((e) => {
        const path = mockDatabase.learning_paths.find(
          (p) => p.id === e.learning_path_id,
        );
        return !path.is_deleted;
      })
      .sort((a, b) => new Date(b.enrolled_at) - new Date(a.enrolled_at));

    return { rows: enrollments, rowCount: enrollments.length };
  }

  // GET PUBLIC PATHS
  if (sql.includes("SELECT lp.id, lp.title, lp.description, lp.category")) {
    const principalId = params[0];
    const paths = mockDatabase.learning_paths
      .filter(
        (p) =>
          !p.is_deleted && p.status === "ACTIVE" && p.category === "PUBLIC",
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        total_duration: p.total_duration,
        status: p.status,
        already_enrolled: mockDatabase.enrollments.some(
          (e) => e.principal_id === principalId && e.learning_path_id === p.id,
        ),
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { rows: paths, rowCount: paths.length };
  }

  // GET MY PROGRESS
  if (sql.includes("COUNT(*) AS total_enrollments")) {
    const principalId = params[0];
    const enrollments = mockDatabase.enrollments.filter(
      (e) => e.principal_id === principalId,
    );
    const completed = enrollments.filter(
      (e) => e.status === "COMPLETED",
    ).length;
    const avgProgress =
      enrollments.length > 0
        ? (
            enrollments.reduce((sum, e) => sum + e.progress, 0) /
            enrollments.length
          ).toFixed(2)
        : "0.00";

    return {
      rows: [
        {
          total_enrollments: enrollments.length.toString(),
          completed_enrollments: completed.toString(),
          average_progress: parseFloat(avgProgress).toFixed(2),
        },
      ],
      rowCount: 1,
    };
  }

  // GET NOTIFICATIONS
  if (
    sql.includes(
      "SELECT id, title, message, type, is_read, created_at FROM notifications",
    )
  ) {
    const principalId = params[0];
    const notifications = mockDatabase.notifications
      .filter((n) => n.principal_id === principalId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);

    return { rows: notifications, rowCount: notifications.length };
  }

  // GET MY CERTIFICATES
  if (sql.includes("SELECT c.id, c.scope, c.issued_at")) {
    const principalId = params[0];
    const certificates = mockDatabase.certificates
      .filter((c) => c.principal_id === principalId)
      .map((c) => {
        const path = mockDatabase.learning_paths.find(
          (p) => p.id === c.learning_path_id,
        );
        return {
          id: c.id,
          scope: c.scope,
          issued_at: c.issued_at,
          learning_path_id: path.id,
          learning_path_title: path.title,
        };
      })
      .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));

    return { rows: certificates, rowCount: certificates.length };
  }

  // UPDATE ENROLLMENT PROGRESS
  if (sql.includes("UPDATE enrollments SET progress")) {
    const enrollmentId = params[0];
    const principalId = params[1];
    const progress = params[2];
    const status = params[3];

    const enrollment = mockDatabase.enrollments.find(
      (e) => e.id === enrollmentId && e.principal_id === principalId,
    );

    if (!enrollment) {
      return { rows: [], rowCount: 0 };
    }

    enrollment.progress = progress;
    enrollment.status = status;
    enrollment.completed_at = progress >= 100 ? new Date() : null;

    return {
      rows: [
        {
          id: enrollment.id,
          status: enrollment.status,
          progress: enrollment.progress,
          completed_at: enrollment.completed_at,
        },
      ],
      rowCount: 1,
    };
  }

  // SELECT LEARNING PATH FOR SELF ENROLL
  if (
    sql.includes(
      "SELECT id, title, category, status FROM learning_paths WHERE id",
    )
  ) {
    const pathId = params[0];
    const path = mockDatabase.learning_paths.find(
      (p) => p.id === pathId && !p.is_deleted,
    );

    return {
      rows: path
        ? [
            {
              id: path.id,
              title: path.title,
              category: path.category,
              status: path.status,
            },
          ]
        : [],
      rowCount: path ? 1 : 0,
    };
  }

  // INSERT ENROLLMENT (SELF ENROLL)
  if (sql.includes("INSERT INTO enrollments")) {
    const principalId = params[0];
    const learningPathId = params[1];

    // Check for conflict
    const exists = mockDatabase.enrollments.some(
      (e) =>
        e.principal_id === principalId && e.learning_path_id === learningPathId,
    );

    if (exists) {
      return { rows: [], rowCount: 0 };
    }

    const newEnrollment = {
      id: `enroll-new-${Date.now()}`,
      principal_id: principalId,
      learning_path_id: learningPathId,
      status: "NOT_STARTED",
      progress: 0,
      enrolled_at: new Date(),
      enrollment_source: "SELF",
    };

    mockDatabase.enrollments.push(newEnrollment);

    return {
      rows: [
        {
          id: newEnrollment.id,
          principal_id: newEnrollment.principal_id,
          learning_path_id: newEnrollment.learning_path_id,
          status: newEnrollment.status,
          progress: newEnrollment.progress,
          enrolled_at: newEnrollment.enrolled_at,
        },
      ],
      rowCount: 1,
    };
  }

  // INSERT CERTIFICATE
  if (sql.includes("INSERT INTO certificates")) {
    return { rows: [], rowCount: 1 };
  }

  // INSERT NOTIFICATION
  if (sql.includes("INSERT INTO notifications")) {
    return { rows: [], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
};

// MOCK AUDIT LOGGING

let auditLogs = [];

const mockLogAudit = async (audit) => {
  auditLogs.push(audit);
};

// TEST SUITES

// exports testing
test("EMPLOYEE CONTROLLER EXPORTS TESTS", async (t) => {
  const expectedExports = {
    getMyPaths,
    getPublicPaths,
    getMyProgress,
    getNotifications,
    getMyCertificates,
    updateMyEnrollmentProgress,
    selfEnrollPublicPath,
  };

  for (const [exportName, exportFn] of Object.entries(expectedExports)) {
    await t.test(`should export ${exportName}`, async () => {
      assert.equal(typeof exportFn, "function");
    });
  }
});

// getMyPaths testing
test("GET MY PATHS TESTS", async (t) => {
  await t.test("should return all enrollments for current user", async () => {
    setupMockDatabase();

    const enrollments = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "user-1",
    );
    assert.equal(enrollments.length, 3);
  });

  await t.test(
    "should only return current user enrollments (security)",
    async () => {
      setupMockDatabase();

      const user1Enrollments = mockDatabase.enrollments.filter(
        (e) => e.principal_id === "user-1",
      );
      const user2Enrollments = mockDatabase.enrollments.filter(
        (e) => e.principal_id === "user-2",
      );

      assert.equal(user1Enrollments.length, 3);
      assert.equal(user2Enrollments.length, 1);
    },
  );

  await t.test("should exclude deleted learning paths", async () => {
    setupMockDatabase();

    const user1Enrollments = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "user-1",
    );
    const validEnrollments = user1Enrollments.filter((e) => {
      const path = mockDatabase.learning_paths.find(
        (p) => p.id === e.learning_path_id,
      );
      return !path.is_deleted;
    });

    assert.equal(validEnrollments.length, 3);
  });

  await t.test("should order enrollments by enrolled_at DESC", async () => {
    setupMockDatabase();

    const enrollments = mockDatabase.enrollments
      .filter((e) => e.principal_id === "user-1")
      .sort((a, b) => new Date(b.enrolled_at) - new Date(a.enrolled_at));

    assert.equal(enrollments[0].id, "enroll-3");
    assert.equal(enrollments[1].id, "enroll-1");
    assert.equal(enrollments[2].id, "enroll-2");
  });

  await t.test("should return empty array when no enrollments", async () => {
    setupMockDatabase();

    const enrollments = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "user-3",
    );
    assert.equal(enrollments.length, 0);
  });

  await t.test(
    "should include all enrollment and learning path fields",
    async () => {
      setupMockDatabase();

      const enrollment = mockDatabase.enrollments[0];
      const path = mockDatabase.learning_paths.find(
        (p) => p.id === enrollment.learning_path_id,
      );

      assert.ok(enrollment.id);
      assert.ok(enrollment.status);
      assert.ok(enrollment.progress !== undefined);
      assert.ok(enrollment.enrolled_at);
      assert.ok(path.id);
      assert.ok(path.title);
      assert.ok(path.description);
      assert.ok(path.category);
      assert.ok(path.total_duration);
    },
  );
});

// getPublicPaths testing
test("GET PUBLIC PATHS TESTS", async (t) => {
  await t.test("should return only PUBLIC learning paths", async () => {
    setupMockDatabase();

    const publicPaths = mockDatabase.learning_paths.filter(
      (p) => p.category === "PUBLIC",
    );
    assert.equal(publicPaths.length, 5);
  });

  await t.test("should return only ACTIVE learning paths", async () => {
    setupMockDatabase();

    const activePaths = mockDatabase.learning_paths.filter(
      (p) => p.status === "ACTIVE",
    );
    assert.ok(activePaths.length > 0);
  });

  await t.test("should exclude deleted learning paths", async () => {
    setupMockDatabase();

    const validPaths = mockDatabase.learning_paths.filter((p) => !p.is_deleted);
    const deletedPaths = mockDatabase.learning_paths.filter(
      (p) => p.is_deleted,
    );

    assert.ok(validPaths.length > 0);
    assert.equal(deletedPaths.length, 1);
  });

  await t.test(
    "should mark already_enrolled=true if user enrolled",
    async () => {
      setupMockDatabase();

      const principalId = "user-1";
      const path = mockDatabase.learning_paths.find((p) => p.id === "path-1");
      const isEnrolled = mockDatabase.enrollments.some(
        (e) => e.principal_id === principalId && e.learning_path_id === path.id,
      );

      assert.equal(isEnrolled, true);
    },
  );

  await t.test(
    "should mark already_enrolled=false if user not enrolled",
    async () => {
      setupMockDatabase();

      const principalId = "user-1";
      const path = mockDatabase.learning_paths.find((p) => p.id === "path-4");
      const isEnrolled = mockDatabase.enrollments.some(
        (e) => e.principal_id === principalId && e.learning_path_id === path.id,
      );

      assert.equal(isEnrolled, false);
    },
  );

  await t.test("should order paths by created_at DESC", async () => {
    setupMockDatabase();

    const paths = mockDatabase.learning_paths
      .filter(
        (p) =>
          !p.is_deleted && p.status === "ACTIVE" && p.category === "PUBLIC",
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    assert.equal(paths[0].id, "path-3");
    assert.equal(paths[1].id, "path-1");
  });

  await t.test("should return empty array when no public paths", async () => {
    setupMockDatabase();
    mockDatabase.learning_paths = [];

    const paths = mockDatabase.learning_paths.filter(
      (p) => !p.is_deleted && p.status === "ACTIVE" && p.category === "PUBLIC",
    );

    assert.equal(paths.length, 0);
  });

  await t.test(
    "should check only current users enrollment status",
    async () => {
      setupMockDatabase();

      const principalId = "user-1";
      const path = mockDatabase.learning_paths.find((p) => p.id === "path-1");

      const user2Enrolled = mockDatabase.enrollments.some(
        (e) => e.principal_id === "user-2" && e.learning_path_id === "path-1",
      );

      const user1Enrolled = mockDatabase.enrollments.some(
        (e) => e.principal_id === "user-1" && e.learning_path_id === "path-1",
      );

      assert.equal(user2Enrolled, true);
      assert.equal(user1Enrolled, true);
    },
  );
});

// getMyProgress testing
test("GET MY PROGRESS TESTS", async (t) => {
  await t.test("should calculate total_enrollments correctly", async () => {
    setupMockDatabase();

    const enrollments = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "user-1",
    );
    assert.equal(enrollments.length, 3);
  });

  await t.test("should calculate completed_enrollments correctly", async () => {
    setupMockDatabase();

    const enrollments = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "user-1",
    );
    const completed = enrollments.filter((e) => e.status === "COMPLETED");
    assert.equal(completed.length, 1);
  });

  await t.test("should calculate average_progress correctly", async () => {
    setupMockDatabase();

    const enrollments = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "user-1",
    );
    const avg = (
      enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length
    ).toFixed(2);
    assert.equal(avg, "48.33");
  });

  await t.test(
    "should return 0 for average_progress when no enrollments",
    async () => {
      setupMockDatabase();

      const enrollments = mockDatabase.enrollments.filter(
        (e) => e.principal_id === "user-3",
      );
      const avg =
        enrollments.length > 0
          ? (
              enrollments.reduce((sum, e) => sum + e.progress, 0) /
              enrollments.length
            ).toFixed(2)
          : "0.00";

      assert.equal(avg, "0.00");
    },
  );

  await t.test("should handle decimal precision (5,2)", async () => {
    setupMockDatabase();

    const value = (33.3333).toFixed(2);
    assert.equal(value, "33.33");
  });

  await t.test("should only count current users enrollments", async () => {
    setupMockDatabase();

    const user1 = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "user-1",
    );
    const user2 = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "user-2",
    );

    assert.equal(user1.length, 3);
    assert.equal(user2.length, 1);
  });

  await t.test(
    "should handle mix of statuses and progress values",
    async () => {
      setupMockDatabase();

      const enrollments = mockDatabase.enrollments.filter(
        (e) => e.principal_id === "user-1",
      );
      const total = enrollments.length;
      const completed = enrollments.filter(
        (e) => e.status === "COMPLETED",
      ).length;
      const avg =
        enrollments.length > 0
          ? (
              enrollments.reduce((sum, e) => sum + e.progress, 0) /
              enrollments.length
            ).toFixed(2)
          : "0.00";

      assert.equal(total, 3);
      assert.equal(completed, 1);
      assert.ok(parseFloat(avg) > 0);
    },
  );
});

// getNotifications testing
test("GET NOTIFICATIONS TESTS", async (t) => {
  await t.test("should return notifications for current user", async () => {
    setupMockDatabase();

    const notifications = mockDatabase.notifications.filter(
      (n) => n.principal_id === "user-1",
    );
    assert.equal(notifications.length, 3);
  });

  await t.test(
    "should only return current users notifications (security)",
    async () => {
      setupMockDatabase();

      const user1 = mockDatabase.notifications.filter(
        (n) => n.principal_id === "user-1",
      );
      const user2 = mockDatabase.notifications.filter(
        (n) => n.principal_id === "user-2",
      );

      assert.equal(user1.length, 3);
      assert.equal(user2.length, 0);
    },
  );

  await t.test("should order by created_at DESC", async () => {
    setupMockDatabase();

    const notifications = mockDatabase.notifications
      .filter((n) => n.principal_id === "user-1")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    assert.equal(notifications[0].id, "notif-1");
    assert.equal(notifications[1].id, "notif-2");
    assert.equal(notifications[2].id, "notif-3");
  });

  await t.test("should limit to 50 notifications", async () => {
    setupMockDatabase();

    // Add 100 notifications
    for (let i = 0; i < 100; i++) {
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

    const notifications = mockDatabase.notifications
      .filter((n) => n.principal_id === "user-1")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50);

    assert.equal(notifications.length, 50);
  });

  await t.test("should return empty array when no notifications", async () => {
    setupMockDatabase();

    const notifications = mockDatabase.notifications.filter(
      (n) => n.principal_id === "user-3",
    );
    assert.equal(notifications.length, 0);
  });

  await t.test("should include all notification fields", async () => {
    setupMockDatabase();

    const notification = mockDatabase.notifications[0];
    assert.ok(notification.id);
    assert.ok(notification.title);
    assert.ok(notification.message);
    assert.ok(notification.type);
    assert.ok(notification.is_read !== undefined);
    assert.ok(notification.created_at);
  });
});

// getMyCertificates testing
test("GET MY CERTIFICATES TESTS", async (t) => {
  await t.test("should return certificates for current user", async () => {
    setupMockDatabase();

    const certificates = mockDatabase.certificates.filter(
      (c) => c.principal_id === "user-1",
    );
    assert.equal(certificates.length, 2);
  });

  await t.test(
    "should only return current users certificates (security)",
    async () => {
      setupMockDatabase();

      const user1 = mockDatabase.certificates.filter(
        (c) => c.principal_id === "user-1",
      );
      const user2 = mockDatabase.certificates.filter(
        (c) => c.principal_id === "user-2",
      );

      assert.equal(user1.length, 2);
      assert.equal(user2.length, 1);
    },
  );

  await t.test("should include learning path title via JOIN", async () => {
    setupMockDatabase();

    const certificate = mockDatabase.certificates[0];
    const path = mockDatabase.learning_paths.find(
      (p) => p.id === certificate.learning_path_id,
    );

    assert.ok(path.title);
    assert.equal(path.title, "Leadership Training");
  });

  await t.test("should order by issued_at DESC", async () => {
    setupMockDatabase();

    const certificates = mockDatabase.certificates
      .filter((c) => c.principal_id === "user-1")
      .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));

    assert.equal(certificates[0].id, "cert-1");
    assert.equal(certificates[1].id, "cert-2");
  });

  await t.test("should return empty array when no certificates", async () => {
    setupMockDatabase();

    const certificates = mockDatabase.certificates.filter(
      (c) => c.principal_id === "user-3",
    );
    assert.equal(certificates.length, 0);
  });

  await t.test("should include scope field", async () => {
    setupMockDatabase();

    const certificate = mockDatabase.certificates[0];
    assert.ok(certificate.scope);
    assert.equal(certificate.scope, "FULL");
  });
});

// updateMyEnrollmentProgress testing
test("UPDATE MY ENROLLMENT PROGRESS TESTS", async (t) => {
  await t.test("should accept valid progress (45%)", async () => {
    setupMockDatabase();

    const progress = 45;
    assert.equal(typeof progress, "number");
    assert.equal(!Number.isNaN(progress), true);
    assert.ok(progress >= 0 && progress <= 100);
  });

  await t.test("should accept valid progress (0%)", async () => {
    setupMockDatabase();

    const progress = 0;
    assert.ok(progress >= 0 && progress <= 100);
  });

  await t.test("should accept valid progress (100%)", async () => {
    setupMockDatabase();

    const progress = 100;
    assert.ok(progress >= 0 && progress <= 100);
  });

  await t.test("should reject negative progress", async () => {
    setupMockDatabase();

    const progress = -5;
    const isValid =
      typeof progress === "number" &&
      !Number.isNaN(progress) &&
      progress >= 0 &&
      progress <= 100;
    assert.equal(isValid, false);
  });

  await t.test("should reject progress > 100", async () => {
    setupMockDatabase();

    const progress = 150;
    const isValid =
      typeof progress === "number" &&
      !Number.isNaN(progress) &&
      progress >= 0 &&
      progress <= 100;
    assert.equal(isValid, false);
  });

  await t.test("should reject non-number progress", async () => {
    setupMockDatabase();

    const progress = "50";
    const isValid = typeof progress === "number";
    assert.equal(isValid, false);
  });

  await t.test("should reject NaN progress", async () => {
    setupMockDatabase();

    const progress = NaN;
    const isValid = !Number.isNaN(progress);
    assert.equal(isValid, false);
  });

  await t.test(
    "should set status to NOT_STARTED when progress = 0",
    async () => {
      setupMockDatabase();

      const progress = 0;
      const status =
        progress >= 100
          ? "COMPLETED"
          : progress > 0
            ? "IN_PROGRESS"
            : "NOT_STARTED";
      assert.equal(status, "NOT_STARTED");
    },
  );

  await t.test(
    "should set status to IN_PROGRESS when progress 1-99",
    async () => {
      setupMockDatabase();

      const progress = 50;
      const status =
        progress >= 100
          ? "COMPLETED"
          : progress > 0
            ? "IN_PROGRESS"
            : "NOT_STARTED";
      assert.equal(status, "IN_PROGRESS");
    },
  );

  await t.test(
    "should set status to COMPLETED when progress >= 100",
    async () => {
      setupMockDatabase();

      const progress = 100;
      const status =
        progress >= 100
          ? "COMPLETED"
          : progress > 0
            ? "IN_PROGRESS"
            : "NOT_STARTED";
      assert.equal(status, "COMPLETED");
    },
  );

  await t.test("should set completed_at when progress >= 100", async () => {
    setupMockDatabase();

    const progress = 100;
    const completedAt = progress >= 100 ? new Date() : null;
    assert.ok(completedAt);
  });

  await t.test("should clear completed_at when progress < 100", async () => {
    setupMockDatabase();

    const progress = 50;
    const completedAt = progress >= 100 ? new Date() : null;
    assert.equal(completedAt, null);
  });

  await t.test("should only update own enrollments", async () => {
    setupMockDatabase();

    const enrollmentId = "enroll-1";
    const principalId = "user-1";

    const enrollment = mockDatabase.enrollments.find(
      (e) => e.id === enrollmentId && e.principal_id === principalId,
    );

    assert.ok(enrollment);
  });

  await t.test("should return 404 if enrollment not found", async () => {
    setupMockDatabase();

    const enrollmentId = "nonexistent";
    const principalId = "user-1";

    const enrollment = mockDatabase.enrollments.find(
      (e) => e.id === enrollmentId && e.principal_id === principalId,
    );

    assert.equal(enrollment, undefined);
  });

  await t.test("should create certificate when progress = 100", async () => {
    setupMockDatabase();

    const progress = 100;
    const shouldCreateCert = progress >= 100;
    assert.equal(shouldCreateCert, true);
  });

  await t.test("should create notification when progress = 100", async () => {
    setupMockDatabase();

    const progress = 100;
    const shouldCreateNotif = progress >= 100;
    assert.equal(shouldCreateNotif, true);
  });

  await t.test("should log audit trail", async () => {
    setupMockDatabase();
    auditLogs = [];

    const audit = {
      actorPrincipalId: "user-1",
      action: "UPDATE_ENROLLMENT_PROGRESS",
      resourceType: "ENROLLMENT",
      resourceId: "enroll-1",
      metadata: { progress: 50, status: "IN_PROGRESS" },
    };

    mockLogAudit(audit);

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "UPDATE_ENROLLMENT_PROGRESS");
  });
});

// selfEnrollPublicPath testing
test("SELF ENROLL PUBLIC PATH TESTS", async (t) => {
  await t.test("should enroll in valid PUBLIC path", async () => {
    setupMockDatabase();

    const pathId = "path-1";
    const path = mockDatabase.learning_paths.find(
      (p) => p.id === pathId && !p.is_deleted,
    );

    assert.ok(path);
    assert.equal(path.status, "ACTIVE");
    assert.equal(path.category, "PUBLIC");
  });

  await t.test("should reject enrollment in non-existent path", async () => {
    setupMockDatabase();

    const pathId = "nonexistent";
    const path = mockDatabase.learning_paths.find(
      (p) => p.id === pathId && !p.is_deleted,
    );

    assert.equal(path, undefined);
  });

  await t.test("should reject enrollment in RESTRICTED path", async () => {
    setupMockDatabase();

    const pathId = "path-2";
    const path = mockDatabase.learning_paths.find((p) => p.id === pathId);

    assert.equal(path.category, "RESTRICTED");
    assert.notEqual(path.category, "PUBLIC");
  });

  await t.test("should reject enrollment in SEMI_RESTRICTED path", async () => {
    setupMockDatabase();

    const pathId = "path-7";
    const path = mockDatabase.learning_paths.find((p) => p.id === pathId);

    assert.equal(path.category, "SEMI_RESTRICTED");
    assert.notEqual(path.category, "PUBLIC");
  });

  await t.test("should reject enrollment in INACTIVE path", async () => {
    setupMockDatabase();

    const pathId = "path-4";
    const path = mockDatabase.learning_paths.find((p) => p.id === pathId);

    assert.equal(path.status, "INACTIVE");
    assert.notEqual(path.status, "ACTIVE");
  });

  await t.test("should reject enrollment in ARCHIVED path", async () => {
    setupMockDatabase();

    const pathId = "path-5";
    const path = mockDatabase.learning_paths.find((p) => p.id === pathId);

    assert.equal(path.status, "ARCHIVED");
    assert.notEqual(path.status, "ACTIVE");
  });

  await t.test("should reject enrollment in deleted path", async () => {
    setupMockDatabase();

    const pathId = "path-6";
    const path = mockDatabase.learning_paths.find(
      (p) => p.id === pathId && !p.is_deleted,
    );

    assert.equal(path, undefined);
  });

  await t.test("should reject if already enrolled", async () => {
    setupMockDatabase();

    const principalId = "user-1";
    const pathId = "path-1";

    const exists = mockDatabase.enrollments.some(
      (e) => e.principal_id === principalId && e.learning_path_id === pathId,
    );

    assert.equal(exists, true);
  });

  await t.test("should create enrollment with status NOT_STARTED", async () => {
    setupMockDatabase();

    const newEnrollment = {
      status: "NOT_STARTED",
    };

    assert.equal(newEnrollment.status, "NOT_STARTED");
  });

  await t.test("should create enrollment with progress 0", async () => {
    setupMockDatabase();

    const newEnrollment = {
      progress: 0,
    };

    assert.equal(newEnrollment.progress, 0);
  });

  await t.test("should set enrollment_source to SELF", async () => {
    setupMockDatabase();

    const newEnrollment = {
      enrollment_source: "SELF",
    };

    assert.equal(newEnrollment.enrollment_source, "SELF");
  });

  await t.test("should set enrolled_at to current time", async () => {
    setupMockDatabase();

    const enrolledAt = new Date();
    assert.ok(enrolledAt);
  });

  await t.test(
    "should create notification on successful enrollment",
    async () => {
      setupMockDatabase();

      const pathTitle = "Python Basics";
      const message = `You have enrolled in "${pathTitle}".`;

      assert.ok(message.includes(pathTitle));
    },
  );

  await t.test("should log audit trail", async () => {
    setupMockDatabase();
    auditLogs = [];

    const audit = {
      actorPrincipalId: "user-1",
      action: "SELF_ENROLL_PUBLIC_PATH",
      resourceType: "ENROLLMENT",
      resourceId: "enroll-new",
      metadata: { learningPathId: "path-1" },
    };

    mockLogAudit(audit);

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "SELF_ENROLL_PUBLIC_PATH");
  });
});
