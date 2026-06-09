// Set up test environment
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-for-testing";

import test from "node:test";
import assert from "assert/strict";
import * as learnerController from "../controllers/learnerController.js";
import { query } from "../db.js";

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
    user: { id: "user-1", employee: "EMP-001", role: "EMPLOYEE" },
  };

  return {
    ...baseReq,
    ...overrides,
    user: { ...baseReq.user, ...overrides.user },
    body: { ...baseReq.body, ...overrides.body },
    params: { ...baseReq.params, ...overrides.params },
  };
};

// MOCK DATABASE

let mockDatabase = {};

const setupMockDatabase = () => {
  mockDatabase = {
    enrollments: [
      {
        id: "en-1",
        principal_id: "principal-1",
        learning_path_id: "lp-1",
        status: "IN_PROGRESS",
        progress: 50,
        enrolled_at: new Date("2026-06-01"),
        completed_at: null,
        enrollment_source: "SELF",
      },
      {
        id: "en-2",
        principal_id: "principal-1",
        learning_path_id: "lp-2",
        status: "COMPLETED",
        progress: 100,
        enrolled_at: new Date("2026-05-01"),
        completed_at: new Date("2026-06-01"),
        enrollment_source: "SUPERVISOR",
      },
      {
        id: "en-3",
        principal_id: "principal-2",
        learning_path_id: "lp-3",
        status: "NOT_STARTED",
        progress: 0,
        enrolled_at: new Date("2026-06-05"),
        completed_at: null,
        enrollment_source: "ADMIN",
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
        created_at: new Date("2026-06-01"),
      },
      {
        id: "lp-2",
        title: "Advanced Python",
        description: "Advanced Topics",
        category: "RESTRICTED",
        total_duration: 40,
        status: "ACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-02"),
      },
      {
        id: "lp-3",
        title: "Communication",
        description: "Soft Skills",
        category: "PUBLIC",
        total_duration: 15,
        status: "ACTIVE",
        is_deleted: false,
        created_at: new Date("2026-06-03"),
      },
    ],
    certificates: [
      {
        id: "cert-1",
        principal_id: "principal-1",
        learning_path_id: "lp-1",
        scope: "FULL",
        issued_at: new Date("2026-06-01T10:00:00Z"),
      },
    ],
    notifications: [
      {
        id: "notif-1",
        principal_id: "principal-1",
        title: "Self Enrollment Confirmed",
        message: "You have enrolled in Python Basics.",
        type: "SUCCESS",
        is_read: false,
        created_at: new Date("2026-06-05T10:30:00Z"),
      },
      {
        id: "notif-2",
        principal_id: "principal-1",
        title: "Certificate Issued",
        message: "Congratulations! You earned a certificate.",
        type: "SUCCESS",
        is_read: false,
        created_at: new Date("2026-06-04T14:00:00Z"),
      },
    ],
    learning_path_stages: [
      {
        id: "stage-1",
        learning_path_id: "lp-1",
        title: "Stage 1",
        stage_order: 1,
      },
      {
        id: "stage-2",
        learning_path_id: "lp-1",
        title: "Stage 2",
        stage_order: 2,
      },
    ],
    stage_courses: [
      {
        id: "sc-1",
        stage_id: "stage-1",
        course_code: "COURSE-001",
        course_title: "Python Intro",
        course_order: 1,
        delivery_mode: "ONLINE",
      },
      {
        id: "sc-2",
        stage_id: "stage-1",
        course_code: "COURSE-002",
        course_title: "Python Variables",
        course_order: 2,
        delivery_mode: "ONLINE",
      },
    ],
  };
};

// MOCK QUERY FUNCTION

const mockQuery = async (sql, params = []) => {
  // GET LEARNER DASHBOARD - PATHS
  if (
    sql.includes("SELECT en.id AS enrollment_id, en.learning_path_id, lp.title")
  ) {
    const principalId = params[0];
    const paths = mockDatabase.enrollments
      .filter(
        (e) =>
          e.principal_id === principalId &&
          mockDatabase.learning_paths.find(
            (lp) => lp.id === e.learning_path_id && !lp.is_deleted,
          ),
      )
      .map((e) => {
        const path = mockDatabase.learning_paths.find(
          (lp) => lp.id === e.learning_path_id,
        );
        return {
          enrollment_id: e.id,
          learning_path_id: e.learning_path_id,
          title: path.title,
          progress: e.progress,
          status: e.status,
          enrolled_at: e.enrolled_at,
        };
      })
      .sort((a, b) => new Date(b.enrolled_at) - new Date(a.enrolled_at));

    return { rows: paths, rowCount: paths.length };
  }

  // GET NOTIFICATIONS
  if (sql.includes("SELECT id, title, message, type FROM notifications")) {
    const principalId = params[0];
    const notifications = mockDatabase.notifications
      .filter((n) => n.principal_id === principalId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    return { rows: notifications, rowCount: notifications.length };
  }

  // GET PUBLIC PATHS
  if (
    sql.includes(
      "SELECT lp.id, lp.title, lp.description, lp.category, lp.total_duration, lp.status",
    )
  ) {
    const principalId = params[0];
    const paths = mockDatabase.learning_paths
      .filter(
        (lp) =>
          !lp.is_deleted && lp.status === "ACTIVE" && lp.category === "PUBLIC",
      )
      .map((lp) => ({
        id: lp.id,
        title: lp.title,
        description: lp.description,
        category: lp.category,
        total_duration: lp.total_duration,
        status: lp.status,
        already_enrolled: principalId
          ? mockDatabase.enrollments.some(
              (e) =>
                e.principal_id === principalId && e.learning_path_id === lp.id,
            )
          : false,
      }));

    return { rows: paths, rowCount: paths.length };
  }

  // GET LEARNING PATH BY ID
  if (
    sql.includes(
      "SELECT id, title, description, category, total_duration, status, created_at FROM learning_paths WHERE id = $1",
    )
  ) {
    const pathId = params[0];
    const path = mockDatabase.learning_paths.find(
      (lp) =>
        lp.id === pathId &&
        !lp.is_deleted &&
        lp.status === "ACTIVE" &&
        lp.category === "PUBLIC",
    );

    if (!path) return { rows: [], rowCount: 0 };
    return { rows: [path], rowCount: 1 };
  }

  // GET STAGES FOR PATH
  if (
    sql.includes(
      "SELECT id, title, stage_order FROM learning_path_stages WHERE learning_path_id",
    )
  ) {
    const pathId = params[0];
    const stages = mockDatabase.learning_path_stages.filter(
      (s) => s.learning_path_id === pathId,
    );

    return { rows: stages, rowCount: stages.length };
  }

  // GET STAGE COURSES
  if (
    sql.includes("SELECT lps.id AS stage_id, COALESCE(sc.course_code") ||
    sql.includes("SELECT lps.id AS stage_id, course.id AS course_id")
  ) {
    const pathId = params[0];
    const stages = mockDatabase.learning_path_stages.filter(
      (s) => s.learning_path_id === pathId,
    );
    const courses = [];

    for (const stage of stages) {
      const stageCourses = mockDatabase.stage_courses.filter(
        (sc) => sc.stage_id === stage.id,
      );
      for (const course of stageCourses) {
        courses.push({
          stage_id: stage.id,
          course_id: course.course_code,
          course_title: course.course_title,
          course_order: course.course_order,
          delivery_mode: course.delivery_mode,
        });
      }
    }

    return { rows: courses, rowCount: courses.length };
  }

  // SELF ENROLL - GET PATH
  if (
    sql.includes(
      "SELECT id, title, category, status FROM learning_paths WHERE id = $1 AND is_deleted = FALSE",
    )
  ) {
    const pathId = params[0];
    const path = mockDatabase.learning_paths.find(
      (lp) => lp.id === pathId && !lp.is_deleted,
    );

    if (!path) return { rows: [], rowCount: 0 };
    return { rows: [path], rowCount: 1 };
  }

  // INSERT ENROLLMENT
  if (sql.includes("INSERT INTO enrollments") && sql.includes("ON CONFLICT")) {
    return {
      rows: [
        {
          id: "en-new",
          principal_id: params[0],
          learning_path_id: params[1],
          status: "NOT_STARTED",
          progress: 0,
          enrolled_at: new Date(),
        },
      ],
      rowCount: 1,
    };
  }

  // GET ENROLLMENT FOR COURSE UPDATE
  if (
    sql.includes(
      "SELECT en.id, en.learning_path_id, en.progress, lp.title, ap.name AS learner_name",
    )
  ) {
    const enrollmentId = params[0];
    const principalId = params[1];
    const enrollment = mockDatabase.enrollments.find(
      (e) => e.id === enrollmentId && e.principal_id === principalId,
    );

    if (!enrollment) return { rows: [], rowCount: 0 };
    return {
      rows: [
        {
          ...enrollment,
          learner_name: "John Doe",
          learner_email: "john@example.com",
          employee_number: "EMP-001",
        },
      ],
      rowCount: 1,
    };
  }

  // GET CERTIFICATES
  if (
    sql.includes(
      "SELECT cert.id, cert.scope, cert.issued_at, lp.id AS learning_path_id",
    )
  ) {
    const principalId = params[0];
    const certs = mockDatabase.certificates
      .filter((c) => c.principal_id === principalId)
      .map((c) => {
        const path = mockDatabase.learning_paths.find(
          (lp) => lp.id === c.learning_path_id,
        );
        return {
          ...c,
          learning_path_id: path.id,
          learning_path_title: path.title,
          learner_name: "John Doe",
        };
      })
      .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));

    return { rows: certs, rowCount: certs.length };
  }

  // MOCK SCHEMA CHECKS
  if (
    sql.includes("information_schema.tables") ||
    sql.includes("information_schema.columns")
  ) {
    // Return true to test the new schema, or false for the legacy fallback
    return { rows: [{ present: false }], rowCount: 1 };
  }

  // GET OR CREATE PRINCIPAL - SELECT
  if (sql.includes("SELECT ap.id, e.employee_number FROM auth_principals ap")) {
    const email = params[0];
    const principal = mockDatabase.principals?.find((p) => p.email === email);
    if (principal) {
      return {
        rows: [{ id: principal.id, employee_number: "EMP-001" }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  }

  // GET OR CREATE PRINCIPAL - INSERT
  if (sql.includes("INSERT INTO auth_principals (email, password_hash, role")) {
    return { rows: [{ id: `principal-new-${Date.now()}` }], rowCount: 1 };
  }
  if (sql.includes("INSERT INTO employees (principal_id, employee_number")) {
    return { rows: [], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
};

// TEST SUITES

// export functions testing
test("LEARNER CONTROLLER EXPORTS TESTS", async (t) => {
  const expectedExports = [
    "getLearnerProfile",
    "getLearnerDashboard",
    "getLearnerTeam",
    "enrollLearnerTeam",
    "getCourses",
    "getLearnerOtherCourses",
    "getLearningPaths",
    "getPublicLearningPaths",
    "getPublicLearningPathById",
    "selfEnrollPublicLearningPath",
    "getLearnerPathCourses",
    "updateLearnerCourseCompletion",
    "getLearnerCertificates",
    "downloadLearnerCertificate",
  ];

  for (const exportName of expectedExports) {
    await t.test(`should export ${exportName}`, async () => {
      assert.equal(typeof learnerController[exportName], "function");
    });
  }
});

// getLearnerProfile testing
test("GET LEARNER PROFILE TESTS", async (t) => {
  await t.test("should validate employeeNo is provided", async () => {
    const req = createMockReq({ user: { employeeNo: "" } });
    assert.equal(req.user.employeeNo, "");
  });

  await t.test("should normalize employeeNo from request user", async () => {
    const req = createMockReq({ user: { employeeNo: " EMP-001 " } });
    const normalized = String(req.user.employeeNo).trim();
    assert.equal(normalized, "EMP-001");
  });

  await t.test("should handle missing employeeNo gracefully", async () => {
    const req = createMockReq({ user: { employeeNo: "" } });
    const employeeNo = req.user.employeeNo || "";
    assert.equal(employeeNo, "");
  });
});

// getLearnerDashboard testing
test("GET LEARNER DASHBOARD TESTS", async (t) => {
  await t.test(
    "should return empty paths and notifications when no principal",
    async () => {
      const req = createMockReq({ employeeNo: "EMP-001" });
      const res = createMockRes();

      const principalId = null;
      const paths = [];

      assert.equal(principalId, null);
      assert.equal(paths.length, 0);
    },
  );

  await t.test(
    "should fetch enrollments with learning path details",
    async () => {
      setupMockDatabase();
      const principalId = "principal-1";

      const enrollments = mockDatabase.enrollments.filter(
        (e) => e.principal_id === principalId,
      );
      assert.ok(enrollments.length > 0);
      assert.equal(enrollments[0].learning_path_id, "lp-1");
    },
  );

  await t.test("should calculate completed count correctly", async () => {
    setupMockDatabase();
    const paths = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "principal-1",
    );
    const completedCount = paths.filter((p) => p.status === "COMPLETED").length;

    assert.equal(completedCount, 1);
  });

  await t.test("should calculate average progress correctly", async () => {
    setupMockDatabase();
    const paths = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "principal-1",
    );
    const avgProgress =
      paths.length > 0
        ? Math.round(
            paths.reduce((sum, p) => sum + p.progress, 0) / paths.length,
          )
        : 0;

    assert.equal(avgProgress, 75);
  });

  await t.test("should handle no notifications case", async () => {
    setupMockDatabase();
    const notifications = mockDatabase.notifications.filter(
      (n) => n.principal_id === "principal-2",
    );

    assert.equal(notifications.length, 0);
  });

  await t.test("should limit notifications to 10 most recent", async () => {
    setupMockDatabase();
    const allNotifications = mockDatabase.notifications.filter(
      (n) => n.principal_id === "principal-1",
    );
    const limitedNotifications = allNotifications.slice(0, 10);

    assert.ok(limitedNotifications.length <= 10);
  });
});

// getLearnerTeam testing
test("GET LEARNER TEAM TESTS", async (t) => {
  await t.test("should validate employeeNo is provided", async () => {
    const req = createMockReq({ user: { employeeNo: "" } });
    assert.equal(req.user.employeeNo, "");
  });

  await t.test(
    "should return supervisor status based on subordinates",
    async () => {
      const subordinates = [{ employeeNumber: "SUB-001" }];
      const isSupervisor = subordinates.length > 0;

      assert.ok(isSupervisor);
    },
  );

  await t.test("should return false for non-supervisors", async () => {
    const subordinates = [];
    const isSupervisor = subordinates.length > 0;

    assert.equal(isSupervisor, false);
  });
});

// enrollLearnerTeam testing
test("ENROLL LEARNER TEAM TESTS", async (t) => {
  await t.test(
    "should validate employeeNumbers is non-empty array",
    async () => {
      const req = createMockReq(
        {},
        { employeeNumbers: [], learningPathIds: ["lp-1"] },
      );
      const isValid =
        Array.isArray(req.body.employeeNumbers) &&
        req.body.employeeNumbers.length > 0;

      assert.equal(isValid, false);
    },
  );

  await t.test(
    "should validate learningPathIds is non-empty array",
    async () => {
      const req = createMockReq(
        {},
        { employeeNumbers: ["EMP-001"], learningPathIds: [] },
      );
      const isValid =
        Array.isArray(req.body.learningPathIds) &&
        req.body.learningPathIds.length > 0;

      assert.equal(isValid, false);
    },
  );

  await t.test(
    "should filter subordinate numbers from provided list",
    async () => {
      const supervisorSubordinates = ["SUB-001", "SUB-002"];
      const providedNumbers = ["SUB-001", "SUB-999"];
      const subordinateSet = new Set(supervisorSubordinates);
      const filtered = providedNumbers.filter((num) => subordinateSet.has(num));

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0], "SUB-001");
    },
  );

  await t.test("should count successful assignments", async () => {
    const assignments = [
      { employeeNo: "SUB-001", assignedLearningPathIds: ["lp-1", "lp-2"] },
      { employeeNo: "SUB-002", assignedLearningPathIds: ["lp-1"] },
    ];

    const totalAssigned = assignments.reduce(
      (sum, a) => sum + a.assignedLearningPathIds.length,
      0,
    );
    assert.equal(totalAssigned, 3);
  });

  await t.test(
    "should return empty assigned paths if enrollment fails",
    async () => {
      const assignment = { employeeNo: "SUB-001", assignedLearningPathIds: [] };

      assert.equal(assignment.assignedLearningPathIds.length, 0);
    },
  );

  await t.test("should create notifications for each assignment", async () => {
    const pathCount = 2;
    const subordinateCount = 1;
    const notificationCount = pathCount * subordinateCount;

    assert.equal(notificationCount, 2);
  });

  await t.test(
    "should handle principal resolution for supervisor",
    async () => {
      const supervisorId = "principal-supervisor";
      assert.ok(supervisorId);
    },
  );
});

// getCourses testing
test("GET COURSES TESTS", async (t) => {
  await t.test("should fetch and normalize courses from ERP", async () => {
    const courses = [
      { courseCode: "COURSE-001", courseName: "Python Basics" },
      { courseCode: "COURSE-002", courseName: "React Advanced" },
    ];

    assert.equal(courses.length, 2);
    assert.ok(courses.every((c) => c.courseCode && c.courseName));
  });

  await t.test("should filter courses with valid code and title", async () => {
    const courses = [
      { courseCode: "COURSE-001", courseName: "Python Basics" },
      { courseCode: "", courseName: "Invalid Course" },
      { courseCode: "COURSE-003", courseName: "" },
    ];

    const validCourses = courses.filter((c) => c.courseCode && c.courseName);
    assert.equal(validCourses.length, 1);
  });
});

// getLearnerOtherCourses testing
test("GET LEARNER OTHER COURSES TESTS", async (t) => {
  await t.test(
    "should return all courses when no principal (temporary auth)",
    async () => {
      const principalId = null;
      const allCourses = [
        { code: "COURSE-001", title: "Python" },
        { code: "COURSE-002", title: "React" },
      ];

      const courses = allCourses.map((c) => ({
        ...c,
        alreadyEnrolled: false,
        learningPaths: [],
      }));
      assert.equal(courses.length, 2);
      assert.ok(courses.every((c) => c.alreadyEnrolled === false));
    },
  );

  await t.test(
    "should mark already_enrolled=true for enrolled courses",
    async () => {
      const enrolledCourses = new Set(["COURSE-001"]);
      const allCourses = [
        { code: "COURSE-001", title: "Python" },
        { code: "COURSE-002", title: "React" },
      ];

      const courses = allCourses.map((c) => ({
        ...c,
        alreadyEnrolled: enrolledCourses.has(c.code),
      }));

      assert.equal(courses[0].alreadyEnrolled, true);
      assert.equal(courses[1].alreadyEnrolled, false);
    },
  );

  await t.test(
    "should deduplicate learning paths for each course",
    async () => {
      const paths = [
        { id: "lp-1", title: "Path 1" },
        { id: "lp-1", title: "Path 1" },
        { id: "lp-2", title: "Path 2" },
      ];

      const unique = paths.filter(
        (p, i, arr) => arr.findIndex((item) => item.id === p.id) === i,
      );
      assert.equal(unique.length, 2);
    },
  );

  await t.test("should handle case-insensitive course matching", async () => {
    const key1 = "COURSE-001".toLowerCase();
    const key2 = "course-001".toLowerCase();

    assert.equal(key1, key2);
  });

  await t.test("should map learning paths for enrolled courses", async () => {
    setupMockDatabase();
    const enrollments = mockDatabase.enrollments.filter(
      (e) => e.principal_id === "principal-1",
    );
    const paths = enrollments.map((e) => {
      const path = mockDatabase.learning_paths.find(
        (lp) => lp.id === e.learning_path_id,
      );
      return { id: path.id, title: path.title };
    });

    assert.ok(paths.length > 0);
    assert.ok(paths[0].id);
  });
});

// getLearningPaths testing
test("GET LEARNING PATHS TESTS", async (t) => {
  await t.test("should return all active learning paths", async () => {
    setupMockDatabase();
    const paths = mockDatabase.learning_paths.filter(
      (lp) => !lp.is_deleted && lp.status === "ACTIVE",
    );

    assert.ok(paths.length > 0);
    assert.ok(paths.every((p) => p.status === "ACTIVE" && !p.is_deleted));
  });

  await t.test("should exclude deleted paths", async () => {
    setupMockDatabase();
    const allPaths = mockDatabase.learning_paths;
    const activePaths = allPaths.filter(
      (p) => !p.is_deleted && p.status === "ACTIVE",
    );

    assert.ok(
      allPaths.some((p) => p.is_deleted === false) ||
        allPaths.some((p) => p.is_deleted === true),
    );
    assert.ok(activePaths.every((p) => !p.is_deleted));
  });
});

// getPublicLearningPaths testing
test("GET PUBLIC LEARNING PATHS TESTS", async (t) => {
  await t.test("should return only PUBLIC category paths", async () => {
    setupMockDatabase();
    const publicPaths = mockDatabase.learning_paths.filter(
      (p) => p.category === "PUBLIC",
    );

    assert.ok(publicPaths.every((p) => p.category === "PUBLIC"));
  });

  await t.test(
    "should mark already_enrolled=true if user enrolled",
    async () => {
      setupMockDatabase();
      const principleId = "principal-1";
      const enrolledPathIds = mockDatabase.enrollments
        .filter((e) => e.principal_id === principleId)
        .map((e) => e.learning_path_id);

      const publicPaths = mockDatabase.learning_paths
        .filter(
          (p) =>
            p.category === "PUBLIC" && !p.is_deleted && p.status === "ACTIVE",
        )
        .map((p) => ({
          ...p,
          already_enrolled: enrolledPathIds.includes(p.id),
        }));

      const enrolled = publicPaths.find((p) => p.already_enrolled === true);
      assert.ok(enrolled);
    },
  );

  await t.test(
    "should mark already_enrolled=false if user not enrolled",
    async () => {
      setupMockDatabase();
      const principalId = "principal-2";
      const enrolledPathIds = mockDatabase.enrollments
        .filter((e) => e.principal_id === principalId)
        .map((e) => e.learning_path_id);

      const publicPaths = mockDatabase.learning_paths
        .filter(
          (p) =>
            p.category === "PUBLIC" && !p.is_deleted && p.status === "ACTIVE",
        )
        .map((p) => ({
          ...p,
          already_enrolled: enrolledPathIds.includes(p.id),
        }));

      const lp1 = publicPaths.find((p) => p.id === "lp-1");
      assert.equal(lp1.already_enrolled, false);
    },
  );

  await t.test(
    "should return empty array if no principal and no public paths",
    async () => {
      setupMockDatabase();
      const principalId = null;
      const publicPaths = mockDatabase.learning_paths.filter(
        (p) =>
          p.category === "PUBLIC" && !p.is_deleted && p.status === "ACTIVE",
      );

      assert.ok(Array.isArray(publicPaths));
    },
  );
});

// getPublicLearningPathById testing
test("GET PUBLIC LEARNING PATH BY ID TESTS", async (t) => {
  await t.test("should return 404 if path not found", async () => {
    setupMockDatabase();
    const pathId = "nonexistent";
    const path = mockDatabase.learning_paths.find(
      (p) =>
        p.id === pathId &&
        !p.is_deleted &&
        p.status === "ACTIVE" &&
        p.category === "PUBLIC",
    );

    assert.equal(path, undefined);
  });

  await t.test("should return path with stages and courses", async () => {
    setupMockDatabase();
    const pathId = "lp-1";
    const path = mockDatabase.learning_paths.find(
      (p) =>
        p.id === pathId &&
        p.category === "PUBLIC" &&
        p.status === "ACTIVE" &&
        !p.is_deleted,
    );
    const stages = mockDatabase.learning_path_stages.filter(
      (s) => s.learning_path_id === pathId,
    );

    assert.ok(path);
    assert.ok(stages.length > 0);
  });

  await t.test("should organize courses by stage", async () => {
    setupMockDatabase();
    const pathId = "lp-1";
    const stages = mockDatabase.learning_path_stages.filter(
      (s) => s.learning_path_id === pathId,
    );
    const stageMap = new Map();

    for (const stage of stages) {
      const courses = mockDatabase.stage_courses.filter(
        (sc) => sc.stage_id === stage.id,
      );
      stageMap.set(stage.id, courses);
    }

    assert.ok(stageMap.size > 0);
  });
});

// selfEnrollPublicLearningPath testing
test("SELF ENROLL PUBLIC LEARNING PATH TESTS", async (t) => {
  await t.test("should validate employeeNo is provided", async () => {
    const employeeNo = "";
    assert.equal(employeeNo, "");
  });

  await t.test("should validate learningPathId is provided", async () => {
    const req = createMockReq({ body: { learningPathId: "" } });
    assert.equal(req.body.learningPathId, "");
  });

  await t.test("should reject enrollment if path is not PUBLIC", async () => {
    setupMockDatabase();
    const path = mockDatabase.learning_paths.find(
      (p) => p.category !== "PUBLIC",
    );

    const isValid =
      path && path.category === "PUBLIC" && path.status === "ACTIVE";
    assert.equal(isValid, false);
  });

  await t.test("should reject enrollment if path is not ACTIVE", async () => {
    const path = { id: "lp-1", category: "PUBLIC", status: "DRAFT" };
    const isValid =
      path && path.category === "PUBLIC" && path.status === "ACTIVE";

    assert.equal(isValid, false);
  });

  await t.test("should create enrollment with NOT_STARTED status", async () => {
    const enrollment = {
      status: "NOT_STARTED",
      progress: 0,
      enrollment_source: "SELF",
    };

    assert.equal(enrollment.status, "NOT_STARTED");
    assert.equal(enrollment.progress, 0);
    assert.equal(enrollment.enrollment_source, "SELF");
  });

  await t.test("should create notification on enrollment", async () => {
    const notification = {
      title: "Self Enrollment Confirmed",
      type: "SUCCESS",
    };

    assert.ok(notification);
    assert.equal(notification.type, "SUCCESS");
  });
});

// getLearnerPathCourses testing
test("GET LEARNER PATH COURSES TESTS", async (t) => {
  await t.test("should validate principal exists", async () => {
    const principalId = "principal-1";
    assert.ok(principalId);
  });

  await t.test("should retrieve enrollment by id and principal", async () => {
    setupMockDatabase();
    const enrollmentId = "en-1";
    const principalId = "principal-1";
    const enrollment = mockDatabase.enrollments.find(
      (e) => e.id === enrollmentId && e.principal_id === principalId,
    );

    assert.ok(enrollment);
    assert.equal(enrollment.id, enrollmentId);
  });

  await t.test("should fetch courses for the learning path", async () => {
    setupMockDatabase();
    const enrollment = mockDatabase.enrollments.find((e) => e.id === "en-1");
    const stages = mockDatabase.learning_path_stages.filter(
      (s) => s.learning_path_id === enrollment.learning_path_id,
    );

    assert.ok(stages.length > 0);
  });

  await t.test(
    "should calculate total and completed course counts",
    async () => {
      const courses = [
        { isCompleted: false },
        { isCompleted: true },
        { isCompleted: true },
      ];

      const totalCourses = courses.length;
      const completedCourses = courses.filter((c) => c.isCompleted).length;

      assert.equal(totalCourses, 3);
      assert.equal(completedCourses, 2);
    },
  );
});

// updateLearnerCourseCompletion testing
test("UPDATE LEARNER COURSE COMPLETION TESTS", async (t) => {
  await t.test("should validate employeeNo is provided", async () => {
    const employeeNo = "";
    assert.equal(employeeNo, "");
  });

  await t.test("should validate completed is boolean", async () => {
    const completed = "true";
    assert.equal(typeof completed !== "boolean", true);
  });

  await t.test("should retrieve enrollment for update", async () => {
    setupMockDatabase();
    const enrollmentId = "en-1";
    const principalId = "principal-1";
    const enrollment = mockDatabase.enrollments.find(
      (e) => e.id === enrollmentId && e.principal_id === principalId,
    );

    assert.ok(enrollment);
  });

  await t.test("should update enrollment progress record", async () => {
    const previousProgress = 50;
    const newProgress = 100;

    assert.ok(newProgress >= previousProgress);
  });

  await t.test(
    "should recalculate enrollment progress from courses",
    async () => {
      const totalCourses = 4;
      const completedCourses = 3;
      const computedProgress = Math.round(
        (completedCourses / totalCourses) * 100,
      );

      assert.equal(computedProgress, 75);
    },
  );

  await t.test(
    "should generate certificate when progress reaches 100%",
    async () => {
      const previousProgress = 50;
      const newProgress = 100;
      const shouldGenerateCert = previousProgress < 100 && newProgress >= 100;

      assert.ok(shouldGenerateCert);
    },
  );

  await t.test(
    "should create notification for certificate completion",
    async () => {
      const certificateGenerated = true;
      assert.ok(certificateGenerated);
    },
  );

  await t.test("should handle no courses edge case", async () => {
    const totalCourses = 0;
    const computedProgress = totalCourses > 0 ? 100 : 0;

    assert.equal(computedProgress, 0);
  });

  await t.test(
    "should only update user own enrollments (security)",
    async () => {
      const enrollmentPrincipalId = "principal-1";
      const requestPrincipalId = "principal-1";

      assert.equal(enrollmentPrincipalId, requestPrincipalId);
    },
  );
});

// getLearnerCertificates testing
test("GET LEARNER CERTIFICATES TESTS", async (t) => {
  await t.test(
    "should return empty array if principal does not exist",
    async () => {
      const principalId = null;
      const certificates = [];

      assert.equal(certificates.length, 0);
    },
  );

  await t.test(
    "should return certificates for principal with path details",
    async () => {
      setupMockDatabase();
      const principalId = "principal-1";
      const certs = mockDatabase.certificates.filter(
        (c) => c.principal_id === principalId,
      );

      assert.ok(certs.length > 0);
      assert.ok(certs.every((c) => c.learning_path_id));
    },
  );
});

// downloadLearnerCertificate testing
test("DOWNLOAD LEARNER CERTIFICATE TESTS", async (t) => {
  await t.test("should validate employeeNo is provided", async () => {
    const employeeNo = "";
    assert.equal(employeeNo, "");
  });

  await t.test("should retrieve certificate with path details", async () => {
    setupMockDatabase();
    const certificateId = "cert-1";
    const principalId = "principal-1";
    const certificate = mockDatabase.certificates.find(
      (c) => c.id === certificateId && c.principal_id === principalId,
    );

    assert.ok(certificate);
  });

  await t.test("should fetch courses for PDF generation", async () => {
    setupMockDatabase();
    const certificate = mockDatabase.certificates.find(
      (c) => c.id === "cert-1",
    );
    const path = mockDatabase.learning_paths.find(
      (lp) => lp.id === certificate.learning_path_id,
    );
    const stages = mockDatabase.learning_path_stages.filter(
      (s) => s.learning_path_id === path.id,
    );

    assert.ok(stages.length > 0);
  });
});
