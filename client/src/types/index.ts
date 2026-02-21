export type Role = 'SUPER_ADMIN' | 'LEARNING_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  designation?: string;
  department?: string;
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
  userId: string;
  learningPathId: string;
  status: EnrollmentStatus;
  progress: number; // 0-100
  enrolledAt: string;
  completedAt?: string;
  currentStageId?: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  createdAt: string;
};