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

vi.mock("../utils/assignmentReports.js", () => ({
  ASSIGNMENT_REPORT_SOURCE: {
    SUPERVISOR: "SUPERVISOR",
  },
  createAssignmentReport: vi.fn().mockResolvedValue(undefined),
}));

// Imports (after mocks)

import { query } from "../db.js";
import { sendError } from "../utils/http.js";
import { logAudit } from "../utils/audit.js";
import {
  ASSIGNMENT_REPORT_SOURCE,
  createAssignmentReport,
} from "../utils/assignmentReports.js";
import * as supervisorController from "../controllers/supervisorController.js";

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(query).mockReset();
  vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 });
});

// Export functions testing

describe("SUPERVISOR CONTROLLER EXPORTS", () => {
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
    it(`should export ${exportName}`, () => {
      expect(typeof supervisorController[exportName]).toBe("function");
    });
  }
});

// getTeam testing

describe("GET TEAM", () => {
  it("should return team members for current supervisor", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "emp-1",
          employee_number: "EMP-001",
          designation: "Developer",
          grade_name: "G5",
          principal_id: "employee-1",
          name: "Alice Learner",
          email: "alice@example.com",
        },
        {
          id: "emp-2",
          employee_number: "EMP-002",
          designation: "Analyst",
          grade_name: "G4",
          principal_id: "employee-2",
          name: "Bob Learner",
          email: "bob@example.com",
        },
      ],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeam(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.team).toHaveLength(2);
    const ids = res.body.team.map((m) => m.principal_id);
    expect(ids).not.toContain("employee-3");
  });

  it("should exclude employees from other supervisors", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "emp-1",
          employee_number: "EMP-001",
          designation: "Developer",
          grade_name: "G5",
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeam(req, res);

    expect(res.body.team.some((m) => m.employee_number === "EMP-003")).toBe(
      false,
    );
  });

  it("should order team members by name ASC", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "emp-1",
          employee_number: "EMP-001",
          designation: "Dev",
          grade_name: "G5",
          principal_id: "employee-1",
          name: "Alice Learner",
          email: "alice@test.com",
        },
        {
          id: "emp-2",
          employee_number: "EMP-002",
          designation: "Analyst",
          grade_name: "G4",
          principal_id: "employee-2",
          name: "Bob Learner",
          email: "bob@test.com",
        },
      ],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeam(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY ap.name ASC");
  });

  it("should include employee and principal fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "emp-1",
          employee_number: "EMP-001",
          designation: "Developer",
          grade_name: "G5",
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeam(req, res);

    const member = res.body.team[0];
    expect(member.id).toBe("emp-1");
    expect(member.employee_number).toBe("EMP-001");
    expect(member.designation).toBe("Developer");
    expect(member.grade_name).toBe("G5");
    expect(member.principal_id).toBe("employee-1");
    expect(member.name).toBe("Alice");
    expect(member.email).toBe("alice@test.com");
  });

  it("should return empty team for supervisor with no team", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "no-team-supervisor" } });
    const res = createMockRes();
    await supervisorController.getTeam(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.team).toEqual([]);
  });
});

// getTeamProgress testing

describe("GET TEAM PROGRESS", () => {
  it("should return progress for supervisor team only", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
          total_enrollments: 1,
          avg_progress: "50.00",
          completed_count: 0,
        },
        {
          principal_id: "employee-2",
          name: "Bob",
          email: "bob@test.com",
          total_enrollments: 1,
          avg_progress: "100.00",
          completed_count: 1,
        },
      ],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeamProgress(req, res);

    expect(res.body.progress).toHaveLength(2);
    expect(res.body.progress.some((r) => r.principal_id === "employee-3")).toBe(
      false,
    );
  });

  it("should calculate total enrollments", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
          total_enrollments: 1,
          avg_progress: "50.00",
          completed_count: 0,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeamProgress(req, res);

    const alice = res.body.progress[0];
    expect(alice.total_enrollments).toBe(1);
  });

  it("should calculate average progress", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          principal_id: "employee-2",
          name: "Bob",
          email: "bob@test.com",
          total_enrollments: 1,
          avg_progress: "100.00",
          completed_count: 1,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeamProgress(req, res);

    expect(res.body.progress[0].avg_progress).toBe("100.00");
  });

  it("should calculate completed count", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          principal_id: "employee-2",
          name: "Bob",
          email: "bob@test.com",
          total_enrollments: 1,
          avg_progress: "100.00",
          completed_count: 1,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeamProgress(req, res);

    expect(res.body.progress[0].completed_count).toBe(1);
  });

  it("should return zero progress for team member with no enrollments", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          principal_id: "employee-4",
          name: "No Enrollment",
          email: "none@test.com",
          total_enrollments: 0,
          avg_progress: "0.00",
          completed_count: 0,
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getTeamProgress(req, res);

    const member = res.body.progress[0];
    expect(member.total_enrollments).toBe(0);
    expect(member.avg_progress).toBe("0.00");
    expect(member.completed_count).toBe(0);
  });

  it("should return empty progress array when team has no members", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ user: { id: "no-team-supervisor" } });
    const res = createMockRes();
    await supervisorController.getTeamProgress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.progress).toEqual([]);
  });
});

// getPendingApprovals testing

describe("GET PENDING APPROVALS", () => {
  it("should return approvals for supervisor team only", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "PENDING",
          status: "IN_PROGRESS",
          progress: 50,
          enrolled_at: new Date(),
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
        },
        {
          id: "en-2",
          approval_status: "PENDING",
          status: "COMPLETED",
          progress: 100,
          enrolled_at: new Date(),
          principal_id: "employee-2",
          name: "Bob",
          email: "bob@test.com",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
        },
      ],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getPendingApprovals(req, res);

    expect(res.body.approvals).toHaveLength(2);
    expect(
      res.body.approvals.some((a) => a.principal_id === "employee-3"),
    ).toBe(false);
  });

  it("should include all enrollment fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "PENDING",
          status: "IN_PROGRESS",
          progress: 50,
          enrolled_at: new Date(),
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getPendingApprovals(req, res);

    const approval = res.body.approvals[0];
    expect(approval.id).toBe("en-1");
    expect(approval.approval_status).toBe("PENDING");
    expect(approval.status).toBe("IN_PROGRESS");
    expect(typeof approval.progress).toBe("number");
    expect(approval.enrolled_at).toBeDefined();
  });

  it("should include learner fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "PENDING",
          status: "IN_PROGRESS",
          progress: 50,
          enrolled_at: new Date(),
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getPendingApprovals(req, res);

    const approval = res.body.approvals[0];
    expect(approval.principal_id).toBe("employee-1");
    expect(approval.name).toBe("Alice");
    expect(approval.email).toBe("alice@test.com");
  });

  it("should include learning path fields", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "PENDING",
          status: "IN_PROGRESS",
          progress: 50,
          enrolled_at: new Date(),
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getPendingApprovals(req, res);

    const approval = res.body.approvals[0];
    expect(approval.learning_path_id).toBe("lp-1");
    expect(approval.learning_path_title).toBe("Python Basics");
  });

  it("should order approvals by enrolled_at DESC", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "PENDING",
          status: "IN_PROGRESS",
          progress: 50,
          enrolled_at: new Date(),
          principal_id: "employee-1",
          name: "Alice",
          email: "alice@test.com",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
        },
        {
          id: "en-2",
          approval_status: "PENDING",
          status: "COMPLETED",
          progress: 100,
          enrolled_at: new Date(),
          principal_id: "employee-2",
          name: "Bob",
          email: "bob@test.com",
          learning_path_id: "lp-1",
          learning_path_title: "Python Basics",
        },
      ],
      rowCount: 2,
    });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getPendingApprovals(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("ORDER BY en.enrolled_at DESC");
  });

  it("should return empty approvals array when no pending items exist", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getPendingApprovals(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.approvals).toEqual([]);
  });
});

// getSupervisorPaths testing

describe("GET SUPERVISOR PATHS", () => {
  it("should return empty learning paths array", async () => {
    const req = createMockReq();
    const res = createMockRes();
    await supervisorController.getSupervisorPaths(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.learningPaths).toEqual([]);
  });
});

// enrollTeamMembers testing

describe("ENROLL TEAM MEMBERS", () => {
  it("should require employeePrincipalIds as non-empty array", async () => {
    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: [] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 when learning path is missing", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: { learningPathId: "missing", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 404 when learning path is inactive or deleted", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: { learningPathId: "lp-2", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("should filter selected employees to supervisor team only", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        learningPathId: "lp-1",
        employeePrincipalIds: ["employee-1", "employee-3"],
      },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    const sql = vi.mocked(query).mock.calls[1][0];
    expect(sql).toContain("WHERE e.supervisor_id = $1");
  });

  it("should create supervisor enrollment with NOT_STARTED status and SUPERVISOR source", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "en-new",
            principal_id: "employee-1",
            learning_path_id: "lp-1",
            status: "NOT_STARTED",
            progress: 0,
            enrolled_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.enrollments).toHaveLength(1);
    expect(res.body.enrollments[0].status).toBe("NOT_STARTED");
  });

  it("should skip duplicate enrollment (ON CONFLICT DO NOTHING)", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    const sql = vi.mocked(query).mock.calls[2][0];
    expect(sql).toContain("ON CONFLICT");
    expect(res.body.enrollments).toEqual([]);
  });

  it("should insert only valid team members", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
          {
            principal_id: "employee-2",
            employee_number: "EMP-002",
            designation: "Analyst",
            grade_name: "G4",
            name: "Bob",
            email: "bob@test.com",
          },
        ],
        rowCount: 2,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "en-new",
            principal_id: "employee-1",
            learning_path_id: "lp-1",
            status: "NOT_STARTED",
            progress: 0,
            enrolled_at: new Date(),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "en-new2",
            principal_id: "employee-2",
            learning_path_id: "lp-1",
            status: "NOT_STARTED",
            progress: 0,
            enrolled_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: {
        learningPathId: "lp-1",
        employeePrincipalIds: ["employee-1", "employee-2", "employee-3"],
      },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(res.body.enrollments).toHaveLength(2);
  });

  it("should create notification for inserted enrollment", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "en-new",
            principal_id: "employee-1",
            learning_path_id: "lp-1",
            status: "NOT_STARTED",
            progress: 0,
            enrolled_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    const notifSql = vi.mocked(query).mock.calls[3][0];
    expect(notifSql).toContain("INSERT INTO notifications");
    expect(notifSql).toContain("Enrollment Assigned");
  });

  it("should create assignment report when learners inserted", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "en-new",
            principal_id: "employee-1",
            learning_path_id: "lp-1",
            status: "NOT_STARTED",
            progress: 0,
            enrolled_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(vi.mocked(createAssignmentReport).mock.calls[0][0]).toMatchObject({
      learningPathId: "lp-1",
      learningPathTitle: "Python Basics",
      assignedByRole: "SUPERVISOR",
      assignmentSource: "SUPERVISOR",
      learners: expect.arrayContaining([
        expect.objectContaining({ principalId: "employee-1" }),
      ]),
    });
  });

  it("should log supervisor enrollment audit", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "en-new",
            principal_id: "employee-1",
            learning_path_id: "lp-1",
            status: "NOT_STARTED",
            progress: 0,
            enrolled_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "supervisor-1",
      action: "SUPERVISOR_ENROLL_TEAM",
      resourceType: "ENROLLMENT",
      metadata: { learningPathId: "lp-1", inserted: 1 },
    });
  });

  it("should use ON CONFLICT DO NOTHING in SQL", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "en-new",
            principal_id: "employee-1",
            learning_path_id: "lp-1",
            status: "NOT_STARTED",
            progress: 0,
            enrolled_at: new Date(),
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    const sql = vi.mocked(query).mock.calls[2][0];
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("DO NOTHING");
  });

  it("should return 404 when learningPathId is missing (no pre-validation)", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: { employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 400 when employeePrincipalIds is not an array", async () => {
    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: "not-an-array" },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should skip all non-team members and return empty enrollments array", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      });

    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: ["employee-3"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.enrollments).toEqual([]);
  });

  it("should not create assignment report when no learners were inserted", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ id: "lp-1", title: "Python Basics", category: "PUBLIC" }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_id: "employee-1",
            employee_number: "EMP-001",
            designation: "Developer",
            grade_name: "G5",
            name: "Alice",
            email: "alice@test.com",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({
      body: { learningPathId: "lp-1", employeePrincipalIds: ["employee-1"] },
    });
    const res = createMockRes();
    await supervisorController.enrollTeamMembers(req, res);

    expect(vi.mocked(createAssignmentReport)).not.toHaveBeenCalled();
    expect(res.body.enrollments).toEqual([]);
  });
});

// approveEnrollment testing

describe("APPROVE ENROLLMENT", () => {
  it("should approve enrollment for supervised employee", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "APPROVED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollment.approval_status).toBe("APPROVED");
  });

  it("should include principal_id IN subquery for supervisor team check", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "APPROVED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("principal_id IN");
    expect(sql).toContain("SELECT e.principal_id");
    expect(sql).toContain("WHERE e.supervisor_id = $2");
  });

  it("should return 404 when enrollment is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { id: "missing" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 404 when enrollment is not in supervisor team", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { id: "en-3" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should log approve enrollment audit", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "APPROVED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "supervisor-1",
      action: "APPROVE_ENROLLMENT",
      resourceType: "ENROLLMENT",
      resourceId: "en-1",
    });
  });

  it("should return updated enrollment fields", async () => {
    const now = new Date();
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { id: "en-1", approval_status: "APPROVED", approval_updated_at: now },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    expect(res.body.enrollment.id).toBe("en-1");
    expect(res.body.enrollment.approval_status).toBe("APPROVED");
    expect(res.body.enrollment.approval_updated_at).toBeDefined();
  });

  it("should be idempotent — approving already approved enrollment returns success", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "APPROVED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollment.approval_status).toBe("APPROVED");
  });

  it("should verify supervisor_id parameter matches authenticated user", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "APPROVED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    const params = vi.mocked(query).mock.calls[0][1];
    expect(params[0]).toBe("en-1");
    expect(params[1]).toBe("supervisor-1");
  });

  it("should update approval_updated_at via SQL (NOW())", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "APPROVED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.approveEnrollment(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("approval_updated_at = NOW()");
  });
});

// rejectEnrollment testing

describe("REJECT ENROLLMENT", () => {
  it("should reject enrollment for supervised employee", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "REJECTED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.rejectEnrollment(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollment.approval_status).toBe("REJECTED");
  });

  it("should include principal_id IN subquery for supervisor team check", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "REJECTED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.rejectEnrollment(req, res);

    const sql = vi.mocked(query).mock.calls[0][0];
    expect(sql).toContain("principal_id IN");
    expect(sql).toContain("WHERE e.supervisor_id = $2");
  });

  it("should return 404 when enrollment is not found", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { id: "missing" } });
    const res = createMockRes();
    await supervisorController.rejectEnrollment(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 404 when enrollment is not in supervisor team", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = createMockReq({ params: { id: "en-3" } });
    const res = createMockRes();
    await supervisorController.rejectEnrollment(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should log reject enrollment audit", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "REJECTED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.rejectEnrollment(req, res);

    expect(vi.mocked(logAudit).mock.calls[0][0]).toMatchObject({
      actorPrincipalId: "supervisor-1",
      action: "REJECT_ENROLLMENT",
      resourceType: "ENROLLMENT",
      resourceId: "en-1",
    });
  });

  it("should return updated enrollment fields", async () => {
    const now = new Date();
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { id: "en-1", approval_status: "REJECTED", approval_updated_at: now },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.rejectEnrollment(req, res);

    expect(res.body.enrollment.id).toBe("en-1");
    expect(res.body.enrollment.approval_status).toBe("REJECTED");
    expect(res.body.enrollment.approval_updated_at).toBeDefined();
  });

  it("should be idempotent — rejecting already rejected enrollment returns success", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "REJECTED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.rejectEnrollment(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enrollment.approval_status).toBe("REJECTED");
  });

  it("should update approval_updated_by to supervisor's id", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "en-1",
          approval_status: "REJECTED",
          approval_updated_at: new Date(),
        },
      ],
      rowCount: 1,
    });

    const req = createMockReq({ params: { id: "en-1" } });
    const res = createMockRes();
    await supervisorController.rejectEnrollment(req, res);

    const params = vi.mocked(query).mock.calls[0][1];
    expect(params[1]).toBe("supervisor-1");
  });
});

// Security Gaps

describe("SUPERVISOR AUTHORIZATION GAPS", () => {
  it("GAP: getTeam does not verify req.user.role is SUPERVISOR", () => {
    expect(typeof supervisorController.getTeam).toBe("function");
  });

  it("GAP: enrollTeamMembers does not check if learning path is PUBLIC", () => {
    expect(typeof supervisorController.enrollTeamMembers).toBe("function");
  });
});
