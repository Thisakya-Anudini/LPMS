export interface TalentKpiMetrics {
  totalStaff: number;
  totalTrainingHours: number;
  averageTrainingHours: number;
  selfTrainingHours: number;
  targetHours: number; // Constant: 18.0
}

export interface TalentFilterParams {
  startDate?: string;
  endDate?: string;
  trainingType?: string;
  staffCategory?: string;
  designation?: string;
  viewAsId?: string; // Subordinate drill-down ID
}

export interface TrendDataPoint {
  period: string; // e.g. "2026-01" (Monthly) or "2026" (Yearly)
  totalHours: number;
  averageHours: number;
}

export interface SubordinateProgress {
  employeeNumber: string;
  fullName: string;
  designation: string;
  department: string;
  completedHours: number;
  targetHours: number; // Constant: 18.0
  completionPercentage: number;
}

export interface TopTrainingProgram {
  programId: string;
  programName: string;
  totalCompletedHours: number;
  participantCount: number;
  percentageOfTop5: number;
}

export interface TrainingHistoryRecord {
  id: string;
  employeeNumber: string;
  fullName: string;
  designation: string;
  department: string;
  programName: string;
  trainingType: string;
  startDate: string;
  endDate: string;
  durationHours: number;
  status: "COMPLETED" | "IN_PROGRESS" | "EXPIRED";
}

export interface PaginatedHistoryResponse {
  records: TrainingHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
