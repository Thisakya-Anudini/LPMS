import { AuthResponse, Role, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

const parseApiError = async (response: Response) => {
  try {
    const payload = await response.json();
    if (payload?.error?.message) {
      if (payload.error.details) {
        const detailsText =
          typeof payload.error.details === 'string'
            ? payload.error.details
            : JSON.stringify(payload.error.details);
        return `${payload.error.message} (${detailsText})` as string;
      }
      return payload.error.message as string;
    }
  } catch {
    return `Request failed with status ${response.status}`;
  }
  return `Request failed with status ${response.status}`;
};

const request = async <T>(path: string, options: RequestOptions = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
};

export const authApi = {
  login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
  },
  refresh(refreshToken: string) {
    return request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken }
    });
  },
  logout(refreshToken: string) {
    return request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: { refreshToken }
    });
  },
  me(token: string) {
    return request<{ user: User }>('/auth/me', { token });
  },
  changePassword(token: string, oldPassword: string, newPassword: string) {
    return request<{ user: User }>('/auth/change-password', {
      method: 'PUT',
      token,
      body: { oldPassword, newPassword }
    });
  }
};

export const userApi = {
  listUsers(token: string) {
    return request<{ users: Array<{ id: string; name: string; email: string; role: Role; is_active: boolean }> }>('/users', { token });
  },
  createUser(
    token: string,
    payload: { name: string; email: string; password: string; role: Exclude<Role, 'EMPLOYEE'> }
  ) {
    return request<{ user: { id: string; name: string; email: string; role: Role; is_active: boolean } }>('/users', {
      method: 'POST',
      token,
      body: payload
    });
  },
  createEmployee(
    token: string,
    payload: {
      name: string;
      email: string;
      password: string;
      employeeNumber: string;
      designation: string;
      gradeName: string;
      supervisorId?: string;
    }
  ) {
    return request<{
      user: { id: string; name: string; email: string; role: Role };
      employee: { id: string; employee_number: string };
    }>('/employees', {
      method: 'POST',
      token,
      body: payload
    });
  }
};

export const learningApi = {
  getLearningPaths(token: string) {
    return request<{ learningPaths: Array<{ id: string; title: string; description: string; category: string; total_duration: string; status: string }> }>('/learning-paths', { token });
  },
  createLearningPath(
    token: string,
    payload: { title: string; description: string; category: 'RESTRICTED' | 'SEMI_RESTRICTED' | 'PUBLIC'; totalDuration: string }
  ) {
    return request<{ learningPath: { id: string } }>('/learning-paths', {
      method: 'POST',
      token,
      body: payload
    });
  },
  updateLearningPath(
    token: string,
    id: string,
    payload: { title: string; description: string; category: 'RESTRICTED' | 'SEMI_RESTRICTED' | 'PUBLIC'; totalDuration: string; status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' }
  ) {
    return request<{ learningPath: { id: string } }>(`/learning-paths/${id}`, {
      method: 'PUT',
      token,
      body: payload
    });
  },
  deleteLearningPath(token: string, id: string) {
    return request<{ success: boolean }>(`/learning-paths/${id}`, {
      method: 'DELETE',
      token
    });
  },
  getAssignableEmployees(token: string) {
    return request<{ employees: Array<{ id: string; name: string; email: string; employee_number: string; designation: string; grade_name: string }> }>('/employees', { token });
  },
  createEnrollments(token: string, payload: { learningPathId: string; employeePrincipalIds: string[] }) {
    return request<{ enrollments: Array<{ id: string }> }>('/enrollments', {
      method: 'POST',
      token,
      body: payload
    });
  },
  getSummaryReport(token: string) {
    return request<{
      summary: {
        totalPaths: number;
        activePaths: number;
        totalEnrollments: number;
        completedEnrollments: number;
        completionRate: number;
        totalCertificates: number;
      };
    }>('/reports/summary', { token });
  }
};

export const supervisorApi = {
  getTeamProgress(token: string) {
    return request<{ progress: Array<{ principal_id: string; name: string; email: string; total_enrollments: string; avg_progress: string; completed_count: string }> }>('/supervisor/team/progress', { token });
  },
  getApprovals(token: string) {
    return request<{
      approvals: Array<{
        id: string;
        approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
        status: string;
        progress: number;
        enrolled_at: string;
        principal_id: string;
        name: string;
        email: string;
        learning_path_id: string;
        learning_path_title: string;
      }>;
    }>('/supervisor/approvals', { token });
  },
  approveEnrollment(token: string, enrollmentId: string) {
    return request<{ enrollment: { id: string; approval_status: string } }>(
      `/supervisor/approvals/${enrollmentId}/approve`,
      { method: 'POST', token }
    );
  },
  rejectEnrollment(token: string, enrollmentId: string) {
    return request<{ enrollment: { id: string; approval_status: string } }>(
      `/supervisor/approvals/${enrollmentId}/reject`,
      { method: 'POST', token }
    );
  },
  getSupervisorPaths(token: string) {
    return request<{
      learningPaths: Array<{ id: string; title: string; description: string; category: string; status: string }>;
    }>('/supervisor/paths', { token });
  },
  enrollTeamMembers(token: string, payload: { learningPathId: string; employeePrincipalIds: string[] }) {
    return request<{ enrollments: Array<{ id: string }> }>('/supervisor/enrollments', {
      method: 'POST',
      token,
      body: payload
    });
  }
};

export const employeeApi = {
  getMyPaths(token: string) {
    return request<{ enrollments: Array<{ id: string; status: string; progress: number; enrolled_at: string; completed_at?: string; learning_path_id: string; title: string; description: string; total_duration: string }> }>('/employee/my-paths', { token });
  },
  getMyProgress(token: string) {
    return request<{ progress: { total_enrollments: string; completed_enrollments: string; average_progress: string } }>('/employee/my-progress', { token });
  },
  getNotifications(token: string) {
    return request<{ notifications: Array<{ id: string; title: string; message: string; type: string; is_read: boolean; created_at: string }> }>('/employee/notifications', { token });
  },
  getCertificates(token: string) {
    return request<{
      certificates: Array<{
        id: string;
        scope: 'STAGE' | 'FULL';
        issued_at: string;
        learning_path_id: string;
        learning_path_title: string;
      }>;
    }>('/employee/certificates', { token });
  },
  getPublicPaths(token: string) {
    return request<{
      learningPaths: Array<{
        id: string;
        title: string;
        description: string;
        category: string;
        total_duration: string;
        status: string;
        already_enrolled: boolean;
      }>;
    }>('/employee/public-paths', { token });
  },
  selfEnroll(token: string, learningPathId: string) {
    return request<{ enrollment: { id: string } }>('/employee/self-enroll', {
      method: 'POST',
      token,
      body: { learningPathId }
    });
  },
  updateMyProgress(token: string, enrollmentId: string, progress: number) {
    return request<{ enrollment: { id: string; progress: number; status: string; completed_at?: string } }>(
      `/employee/my-paths/${enrollmentId}/progress`,
      {
        method: 'PUT',
        token,
        body: { progress }
      }
    );
  }
};

export const integrationApi = {
  getErpSubordinates(token: string, employeeNo: string) {
    return request<{ source: 'ERP'; employeeNo: string; data: unknown }>('/integrations/erp/subordinates', {
      method: 'POST',
      token,
      body: { employeeNo }
    });
  },
  importErpEmployees(
    token: string,
    payload: {
      employees: Array<{
        employeeNumber: string;
        employeeName?: string | null;
        employeeInitials?: string | null;
        employeeSurname?: string | null;
        designation?: string | null;
        gradeName?: string | null;
        email?: string | null;
      }>;
      supervisorId?: string;
    }
  ) {
    return request<{
      success: boolean;
      importedCount: number;
      skippedCount: number;
      imported: Array<{ employeeNumber: string; email: string }>;
      skipped: Array<{ employeeNumber: string | null; reason: string }>;
    }>('/integrations/erp/import-employees', {
      method: 'POST',
      token,
      body: payload
    });
  }
};
