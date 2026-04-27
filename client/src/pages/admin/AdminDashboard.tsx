import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserCheck, Users, GraduationCap } from 'lucide-react';
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

const roleSections: { key: UserRow['role']; label: string }[] = [
  { key: 'SUPER_ADMIN', label: 'Super Admins' }
];

const initialUserForm = { name: '', email: '', password: '', role: 'SUPER_ADMIN' };

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
      if (!token) { showToast('Session expired. Please login again.', 'error'); return; }
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

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const superAdminCount = users.filter((u) => u.role === 'SUPER_ADMIN').length;
  const assignedLearningAdmins = learners.filter((l) => l.is_learning_admin).length;
  const totalUsers = learners.length + superAdminCount;

  const usersByRole = useMemo(
    () => roleSections.map((s) => ({ ...s, users: users.filter((u) => u.role === s.key) })),
    [users]
  );

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserFormLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { showToast('Session expired. Please login again.', 'error'); return; }
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
    if (!window.confirm('Deactivate this account?')) return;
    try {
      const token = await getAccessToken();
      if (!token) { showToast('Session expired. Please login again.', 'error'); return; }
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
      if (!token) { showToast('Session expired. Please login again.', 'error'); return; }
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

  const statCards = [
    { label: 'Total Users', value: totalUsers, icon: Users, iconClass: 'text-blue-600', iconBg: 'bg-blue-50', borderClass: 'border-l-blue-500' },
    { label: 'Super Admins', value: superAdminCount, icon: UserCheck, iconClass: 'text-green-600', iconBg: 'bg-green-50', borderClass: 'border-l-green-500' },
    { label: 'Learning Admins', value: assignedLearningAdmins, icon: ShieldCheck, iconClass: 'text-amber-600', iconBg: 'bg-amber-50', borderClass: 'border-l-amber-500' },
    { label: 'Total Learners', value: learners.length, icon: GraduationCap, iconClass: 'text-indigo-600', iconBg: 'bg-indigo-50', borderClass: 'border-l-indigo-500' }
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage Super Admin accounts and assign Learning Admin privileges to existing learners.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, iconClass, iconBg, borderClass }) => (
          <div key={label} className={`bg-white rounded-lg border border-slate-200 border-l-4 ${borderClass} p-5 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-1.5 text-3xl font-bold text-slate-900">
                  {loading ? <span className="inline-block h-8 w-12 rounded bg-slate-100 animate-pulse" /> : value}
                </p>
              </div>
              <div className={`${iconBg} p-3 rounded-lg`}>
                <Icon className={`h-5 w-5 ${iconClass}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Account Form */}
      <div className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-blue-100 bg-blue-50/40">
          <h2 className="text-sm font-bold text-blue-700">Create Super Admin Account</h2>
          <p className="text-xs text-slate-500 mt-0.5">Only system-level Super Admin accounts are created here.</p>
        </div>
        <div className="px-6 py-5">
          <form className="space-y-5" onSubmit={handleCreateUser}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Full Name" value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} required />
              <Input label="Email Address" type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} required />
              <Input label="Password" type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} required />
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">Learning Admin access is assigned to existing learners in the section below.</p>
              <Button type="submit" isLoading={userFormLoading}>Create Super Admin</Button>
            </div>
          </form>
        </div>
      </div>

      {/* Learning Admin Access Table */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-blue-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-blue-700">Learning Admin Access</h3>
          <span className="text-xs font-medium text-slate-500 bg-white/70 border border-slate-200 px-2.5 py-0.5 rounded-full">
            {learners.length} {learners.length === 1 ? 'learner' : 'learners'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-100/80 text-blue-900 border-b border-blue-200/60 text-left">
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Learner</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Employee No.</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Designation</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Admin Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/60 bg-white">
              {learners.map((learner) => (
                <tr key={learner.principal_id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-slate-900 leading-tight">{learner.name}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{learner.email}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono text-sm">{learner.employee_number}</td>
                  <td className="py-3.5 px-4 text-slate-600 text-sm">{learner.designation || '—'}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {learner.is_learning_admin ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                            Assigned
                          </span>
                          <Button size="sm" variant="outline" onClick={() => handleAssignLearningAdmin(learner.employee_number, false)}>Remove</Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => handleAssignLearningAdmin(learner.employee_number, true)}>Assign</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {learners.length === 0 && (
                <tr>
                  <td className="py-8 px-4 text-center text-base text-slate-400" colSpan={4}>No learners available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admins Table */}
      <div className="space-y-4">
        {usersByRole.map((section) => (
          <div key={section.key} className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-700">{section.label}</h3>
              <span className="text-xs font-medium text-slate-500 bg-white/70 border border-slate-200 px-2.5 py-0.5 rounded-full">
                {section.users.length} {section.users.length === 1 ? 'user' : 'users'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-100/80 text-blue-900 border-b border-blue-200/60 text-left">
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider w-1/4">Name</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider w-2/5">Email</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider w-1/5">Status</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider w-1/6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/60 bg-white">
                  {section.users.length ? (
                    section.users.map((user) => (
                      <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-900">{user.name}</td>
                        <td className="py-3.5 px-4 text-slate-600 break-words">{user.email}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full inline-block ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {user.is_active
                            ? <Button size="sm" variant="outline" onClick={() => handleDeleteUser(user.id)}>Deactivate</Button>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-8 px-4 text-center text-base text-slate-400" colSpan={4}>No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}