import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserCheck, Users } from 'lucide-react';
import { learningApi, superAdminApi, userApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'LEARNING_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
  is_active: boolean;
};

type AssignableEmployeeRow = {
  employeeNumber: string;
  employeeName: string;
  employeeSurname: string;
  email: string;
  designation: string;
  grade_name: string;
  gradeName: string;
  organizationName: string;
  costCenterCode: string;
  costCenterName: string;
  employeeInitials: string;
  employeeSupervisorNumber: string;
  isLearningAdmin?: boolean;
};

type AssignedLearningAdminRow = {
  employee_number: string;
  principal_id: string;
  designation: string;
  grade_name: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const roleSections: {
  key: UserRow['role'];
  label: string;
  panelClass: string;
  headingClass: string;
  headRowClass: string;
}[] = [
  {
    key: 'SUPER_ADMIN',
    label: 'Super Admins',
    panelClass: 'border-blue-200 bg-blue-50/40',
    headingClass: 'text-blue-800',
    headRowClass: 'bg-blue-100/80 text-blue-900'
  }
];

const initialUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'SUPER_ADMIN'
};

export function AdminDashboard() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [assignedLearningAdmins, setAssignedLearningAdmins] = useState<AssignedLearningAdminRow[]>([]);
  const [learnerTotal, setLearnerTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserRow | null>(null);

  const [userForm, setUserForm] = useState(initialUserForm);
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [assignSearchLoading, setAssignSearchLoading] = useState(false);
  const [assignEmployeeNoSearch, setAssignEmployeeNoSearch] = useState('');
  const [assignSurnameSearch, setAssignSurnameSearch] = useState('');
  const [assignDesignationFilter, setAssignDesignationFilter] = useState('');
  const [assignGradeFilter, setAssignGradeFilter] = useState('');
  const [assignOrganizationFilter, setAssignOrganizationFilter] = useState('');
  const [assignPayrollFilter, setAssignPayrollFilter] = useState('');
  const [erpEmployees, setErpEmployees] = useState<AssignableEmployeeRow[]>([]);
  const [designationOptions, setDesignationOptions] = useState<string[]>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([]);
  const [organizationOptions, setOrganizationOptions] = useState<
    Array<{ organizationId: string; organizationName: string; parentOrganizationName: string }>
  >([]);
  const recentUsersSkeletonRows = Array.from({ length: 3 }, (_, index) => index);
  const assignResultsSkeletonRows = Array.from({ length: 5 }, (_, index) => index);
  const hasAssignEmployeeNoSearch = assignEmployeeNoSearch.trim().length > 0;
  const hasAssignNameSearch = assignSurnameSearch.trim().length > 0;
  const hasAssignFilterSearch =
    Boolean(assignDesignationFilter) ||
    Boolean(assignGradeFilter) ||
    Boolean(assignOrganizationFilter) ||
    Boolean(assignPayrollFilter);

  const clearAssignFilters = () => {
    setAssignDesignationFilter('');
    setAssignGradeFilter('');
    setAssignOrganizationFilter('');
    setAssignPayrollFilter('');
  };

  const activateAssignEmployeeSearch = () => {
    if (hasAssignNameSearch) {
      setAssignSurnameSearch('');
    }
    if (hasAssignFilterSearch) {
      clearAssignFilters();
    }
  };

  const activateAssignNameSearch = () => {
    if (hasAssignEmployeeNoSearch) {
      setAssignEmployeeNoSearch('');
    }
    if (hasAssignFilterSearch) {
      clearAssignFilters();
    }
  };

  const activateAssignFilterSearch = () => {
    if (hasAssignEmployeeNoSearch) {
      setAssignEmployeeNoSearch('');
    }
    if (hasAssignNameSearch) {
      setAssignSurnameSearch('');
    }
  };

  const handleAssignEmployeeNoChange = (value: string) => {
    if (value.trim()) {
      activateAssignEmployeeSearch();
    }
    setAssignEmployeeNoSearch(value);
  };

  const handleAssignNameSearchChange = (value: string) => {
    if (value.trim()) {
      activateAssignNameSearch();
    }
    setAssignSurnameSearch(value);
  };

  const handleAssignDesignationChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignDesignationFilter(value);
  };

  const handleAssignGradeChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignGradeFilter(value);
  };

  const handleAssignOrganizationChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignOrganizationFilter(value);
  };

  const handleAssignPayrollChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignPayrollFilter(value);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await userApi.listUsers(token);
      setUsers(response.users);
      const [learnerResponse, searchOptions, learningAdminAssignments] = await Promise.all([
        superAdminApi.getLearners(token, {
          page: 1,
          pageSize: 50
        }),
        learningApi.getAssignableEmployeeSearchOptions(token),
        superAdminApi.getAssignedLearningAdmins(token)
      ]);
      setLearnerTotal(learnerResponse.pagination.total);
      setDesignationOptions(searchOptions.designations);
      setGradeOptions(searchOptions.grades);
      setOrganizationOptions(searchOptions.organizations);
      setAssignedLearningAdmins(learningAdminAssignments.learningAdmins);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const superAdminCount = users.filter((user) => user.role === 'SUPER_ADMIN').length;
  const learningAdminCount = assignedLearningAdmins.length;
  const usersByRole = useMemo(
    () =>
      roleSections.map((section) => ({
        ...section,
        users: users.filter((user) => user.role === section.key)
      })),
    [users]
  );

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserFormLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      await userApi.createUser(token, { ...userForm, role: 'SUPER_ADMIN' });
      showToast('User account created successfully.', 'success');
      setUserForm(initialUserForm);
      await loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create user.', 'error');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      await userApi.deleteUser(token, id);
      showToast('Account deleted successfully.', 'success');
      setPendingDeleteUser(null);
      await loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete account.', 'error');
    }
  };

  const handleAssignSearch = async () => {
    try {
      setAssignSearchLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learningApi.searchAssignableEmployees(token, {
        employeeNo: assignEmployeeNoSearch,
        surname: assignSurnameSearch,
        designation: assignDesignationFilter,
        grade: assignGradeFilter,
        organizationName: assignOrganizationFilter,
        payrollType: assignPayrollFilter as '' | 'EXECUTIVE' | 'NON_EXECUTIVE'
      });

      setErpEmployees(response.employees as AssignableEmployeeRow[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to search ERP employees.', 'error');
    } finally {
      setAssignSearchLoading(false);
    }
  };

  const handleAssignLearningAdmin = async (employee: AssignableEmployeeRow, shouldAssign: boolean) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      if (shouldAssign) {
        await superAdminApi.assignLearningAdmin(token, employee.employeeNumber, employee);
        showToast('Employee assigned as Learning Admin.', 'success');
      } else {
        await superAdminApi.removeLearningAdmin(token, employee.employeeNumber);
        showToast('Learning Admin access removed.', 'success');
      }
      setErpEmployees((prev) =>
        prev.map((item) =>
          item.employeeNumber === employee.employeeNumber
            ? { ...item, isLearningAdmin: shouldAssign }
            : item
        )
      );
      await loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update Learning Admin assignment.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Accounts</h1>
        <p className="text-slate-500">Create and manage Super Admin and Learning Admin accounts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Super Admins</p>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-slate-900">{superAdminCount}</p>
              )}
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm text-slate-500">Learning Admins</p>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-slate-900">{learningAdminCount}</p>
              )}
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-sm text-slate-500">Learners</p>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold text-slate-900">{learnerTotal}</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Create Super Admin Accounts ">
        <form className="space-y-4" onSubmit={handleCreateUser}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name"
              value={userForm.name}
              onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <Input
              label="Email"
              type="email"
              value={userForm.email}
              onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
            <Input
              label="Password"
              type="password"
              value={userForm.password}
              onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </div>
          
          <Button type="submit" isLoading={userFormLoading}>
            Create Super Admin
          </Button>
        </form>
      </Card>

      <Card title="Assign Learning Admin Access">
        <div className="border border-slate-200 rounded-md bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 border-b border-slate-200">
            <Input
              label="Search by Employee No"
              value={assignEmployeeNoSearch}
              onFocus={activateAssignEmployeeSearch}
              onChange={(event) => handleAssignEmployeeNoChange(event.target.value)}
              placeholder="e.g. 011338"
            />
            <Input
              label="Search by Name"
              value={assignSurnameSearch}
              onFocus={activateAssignNameSearch}
              onChange={(event) => handleAssignNameSearchChange(event.target.value)}
              placeholder="e.g. Mohamed"
            />
            <Select
              label="Filter by Designation"
              value={assignDesignationFilter}
              onFocus={activateAssignFilterSearch}
              onChange={(event) => handleAssignDesignationChange(event.target.value)}
              options={[
                { value: '', label: 'All Designations' },
                ...designationOptions.map((option) => ({ value: option, label: option }))
              ]}
            />
            <Select
              label="Filter by Grade"
              value={assignGradeFilter}
              onFocus={activateAssignFilterSearch}
              onChange={(event) => handleAssignGradeChange(event.target.value)}
              options={[
                { value: '', label: 'All Grades' },
                ...gradeOptions.map((option) => ({ value: option, label: option }))
              ]}
            />
            <Select
              label="Filter by Organization"
              value={assignOrganizationFilter}
              onFocus={activateAssignFilterSearch}
              onChange={(event) => handleAssignOrganizationChange(event.target.value)}
              options={[
                { value: '', label: 'All Organizations' },
                ...organizationOptions.map((option) => ({
                  value: option.organizationName,
                  label: option.parentOrganizationName
                    ? `${option.organizationName} (${option.parentOrganizationName})`
                    : option.organizationName
                }))
              ]}
            />
            <Select
              label="Executive / Non Executive"
              value={assignPayrollFilter}
              onFocus={activateAssignFilterSearch}
              onChange={(event) => handleAssignPayrollChange(event.target.value)}
              options={[
                { value: '', label: 'All Payrolls' },
                { value: 'EXECUTIVE', label: 'Executive' },
                { value: 'NON_EXECUTIVE', label: 'Non Executive' }
              ]}
            />
          </div>

          <div className="flex justify-end px-3 py-2 border-b border-slate-200 bg-slate-50/70">
            <Button
              type="button"
              onClick={handleAssignSearch}
              isLoading={assignSearchLoading}
              disabled={
                !assignEmployeeNoSearch.trim() &&
                !assignSurnameSearch.trim() &&
                !assignDesignationFilter &&
                !assignGradeFilter &&
                !assignOrganizationFilter &&
                !assignPayrollFilter
              }
            >
              Search
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200">
            <p className="text-xs text-slate-500">ERP results: {erpEmployees.length}</p>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {assignSearchLoading ? (
              <div className="min-w-[1080px]">
                <div className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.8fr_1.4fr_1.2fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Name</span>
                  <span>Emp No</span>
                  <span>Designation</span>
                  <span>Grade</span>
                  <span>Organization</span>
                  <span>Email</span>
                  <span>Learning Admin</span>
                </div>
                {assignResultsSkeletonRows.map((row) => (
                  <div
                    key={`assign-skeleton-${row}`}
                    className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.8fr_1.4fr_1.2fr_0.9fr] items-center gap-3 border-b border-slate-100 px-3 py-3"
                  >
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : erpEmployees.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">Search ERP to load employees for Learning Admin assignment.</p>
            ) : (
              <div className="min-w-[1080px]">
                <div className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.8fr_1.4fr_1.2fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Name</span>
                  <span>Emp No</span>
                  <span>Designation</span>
                  <span>Grade</span>
                  <span>Organization</span>
                  <span>Email</span>
                  <span>Learning Admin</span>
                </div>
                {erpEmployees.map((employee) => (
                  <div
                    key={employee.employeeNumber}
                    className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.8fr_1.4fr_1.2fr_0.9fr] items-center gap-3 border-b border-slate-100 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{employee.employeeName}</span>
                    <span>{employee.employeeNumber}</span>
                    <span>{employee.designation || '-'}</span>
                    <span>{employee.gradeName || '-'}</span>
                    <span>{employee.organizationName || '-'}</span>
                    <span>{employee.email || '-'}</span>
                    <span>
                      {employee.isLearningAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignLearningAdmin(employee, false)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAssignLearningAdmin(employee, true)}
                        >
                          Assign
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card >
        <div className="space-y-8">
          {usersByRole.map((section) => (
            <div key={section.key} className={`rounded-lg border p-4 md:p-5 space-y-3 ${section.panelClass}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className={`text-base md:text-lg font-bold tracking-wide ${section.headingClass}`}>
                  {section.label}
                </h3>
                <span className="text-xs md:text-sm font-medium text-slate-600">{section.users.length} users</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className={`text-left border-b border-slate-200 ${section.headRowClass}`}>
                      <th className="py-2.5 px-3 w-1/4 font-semibold">Name</th>
                      <th className="py-2.5 px-3 w-2/5 font-semibold">Email</th>
                      <th className="py-2.5 px-3 w-1/5 font-semibold">Status</th>
                      <th className="py-2.5 px-3 w-1/6 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      recentUsersSkeletonRows.map((row) => (
                        <tr key={`${section.key}-skeleton-${row}`} className="border-b border-slate-100">
                          <td className="py-2.5 px-3"><Skeleton className="h-5 w-28" /></td>
                          <td className="py-2.5 px-3"><Skeleton className="h-5 w-40" /></td>
                          <td className="py-2.5 px-3"><Skeleton className="h-5 w-16" /></td>
                          <td className="py-2.5 px-3"><Skeleton className="h-8 w-20 rounded-lg" /></td>
                        </tr>
                      ))
                    ) : section.users.length ? (
                      section.users.map((user) => (
                        <tr key={user.id} className="border-b border-slate-100">
                          <td className="py-2.5 px-3 font-medium text-slate-900">{user.name}</td>
                          <td className="py-2.5 px-3 text-slate-700 break-words">{user.email}</td>
                          <td className="py-2.5 px-3">
                            <span className={user.is_active ? 'text-green-700' : 'text-red-700'}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {user.is_active ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPendingDeleteUser(user)}
                              >
                                Delete
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-3 px-3 text-slate-500" colSpan={4}>
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 md:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base md:text-lg font-bold tracking-wide text-blue-800">
                Learning Admins
              </h3>
              <span className="text-xs md:text-sm font-medium text-slate-600">
                {assignedLearningAdmins.length} users
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="text-left border-b border-slate-200 bg-blue-100/80 text-blue-900">
                    <th className="py-2.5 px-3 w-1/4 font-semibold">Name</th>
                    <th className="py-2.5 px-3 w-2/5 font-semibold">Email</th>
                    <th className="py-2.5 px-3 w-1/5 font-semibold">Status</th>
                    <th className="py-2.5 px-3 w-1/6 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    recentUsersSkeletonRows.map((row) => (
                      <tr key={`learning-admin-skeleton-${row}`} className="border-b border-slate-100">
                        <td className="py-2.5 px-3">
                          <Skeleton className="mb-2 h-5 w-28" />
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="py-2.5 px-3"><Skeleton className="h-5 w-40" /></td>
                        <td className="py-2.5 px-3"><Skeleton className="h-5 w-16" /></td>
                        <td className="py-2.5 px-3"><Skeleton className="h-8 w-20 rounded-lg" /></td>
                      </tr>
                    ))
                  ) : assignedLearningAdmins.length ? (
                    assignedLearningAdmins.map((admin) => (
                      <tr key={admin.employee_number} className="border-b border-slate-100">
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-slate-900">{admin.name}</p>
                          <p className="text-xs text-slate-500">{admin.employee_number}</p>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 break-words">{admin.email}</td>
                        <td className="py-2.5 px-3">
                          <span className={admin.is_active ? 'text-green-700' : 'text-red-700'}>
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleAssignLearningAdmin(
                                {
                                  employeeNumber: admin.employee_number,
                                  employeeName: admin.name,
                                  employeeSurname: '',
                                  email: admin.email,
                                  designation: admin.designation,
                                  grade_name: admin.grade_name,
                                  gradeName: admin.grade_name,
                                  organizationName: '',
                                  costCenterCode: '',
                                  costCenterName: '',
                                  employeeInitials: '',
                                  employeeSupervisorNumber: '',
                                  isLearningAdmin: true
                                },
                                false
                              )
                            }
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3 px-3 text-slate-500" colSpan={4}>
                        No learning admins assigned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {pendingDeleteUser ? (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Delete Account</h2>
              <p className="mt-1 text-sm text-slate-500">
                This will permanently remove the account and related records.
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-900">{pendingDeleteUser.name}</span>?
              </p>
              <p className="mt-2 text-xs text-slate-500">{pendingDeleteUser.email}</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setPendingDeleteUser(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={() => handleDeleteUser(pendingDeleteUser.id)}>
                Delete
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
