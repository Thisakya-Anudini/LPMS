import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserCheck, Users } from 'lucide-react';
import { superAdminApi, userApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'LEARNING_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
  is_active: boolean;
};

type LearnerRow = {
  principal_id: string;
  name: string;
  email: string;
  employee_number: string;
  designation: string;
  grade_name: string;
  is_learning_admin: boolean;
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
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [userForm, setUserForm] = useState(initialUserForm);
  const [userFormLoading, setUserFormLoading] = useState(false);

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
      const learnerResponse = await superAdminApi.getLearners(token);
      setLearners(learnerResponse.learners);
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
  const assignedLearningAdmins = learners.filter((learner) => learner.is_learning_admin).length;
  const totalUsers = learners.length + superAdminCount;
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
    const confirmed = window.confirm('Deactivate this account?');
    if (!confirmed) {
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      await userApi.deleteUser(token, id);
      showToast('Account deactivated successfully.', 'success');
      await loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to deactivate account.', 'error');
    }
  };

  const handleAssignLearningAdmin = async (employeeNumber: string, shouldAssign: boolean) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      if (shouldAssign) {
        await superAdminApi.assignLearningAdmin(token, employeeNumber);
        showToast('Learner assigned as Learning Admin.', 'success');
      } else {
        await superAdminApi.removeLearningAdmin(token, employeeNumber);
        showToast('Learning Admin access removed.', 'success');
      }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Total Users</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : totalUsers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Super Admins</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : superAdminCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm text-slate-500">Learning Admins</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : assignedLearningAdmins}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-sm text-slate-500">Learners</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : learners.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Create Accounts (System Only)">
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
          <p className="text-xs text-slate-500">
            Only system Super Admin accounts are created here. Learning Admin access is assigned to existing learners below.
          </p>
          <Button type="submit" isLoading={userFormLoading}>
            Create Super Admin
          </Button>
        </form>
      </Card>

      <Card title="Assign Learning Admin Access">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-2 px-3 font-semibold">Learner</th>
                <th className="py-2 px-3 font-semibold">Employee No</th>
                <th className="py-2 px-3 font-semibold">Designation</th>
                <th className="py-2 px-3 font-semibold">Learning Admin</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => (
                <tr key={learner.principal_id} className="border-b border-slate-100">
                  <td className="py-2 px-3">
                    <p className="font-medium text-slate-900">{learner.name}</p>
                    <p className="text-xs text-slate-500">{learner.email}</p>
                  </td>
                  <td className="py-2 px-3">{learner.employee_number}</td>
                  <td className="py-2 px-3">{learner.designation || '-'}</td>
                  <td className="py-2 px-3">
                    {learner.is_learning_admin ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAssignLearningAdmin(learner.employee_number, false)}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleAssignLearningAdmin(learner.employee_number, true)}
                      >
                        Assign
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {learners.length === 0 ? (
                <tr>
                  <td className="py-3 px-3 text-slate-500" colSpan={4}>
                    No learners available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent Users">
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
                    {section.users.length ? (
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
                                onClick={() => handleDeleteUser(user.id)}
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
        </div>
      </Card>
    </div>
  );
}
