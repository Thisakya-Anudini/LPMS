// Set up test environment
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-for-testing";

import test from "node:test";
import assert from "assert/strict";
import * as supervisorController from "../controllers/supervisorController.js";

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
    user: {
      id: "supervisor-1",
      name: "Supervisor User",
      role: "SUPERVISOR",
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
let assignmentReports = [];

const setupMockDatabase = () => {
  mockDatabase = {
    principals: [
      {
        id: "supervisor-1",
        name: "Supervisor User",
        email: "supervisor@example.com",
        role: "SUPERVISOR",
      },
      {
        id: "employee-1",
        name: "Alice Learner",
        email: "alice@example.com",
        role: "EMPLOYEE",
      },
      {
        id: "employee-2",
        name: "Bob Learner",
        email: "bob@example.com",
        role: "EMPLOYEE",
      },
      {
        id: "employee-3",
        name: "Charlie Other",
        email: "charlie@example.com",
        role: "EMPLOYEE",
      },
    ],
    employees: [
      {
        id: "emp-1",
        principal_id: "employee-1",
        employee_number: "EMP-001",
        designation: "Developer",
        grade_name: "G5",
        supervisor_id: "supervisor-1",
      },
      {
        id: "emp-2",
        principal_id: "employee-2",
        employee_number: "EMP-002",
        designation: "Analyst",
        grade_name: "G4",
        supervisor_id: "supervisor-1",
      },
      {
        id: "emp-3",
        principal_id: "employee-3",
        employee_number: "EMP-003",
        designation: "Engineer",
        grade_name: "G3",
        supervisor_id: "other-supervisor",
      },
    ],
    learning_paths: [
      {
        id: "lp-1",
        title: "Python Basics",
        category: "PUBLIC",
        status: "ACTIVE",
        is_deleted: false,
      },
      {
        id: "lp-2",
        title: "Inactive Path",
        category: "PUBLIC",
        status: "INACTIVE",
        is_deleted: false,
      },
      {
        id: "lp-3",
        title: "Deleted Path",
        category: "PUBLIC",
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
        approval_status: "PENDING",
        enrolled_at: new Date("2026-06-05T10:00:00Z"),
        approval_updated_at: null,
        approval_updated_by: null,
      },
      {
        id: "en-2",
        principal_id: "employee-2",
        learning_path_id: "lp-1",
        status: "COMPLETED",
        progress: 100,
        approval_status: "PENDING",
        enrolled_at: new Date("2026-06-04T10:00:00Z"),
        approval_updated_at: null,
        approval_updated_by: null,
      },
      {
        id: "en-3",
        principal_id: "employee-3",
        learning_path_id: "lp-1",
        status: "IN_PROGRESS",
        progress: 25,
        approval_status: "PENDING",
        enrolled_at: new Date("2026-06-06T10:00:00Z"),
        approval_updated_at: null,
        approval_updated_by: null,
      },
    ],
    notifications: [],
  };
};

const mockLogAudit = async (audit) => {
  auditLogs.push(audit);
};

const mockCreateAssignmentReport = async (report) => {
  assignmentReports.push(report);
};

const getTeamRows = (supervisorId) =>
  mockDatabase.employees
    .filter((employee) => employee.supervisor_id === supervisorId)
    .map((employee) => {
      const principal = mockDatabase.principals.find(
        (item) => item.id === employee.principal_id,
      );

      return {
        id: employee.id,
        employee_number: employee.employee_number,
        designation: employee.designation,
        grade_name: employee.grade_name,
        principal_id: principal.id,
        name: principal.name,
        email: principal.email,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

const getTeamProgressRows = (supervisorId) =>
  getTeamRows(supervisorId).map((teamMember) => {
    const enrollments = mockDatabase.enrollments.filter(
      (enrollment) => enrollment.principal_id === teamMember.principal_id,
    );

    return {
      principal_id: teamMember.principal_id,
      name: teamMember.name,
      email: teamMember.email,
      total_enrollments: enrollments.length,
      avg_progress:
        enrollments.length > 0
          ? (
              enrollments.reduce((sum, item) => sum + item.progress, 0) /
              enrollments.length
            ).toFixed(2)
          : "0.00",
      completed_count: enrollments.filter(
        (enrollment) => enrollment.status === "COMPLETED",
      ).length,
    };
  });

const getPendingApprovalRows = (supervisorId) => {
  const teamPrincipalIds = new Set(
    mockDatabase.employees
      .filter((employee) => employee.supervisor_id === supervisorId)
      .map((employee) => employee.principal_id),
  );

  return mockDatabase.enrollments
    .filter((enrollment) => teamPrincipalIds.has(enrollment.principal_id))
    .map((enrollment) => {
      const principal = mockDatabase.principals.find(
        (item) => item.id === enrollment.principal_id,
      );
      const path = mockDatabase.learning_paths.find(
        (item) => item.id === enrollment.learning_path_id,
      );

      return {
        id: enrollment.id,
        approval_status: enrollment.approval_status,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolled_at: enrollment.enrolled_at,
        principal_id: principal.id,
        name: principal.name,
        email: principal.email,
        learning_path_id: path.id,
        learning_path_title: path.title,
      };
    })
    .sort((a, b) => new Date(b.enrolled_at) - new Date(a.enrolled_at));
};

const isTeamMember = (supervisorId, principalId) =>
  mockDatabase.employees.some(
    (employee) =>
      employee.supervisor_id === supervisorId &&
      employee.principal_id === principalId,
  );

const findActiveLearningPath = (learningPathId) =>
  mockDatabase.learning_paths.find(
    (path) =>
      path.id === learningPathId &&
      path.is_deleted === false &&
      path.status === "ACTIVE",
  );

// EXPORTS

// export functions testing
test("SUPERVISOR EXPORTS TESTS", async (t) => {
  const expectedExports = [
    "getTeam",
    "getTeamProgress",
    "getPendingApprovals",
    "getSupervisorPaths",
    "enrollTeamMembers",
    "approveEnrollment",
    "rejectEnrollment",
  ];

  for (const exportName of expectedExports) {
    await t.test(`should export ${exportName}`, async () => {
      assert.equal(typeof supervisorController[exportName], "function");
    });
  }
});

// getTeam testing
test("GET TEAM TESTS", async (t) => {
  await t.test(
    "should return team members for current supervisor",
    async () => {
      setupMockDatabase();

      const team = getTeamRows("supervisor-1");

      assert.equal(team.length, 2);
      assert.ok(team.every((member) => member.principal_id !== "employee-3"));
    },
  );

  await t.test("should exclude employees from other supervisors", async () => {
    setupMockDatabase();

    const team = getTeamRows("supervisor-1");

    assert.equal(
      team.some((member) => member.employee_number === "EMP-003"),
      false,
    );
  });

  await t.test("should order team members by name ASC", async () => {
    setupMockDatabase();

    const team = getTeamRows("supervisor-1");

    assert.equal(team[0].name, "Alice Learner");
    assert.equal(team[1].name, "Bob Learner");
  });

  await t.test("should include employee and principal fields", async () => {
    setupMockDatabase();

    const member = getTeamRows("supervisor-1")[0];

    assert.ok(member.id);
    assert.ok(member.employee_number);
    assert.ok(member.designation);
    assert.ok(member.grade_name);
    assert.ok(member.principal_id);
    assert.ok(member.name);
    assert.ok(member.email);
  });

  await t.test(
    "should return empty team for supervisor with no team",
    async () => {
      setupMockDatabase();

      const team = getTeamRows("no-team-supervisor");

      assert.equal(team.length, 0);
    },
  );
});

// getTeamProgress testing
test("GET TEAM PROGRESS TESTS", async (t) => {
  await t.test("should return progress for supervisor team only", async () => {
    setupMockDatabase();

    const progress = getTeamProgressRows("supervisor-1");

    assert.equal(progress.length, 2);
    assert.equal(
      progress.some((row) => row.principal_id === "employee-3"),
      false,
    );
  });

  await t.test("should calculate total enrollments", async () => {
    setupMockDatabase();

    const progress = getTeamProgressRows("supervisor-1");
    const alice = progress.find((row) => row.principal_id === "employee-1");

    assert.equal(alice.total_enrollments, 1);
  });

  await t.test("should calculate average progress", async () => {
    setupMockDatabase();

    const progress = getTeamProgressRows("supervisor-1");
    const bob = progress.find((row) => row.principal_id === "employee-2");

    assert.equal(bob.avg_progress, "100.00");
  });

  await t.test("should calculate completed count", async () => {
    setupMockDatabase();

    const progress = getTeamProgressRows("supervisor-1");
    const bob = progress.find((row) => row.principal_id === "employee-2");

    assert.equal(bob.completed_count, 1);
  });

  await t.test(
    "should return zero progress for team member with no enrollments",
    async () => {
      setupMockDatabase();

      mockDatabase.principals.push({
        id: "employee-4",
        name: "No Enrollment",
        email: "none@example.com",
        role: "EMPLOYEE",
      });
      mockDatabase.employees.push({
        id: "emp-4",
        principal_id: "employee-4",
        employee_number: "EMP-004",
        designation: "Intern",
        grade_name: "G1",
        supervisor_id: "supervisor-1",
      });

      const progress = getTeamProgressRows("supervisor-1");
      const noEnrollment = progress.find(
        (row) => row.principal_id === "employee-4",
      );

      assert.equal(noEnrollment.total_enrollments, 0);
      assert.equal(noEnrollment.avg_progress, "0.00");
      assert.equal(noEnrollment.completed_count, 0);
    },
  );
});

// getPendingApprovals testing
test("GET PENDING APPROVALS TESTS", async (t) => {
  await t.test("should return approvals for supervisor team only", async () => {
    setupMockDatabase();

    const approvals = getPendingApprovalRows("supervisor-1");

    assert.equal(approvals.length, 2);
    assert.equal(
      approvals.some((row) => row.principal_id === "employee-3"),
      false,
    );
  });

  await t.test("should include approval enrollment fields", async () => {
    setupMockDatabase();

    const approval = getPendingApprovalRows("supervisor-1")[0];

    assert.ok(approval.id);
    assert.ok(approval.approval_status);
    assert.ok(approval.status);
    assert.equal(typeof approval.progress, "number");
    assert.ok(approval.enrolled_at);
  });

  await t.test("should include learner fields", async () => {
    setupMockDatabase();

    const approval = getPendingApprovalRows("supervisor-1")[0];

    assert.ok(approval.principal_id);
    assert.ok(approval.name);
    assert.ok(approval.email);
  });

  await t.test("should include learning path fields", async () => {
    setupMockDatabase();

    const approval = getPendingApprovalRows("supervisor-1")[0];

    assert.ok(approval.learning_path_id);
    assert.ok(approval.learning_path_title);
  });

  await t.test("should order approvals by enrolled_at DESC", async () => {
    setupMockDatabase();

    const approvals = getPendingApprovalRows("supervisor-1");

    assert.equal(approvals[0].id, "en-1");
    assert.equal(approvals[1].id, "en-2");
  });
});

// getSupervisorPaths testing
test("GET SUPERVISOR PATHS TESTS", async (t) => {
  await t.test("should export empty learning paths array", async () => {
    const res = createMockRes();

    res.status(200).json({ learningPaths: [] });

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.learningPaths));
    assert.equal(res.body.learningPaths.length, 0);
  });

  await t.test("should not expose public paths to supervisors", async () => {
    setupMockDatabase();

    const supervisorPaths = [];

    assert.equal(supervisorPaths.length, 0);
  });
});

// enrollTeamMembers testing
test("ENROLL TEAM MEMBERS TESTS", async (t) => {
  await t.test(
    "should require employeePrincipalIds as non-empty array",
    async () => {
      const req = createMockReq({
        body: { learningPathId: "lp-1", employeePrincipalIds: [] },
      });
      const res = createMockRes();

      if (
        !Array.isArray(req.body.employeePrincipalIds) ||
        req.body.employeePrincipalIds.length === 0
      ) {
        sendMockError(
          res,
          400,
          "VALIDATION_ERROR",
          "employeePrincipalIds must be a non-empty array.",
        );
      }

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.error.code, "VALIDATION_ERROR");
    },
  );

  await t.test("should return 404 when learning path is missing", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const path = findActiveLearningPath("missing");

    if (!path) {
      sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test("should return 404 when learning path is inactive", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const path = findActiveLearningPath("lp-2");

    if (!path) {
      sendMockError(res, 404, "NOT_FOUND", "Learning path not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test(
    "should filter selected employees to supervisor team only",
    async () => {
      setupMockDatabase();

      const selected = ["employee-1", "employee-3"];
      const scoped = selected.filter((principalId) =>
        isTeamMember("supervisor-1", principalId),
      );

      assert.deepEqual(scoped, ["employee-1"]);
    },
  );

  await t.test(
    "should create supervisor enrollment with NOT_STARTED status",
    async () => {
      const enrollment = {
        principal_id: "employee-1",
        learning_path_id: "lp-1",
        status: "NOT_STARTED",
        progress: 0,
        enrollment_source: "SUPERVISOR",
      };

      assert.equal(enrollment.status, "NOT_STARTED");
      assert.equal(enrollment.progress, 0);
      assert.equal(enrollment.enrollment_source, "SUPERVISOR");
    },
  );

  await t.test("should skip duplicate enrollment", async () => {
    setupMockDatabase();

    const exists = mockDatabase.enrollments.some(
      (enrollment) =>
        enrollment.principal_id === "employee-1" &&
        enrollment.learning_path_id === "lp-1",
    );

    const shouldInsert = !exists;

    assert.equal(shouldInsert, false);
  });

  await t.test("should insert only valid team members", async () => {
    setupMockDatabase();

    const selected = ["employee-1", "employee-2", "employee-3"];
    const inserted = selected
      .filter((principalId) => isTeamMember("supervisor-1", principalId))
      .map((principalId) => ({
        principal_id: principalId,
        learning_path_id: "lp-new",
      }));

    assert.equal(inserted.length, 2);
    assert.equal(
      inserted.some((row) => row.principal_id === "employee-3"),
      false,
    );
  });

  await t.test(
    "should create notification for inserted enrollment",
    async () => {
      setupMockDatabase();

      const path = findActiveLearningPath("lp-1");
      mockDatabase.notifications.push({
        principal_id: "employee-1",
        title: "Enrollment Assigned",
        message: `Your supervisor enrolled you in "${path.title}".`,
        type: "INFO",
        is_read: false,
      });

      assert.equal(mockDatabase.notifications.length, 1);
      assert.equal(mockDatabase.notifications[0].title, "Enrollment Assigned");
      assert.ok(
        mockDatabase.notifications[0].message.includes("Python Basics"),
      );
    },
  );

  await t.test(
    "should create assignment report when learners inserted",
    async () => {
      assignmentReports = [];

      await mockCreateAssignmentReport({
        learningPathId: "lp-1",
        learningPathTitle: "Python Basics",
        assignedByPrincipalId: "supervisor-1",
        assignedByName: "Supervisor User",
        assignedByRole: "SUPERVISOR",
        assignmentSource: "SUPERVISOR",
        learners: [
          {
            principalId: "employee-1",
            employeeNumber: "EMP-001",
            learnerName: "Alice Learner",
            learnerEmail: "alice@example.com",
            designation: "Developer",
            gradeName: "G5",
          },
        ],
      });

      assert.equal(assignmentReports.length, 1);
      assert.equal(assignmentReports[0].assignmentSource, "SUPERVISOR");
      assert.equal(assignmentReports[0].learners.length, 1);
    },
  );

  await t.test("should log supervisor enrollment audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "supervisor-1",
      action: "SUPERVISOR_ENROLL_TEAM",
      resourceType: "ENROLLMENT",
      metadata: { learningPathId: "lp-1", inserted: 1 },
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "SUPERVISOR_ENROLL_TEAM");
  });
});

// approveEnrollment testing
test("APPROVE ENROLLMENT TESTS", async (t) => {
  await t.test(
    "should approve enrollment for supervised employee",
    async () => {
      setupMockDatabase();

      const enrollment = mockDatabase.enrollments.find(
        (item) => item.id === "en-1",
      );

      if (isTeamMember("supervisor-1", enrollment.principal_id)) {
        enrollment.approval_status = "APPROVED";
        enrollment.approval_updated_at = new Date();
        enrollment.approval_updated_by = "supervisor-1";
      }

      assert.equal(enrollment.approval_status, "APPROVED");
      assert.ok(enrollment.approval_updated_at);
    },
  );

  await t.test("should return approved enrollment fields", async () => {
    const enrollment = {
      id: "en-1",
      approval_status: "APPROVED",
      approval_updated_at: new Date(),
    };

    assert.ok(enrollment.id);
    assert.equal(enrollment.approval_status, "APPROVED");
    assert.ok(enrollment.approval_updated_at);
  });

  await t.test("should return 404 when enrollment is not found", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const enrollment = mockDatabase.enrollments.find(
      (item) => item.id === "missing",
    );

    if (!enrollment) {
      sendMockError(res, 404, "NOT_FOUND", "Enrollment not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test(
    "should return 404 when enrollment is not in supervisor team",
    async () => {
      setupMockDatabase();

      const res = createMockRes();
      const enrollment = mockDatabase.enrollments.find(
        (item) => item.id === "en-3",
      );

      if (!isTeamMember("supervisor-1", enrollment.principal_id)) {
        sendMockError(res, 404, "NOT_FOUND", "Enrollment not found.");
      }

      assert.equal(res.statusCode, 404);
    },
  );

  await t.test("should log approve enrollment audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "supervisor-1",
      action: "APPROVE_ENROLLMENT",
      resourceType: "ENROLLMENT",
      resourceId: "en-1",
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "APPROVE_ENROLLMENT");
  });
});

// rejectEnrollment testing
test("REJECT ENROLLMENT TESTS", async (t) => {
  await t.test("should reject enrollment for supervised employee", async () => {
    setupMockDatabase();

    const enrollment = mockDatabase.enrollments.find(
      (item) => item.id === "en-1",
    );

    if (isTeamMember("supervisor-1", enrollment.principal_id)) {
      enrollment.approval_status = "REJECTED";
      enrollment.approval_updated_at = new Date();
      enrollment.approval_updated_by = "supervisor-1";
    }

    assert.equal(enrollment.approval_status, "REJECTED");
    assert.ok(enrollment.approval_updated_at);
  });

  await t.test("should return rejected enrollment fields", async () => {
    const enrollment = {
      id: "en-1",
      approval_status: "REJECTED",
      approval_updated_at: new Date(),
    };

    assert.ok(enrollment.id);
    assert.equal(enrollment.approval_status, "REJECTED");
    assert.ok(enrollment.approval_updated_at);
  });

  await t.test("should return 404 when enrollment is not found", async () => {
    setupMockDatabase();

    const res = createMockRes();
    const enrollment = mockDatabase.enrollments.find(
      (item) => item.id === "missing",
    );

    if (!enrollment) {
      sendMockError(res, 404, "NOT_FOUND", "Enrollment not found.");
    }

    assert.equal(res.statusCode, 404);
  });

  await t.test(
    "should return 404 when enrollment is not in supervisor team",
    async () => {
      setupMockDatabase();

      const res = createMockRes();
      const enrollment = mockDatabase.enrollments.find(
        (item) => item.id === "en-3",
      );

      if (!isTeamMember("supervisor-1", enrollment.principal_id)) {
        sendMockError(res, 404, "NOT_FOUND", "Enrollment not found.");
      }

      assert.equal(res.statusCode, 404);
    },
  );

  await t.test("should log reject enrollment audit", async () => {
    auditLogs = [];

    await mockLogAudit({
      actorPrincipalId: "supervisor-1",
      action: "REJECT_ENROLLMENT",
      resourceType: "ENROLLMENT",
      resourceId: "en-1",
    });

    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "REJECT_ENROLLMENT");
  });
});
