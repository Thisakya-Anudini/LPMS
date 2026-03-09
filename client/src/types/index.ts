export type Role = 'SUPER_ADMIN' | 'LEARNING_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  principalType: 'USER' | 'EMPLOYEE';
  mustChangePassword: boolean;
  authSource?: 'SYSTEM' | 'MOCK_LEARNER';
  employeeNo?: string | null;
  isSupervisor?: boolean;
};

export type Course = {
  id: string;
  code: string;
  title: string;
  description: string;
  duration: string; // e.g., "2 hours"
  type: 'ONLINE' | 'CLASSROOM' | 'HYBRID';
};

export type Stage = {
  id: string;
  title: string;
  order: number;
  courses: Course[];
};

export type LPCategory = 'RESTRICTED' | 'SEMI_RESTRICTED' | 'PUBLIC';

export type LearningPath = {
  id: string;
  title: string;
  description: string;
  category: LPCategory;
  stages: Stage[];
  totalDuration: string;
  createdAt: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
};

export type EnrollmentStatus =
'NOT_STARTED' |
'IN_PROGRESS' |
'COMPLETED' |
'OVERDUE';

export type Enrollment = {
  id: string;
  principalId: string;
  learningPathId: string;
  status: EnrollmentStatus;
  progress: number; // 0-100
  enrolledAt: string;
  completedAt?: string;
};

export type Notification = {
  id: string;
  principalId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  createdAt: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};
