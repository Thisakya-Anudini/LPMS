import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserCheck, Users } from 'lucide-react';
import { userApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/useAuth';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'LEARNING_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
  is_active: boolean;
};

const initialUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'LEARNING_ADMIN' as 'SUPER_ADMIN' | 'LEARNING_ADMIN' | 'SUPERVISOR'
};

const initialEmployeeForm = {
  name: '',
  email: '',
  password: '',
  employeeNumber: '',
  designation: '',
  gradeName: '',
  supervisorId: ''
};

export function AdminDashboard() {
  const { getAccessToken } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userForm, setUserForm] = useState(initialUserForm);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [employeeFormLoading, setEmployeeFormLoading] = useState(false);
  const [userFormMessage, setUserFormMessage] = useState<string | null>(null);
  const [employeeFormMessage, setEmployeeFormMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      const response = await userApi.listUsers(token);
      setUsers(response.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const activeUsers = users.filter((user) => user.is_active).length;
  const employeeUsers = users.filter((user) => user.role === 'EMPLOYEE').length;
  const supervisors = useMemo(
    () => users.filter((user) => user.role === 'SUPERVISOR' && user.is_active),
    [users]
  );

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserFormLoading(true);
    setUserFormMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setUserFormMessage('Session expired. Please login again.');
        return;
      }

      await userApi.createUser(token, userForm);
      setUserFormMessage('User account created successfully.');
      setUserForm(initialUserForm);
      await loadUsers();
    } catch (err) {
      setUserFormMessage(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleCreateEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmployeeFormLoading(true);
    setEmployeeFormMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setEmployeeFormMessage('Session expired. Please login again.');
        return;
      }

      await userApi.createEmployee(token, {
        ...employeeForm,
        supervisorId: employeeForm.supervisorId || undefined
      });
      setEmployeeFormMessage('Employee account created successfully.');
      setEmployeeForm(initialEmployeeForm);
      await loadUsers();
    } catch (err) {
      setEmployeeFormMessage(err instanceof Error ? err.message : 'Failed to create employee.');
    } finally {
      setEmployeeFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Overview</h1>
        <p className="text-slate-500">Manage platform users and account access.</p>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}

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
              <p className="text-sm text-slate-500">Employees</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : employeeUsers}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Create Accounts">
        <Tabs
          defaultTab="systemUser"
          tabs={[
            {
              id: 'systemUser',
              label: 'Create System User',
              content: (
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
                          role: event.target.value as 'SUPER_ADMIN' | 'LEARNING_ADMIN' | 'SUPERVISOR'
                        }))
                      }
                      options={[
                        { value: 'LEARNING_ADMIN', label: 'Learning Admin' },
                        { value: 'SUPERVISOR', label: 'Supervisor' },
                        { value: 'SUPER_ADMIN', label: 'Super Admin' }
                      ]}
                    />
                  </div>
                  {userFormMessage ? <p className="text-sm text-slate-700">{userFormMessage}</p> : null}
                  <Button type="submit" isLoading={userFormLoading}>
                    Create User
                  </Button>
                </form>
              )
            },
            {
              id: 'employee',
              label: 'Create Employee',
              content: (
                <form className="space-y-4" onSubmit={handleCreateEmployee}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Name"
                      value={employeeForm.name}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={employeeForm.email}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
                      required
                    />
                    <Input
                      label="Password"
                      type="password"
                      value={employeeForm.password}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, password: event.target.value }))}
                      required
                    />
                    <Input
                      label="Employee Number"
                      value={employeeForm.employeeNumber}
                      onChange={(event) =>
                        setEmployeeForm((prev) => ({ ...prev, employeeNumber: event.target.value }))
                      }
                      required
                    />
                    <Input
                      label="Designation"
                      value={employeeForm.designation}
                      onChange={(event) =>
                        setEmployeeForm((prev) => ({ ...prev, designation: event.target.value }))
                      }
                      required
                    />
                    <Input
                      label="Grade Name"
                      value={employeeForm.gradeName}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, gradeName: event.target.value }))}
                      required
                    />
                    <Select
                      label="Supervisor (Optional)"
                      value={employeeForm.supervisorId}
                      onChange={(event) =>
                        setEmployeeForm((prev) => ({ ...prev, supervisorId: event.target.value }))
                      }
                      options={[
                        { value: '', label: 'No supervisor' },
                        ...supervisors.map((user) => ({
                          value: user.id,
                          label: `${user.name} (${user.email})`
                        }))
                      ]}
                    />
                  </div>
                  {employeeFormMessage ? <p className="text-sm text-slate-700">{employeeFormMessage}</p> : null}
                  <Button type="submit" isLoading={employeeFormLoading}>
                    Create Employee
                  </Button>
                </form>
              )
            }
          ]}
        />
      </Card>

      <Card title="Recent Users">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 15).map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{user.name}</td>
                  <td className="py-2 pr-4 text-slate-600">{user.email}</td>
                  <td className="py-2 pr-4 text-slate-600">{user.role.replace('_', ' ')}</td>
                  <td className="py-2">
                    <span className={user.is_active ? 'text-green-700' : 'text-red-700'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
