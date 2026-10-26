import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock services
vi.mock("../services/talentDashboard/aggregatesService.js", () => ({
  getKpiMetrics: vi.fn(),
  getTrendData: vi.fn(),
  getImmediateSubordinates: vi.fn(),
  getTopProgramsData: vi.fn(),
}));

vi.mock("../services/talentDashboard/historyService.js", () => ({
  getPaginatedTrainingHistory: vi.fn(),
  generateTrainingHistoryCsv: vi.fn(),
}));

vi.mock("../db.js", () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

vi.mock("../utils/erpClient.js", () => ({
  fetchAllDesignations: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("../utils/http.js", () => ({
  sendError: vi.fn((res, status, code, message) => {
    res.statusCode = status;
    res.body = { error: { code, message } };
    return res;
  }),
}));

import {
  getKpiMetrics,
  getTrendData,
  getImmediateSubordinates,
  getTopProgramsData,
} from "../services/talentDashboard/aggregatesService.js";
import {
  getPaginatedTrainingHistory,
  generateTrainingHistoryCsv,
} from "../services/talentDashboard/historyService.js";
import {
  getSubordinates,
  getHistory,
  exportHistory,
  getKpis,
  getTrend,
  getTopPrograms,
  getDesignations,
} from "../controllers/talentDashboardController.js";

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
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe("talentDashboardController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSubordinates", () => {
    it("should return immediate subordinates successfully", async () => {
      const mockSubordinates = [
        {
          employeeNumber: "EMP-1001",
          fullName: "Kasun Perera",
          designation: "Senior Software Engineer",
          department: "Digital Platforms",
          completedHours: 33,
          targetHours: 18,
          completionPercentage: 100,
        },
        {
          employeeNumber: "EMP-1002",
          fullName: "Dilini Fernando",
          designation: "QA Engineer",
          department: "Quality Assurance",
          completedHours: 25.5,
          targetHours: 18,
          completionPercentage: 100,
        },
      ];

      getImmediateSubordinates.mockResolvedValue(mockSubordinates);

      const req = {
        user: { id: "user-1", role: "SUPERVISOR", employeeNo: "EMP-001" },
        targetPrincipalId: "user-1",
        isSelfView: true,
        query: {
          startDate: "2026-01-01",
          endDate: "2026-03-31",
          trainingType: "ALL",
        },
      };
      const res = createMockRes();

      await getSubordinates(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockSubordinates);
      expect(getImmediateSubordinates).toHaveBeenCalledWith({
        callerRole: "SUPERVISOR",
        isLearningAdmin: false,
        isSelfView: true,
        targetPrincipalId: "user-1",
        employeeNumber: "EMP-001",
        filters: {
          startDate: "2026-01-01",
          endDate: "2026-03-31",
          trainingType: "ALL",
          staffCategory: undefined,
          designation: undefined,
        },
      });
    });

    it("should return 500 when getImmediateSubordinates fails", async () => {
      getImmediateSubordinates.mockRejectedValue(new Error("Database error"));

      const req = {
        user: { id: "user-1", role: "SUPERVISOR", employeeNo: "EMP-001" },
        targetPrincipalId: "user-1",
        isSelfView: true,
        query: {},
      };
      const res = createMockRes();

      await getSubordinates(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe("SUBORDINATES_FETCH_FAILED");
    });
  });

  describe("getHistory", () => {
    it("should return paginated training history successfully", async () => {
      const mockResult = {
        records: [
          {
            id: "rec-1",
            employeeNumber: "EMP-1001",
            fullName: "Kasun Perera",
            designation: "Senior Software Engineer",
            department: "Digital Platforms",
            programName: "Kubernetes & Docker",
            trainingType: "ONLINE",
            startDate: "2026-02-15",
            endDate: "2026-02-25",
            durationHours: 20.0,
            status: "COMPLETED",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      getPaginatedTrainingHistory.mockResolvedValue(mockResult);

      const req = {
        user: { id: "user-1", role: "SUPERVISOR", employeeNo: "EMP-001" },
        targetPrincipalId: "user-1",
        isSelfView: true,
        query: {
          page: "1",
          pageSize: "10",
          sortBy: "startDate",
          sortOrder: "DESC",
          search: "Kubernetes",
        },
      };
      const res = createMockRes();

      await getHistory(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(getPaginatedTrainingHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          page: "1",
          pageSize: "10",
          sortBy: "startDate",
          sortOrder: "DESC",
          filters: expect.objectContaining({ search: "Kubernetes" }),
        })
      );
    });

    it("should return 500 when getHistory fails", async () => {
      getPaginatedTrainingHistory.mockRejectedValue(new Error("Query failed"));

      const req = {
        user: { id: "user-1", role: "SUPERVISOR", employeeNo: "EMP-001" },
        targetPrincipalId: "user-1",
        isSelfView: true,
        query: {},
      };
      const res = createMockRes();

      await getHistory(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe("HISTORY_FETCH_FAILED");
    });
  });

  describe("exportHistory", () => {
    it("should stream RFC 4180 CSV attachment with proper headers", async () => {
      const mockCsv = '\uFEFF"Record ID","Employee Number","Full Name"\r\n"1","EMP-1001","Kasun Perera"';
      generateTrainingHistoryCsv.mockResolvedValue(mockCsv);

      const req = {
        user: { id: "user-1", role: "SUPERVISOR", employeeNo: "EMP-001" },
        targetPrincipalId: "user-1",
        isSelfView: true,
        query: {
          trainingType: "ONLINE",
        },
      };
      const res = createMockRes();

      await exportHistory(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toBe("text/csv; charset=utf-8");
      expect(res.headers["Content-Disposition"]).toMatch(/^attachment; filename="talent_training_history_/);
      expect(res.body).toBe(mockCsv);
    });

    it("should return 500 when exportHistory fails", async () => {
      generateTrainingHistoryCsv.mockRejectedValue(new Error("CSV error"));

      const req = {
        user: { id: "user-1", role: "SUPERVISOR", employeeNo: "EMP-001" },
        targetPrincipalId: "user-1",
        isSelfView: true,
        query: {},
      };
      const res = createMockRes();

      await exportHistory(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe("HISTORY_EXPORT_FAILED");
    });
  });

  describe("getKpis", () => {
    it("should return KPI metrics successfully", async () => {
      const mockMetrics = {
        totalStaff: 5,
        totalTrainingHours: 139,
        averageTrainingHours: 27.8,
        selfTrainingHours: 16.5,
        targetHours: 18.0,
      };

      getKpiMetrics.mockResolvedValue(mockMetrics);

      const req = {
        user: { id: "user-1", role: "SUPERVISOR", employeeNo: "EMP-001" },
        targetPrincipalId: "user-1",
        isSelfView: true,
        query: {},
      };
      const res = createMockRes();

      await getKpis(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual(mockMetrics);
    });
  });

  describe("getTopPrograms", () => {
    it("should return top 5 training programs successfully", async () => {
      const mockPrograms = [
        {
          programId: "p1",
          programName: "Advanced React",
          participantCount: 5,
          totalCompletedHours: 40,
          percentageOfTop5: 45.2,
        },
      ];

      getTopProgramsData.mockResolvedValue(mockPrograms);

      const req = {
        user: { id: "user-1", role: "SUPERVISOR", employeeNo: "EMP-001" },
        targetPrincipalId: "user-1",
        isSelfView: true,
        query: {},
      };
      const res = createMockRes();

      await getTopPrograms(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual(mockPrograms);
    });
  });
});
