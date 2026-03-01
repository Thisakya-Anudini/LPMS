import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserCheck, Users } from 'lucide-react';
import { userApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
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
  },
  {
    key: 'LEARNING_ADMIN',
    label: 'Learning Admins',
    panelClass: 'border-blue-200 bg-blue-50/40',
    headingClass: 'text-blue-800',
    headRowClass: 'bg-blue-100/80 text-blue-900'
  }
];

const initialUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'LEARNING_ADMIN' as 'SUPER_ADMIN' | 'LEARNING_ADMIN'
};

export function AdminDashboard() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const activeUsers = users.filter((user) => user.is_active).length;
  const employeeUsers = users.filter((user) => user.role === 'EMPLOYEE').length;
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

      await userApi.createUser(token, userForm);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Accounts</h1>
        <p className="text-slate-500">Create and manage Super Admin and Learning Admin accounts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Total Users</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : users.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Active Accounts</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : activeUsers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm text-slate-500">Learners (ERP/AD)</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : employeeUsers}</p>
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
            <Select
              label="Role"
              value={userForm.role}
              onChange={(event) =>
                setUserForm((prev) => ({
                  ...prev,
                  role: event.target.value as 'SUPER_ADMIN' | 'LEARNING_ADMIN'
                }))
              }
              options={[
                { value: 'LEARNING_ADMIN', label: 'Learning Admin' },
                { value: 'SUPER_ADMIN', label: 'Super Admin' }
              ]}
            />
          </div>
          <p className="text-xs text-slate-500">
            Learner and learner-supervisor credentials are managed via ERP/AD integration mock service.
          </p>
          <Button type="submit" isLoading={userFormLoading}>
            Create User
          </Button>
        </form>
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
