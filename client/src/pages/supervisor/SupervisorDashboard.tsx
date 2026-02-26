import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supervisorApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../contexts/useAuth';

type TeamProgressRow = {
  principal_id: string;
  name: string;
  email: string;
  employee_number: string;
  total_enrollments: string;
  avg_progress: string;
  completed_count: string;
};

type ApprovalRow = {
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
};

type SupervisorPath = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
};

type TeamMember = {
  principal_id: string;
  name: string;
  email: string;
};

export function SupervisorDashboard() {
  const { getAccessToken } = useAuth();
  const [rows, setRows] = useState<TeamProgressRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [paths, setPaths] = useState<SupervisorPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [selectedPathId, setSelectedPathId] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);

  // 🔍 Email filter (ONLY for Team Progress)
  const [emailFilter, setEmailFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      const [progressResponse, approvalResponse, pathResponse] = await Promise.all([
        supervisorApi.getTeamProgress(token),
        supervisorApi.getApprovals(token),
        supervisorApi.getSupervisorPaths(token)
      ]);

      setRows(progressResponse.progress);
      setApprovals(approvalResponse.approvals);
      setPaths(pathResponse.learningPaths);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load supervisor data.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    load();
  }, [load]);

  // ✅ Stats (UNFILTERED)
  const stats = useMemo(() => {
    const memberCount = rows.length;
    const avgProgress = memberCount
      ? Math.round(rows.reduce((sum, row) => sum + Number(row.avg_progress), 0) / memberCount)
      : 0;
    const completed = rows.reduce((sum, row) => sum + Number(row.completed_count), 0);
    return { memberCount, avgProgress, completed };
  }, [rows]);

  const pendingApprovals = approvals.filter(
    (approval) => approval.approval_status === 'PENDING'
  );

  const teamMembers: TeamMember[] = rows.map((row) => ({
    principal_id: row.principal_id,
    name: row.name,
    email: row.email
  }));

  // ✅ Filtered rows ONLY for Team Progress card
  const filteredRows = rows.filter((row) =>
    row.employee_number.toLowerCase().includes(emailFilter.toLowerCase())
  );

  const toggleTeamMember = (principalId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(principalId)
        ? prev.filter((id) => id !== principalId)
        : [...prev, principalId]
    );
  };

  const handleApprovalAction = async (enrollmentId: string, action: 'approve' | 'reject') => {
    setActionLoadingId(enrollmentId);
    setError(null);
    setMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      if (action === 'approve') {
        await supervisorApi.approveEnrollment(token, enrollmentId);
        setMessage('Enrollment approved successfully.');
      } else {
        await supervisorApi.rejectEnrollment(token, enrollmentId);
        setMessage('Enrollment rejected successfully.');
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEnrollTeam = async () => {
    setEnrollLoading(true);
    setError(null);
    setMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      await supervisorApi.enrollTeamMembers(token, {
        learningPathId: selectedPathId,
        employeePrincipalIds: selectedTeamIds
      });

      setMessage('Team members enrolled successfully.');
      setSelectedTeamIds([]);
      setSelectedPathId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll team members.');
    } finally {
      setEnrollLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Overview</h1>
        <p className="text-slate-500">
          Track progress and manage semi-restricted enrollments.
        </p>
      </div>

      {error && <Card className="text-red-600">{error}</Card>}
      {message && <Card className="text-green-700">{message}</Card>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Team Members</p>
          <p className="text-2xl font-bold text-slate-900">
            {loading ? '...' : stats.memberCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Average Progress</p>
          <p className="text-2xl font-bold text-slate-900">
            {loading ? '...' : `${stats.avgProgress}%`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Completed Enrollments</p>
          <p className="text-2xl font-bold text-slate-900">
            {loading ? '...' : stats.completed}
          </p>
        </Card>
      </div>

      {/* Enroll Team Card */}
      <Card title="Enroll Team (Semi-Restricted Paths)">
        <div className="space-y-4">
          <Select
            label="Learning Path"
            value={selectedPathId}
            onChange={(event) => setSelectedPathId(event.target.value)}
            options={[
              { value: '', label: 'Select a path' },
              ...paths.map((path) => ({ value: path.id, label: path.title }))
            ]}
          />

          <div className="max-h-56 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
            {teamMembers.map((member) => (
              <label
                key={member.principal_id}
                className="flex items-start gap-3 p-2 rounded hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedTeamIds.includes(member.principal_id)}
                  onChange={() => toggleTeamMember(member.principal_id)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    {member.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {member.email}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <Button
            onClick={handleEnrollTeam}
            isLoading={enrollLoading}
            disabled={!selectedPathId || selectedTeamIds.length === 0}
          >
            Enroll Selected Team Members
          </Button>
        </div>
      </Card>

      {/* Pending Approvals Card */}
      <Card title="Pending Approvals">
        <div className="space-y-3">
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-slate-500">No pending approvals.</p>
          ) : (
            pendingApprovals.map((approval) => (
              <div
                key={approval.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {approval.learning_path_title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {approval.name} ({approval.email}) | Progress {approval.progress}%
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprovalAction(approval.id, 'approve')}
                    isLoading={actionLoadingId === approval.id}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprovalAction(approval.id, 'reject')}
                    isLoading={actionLoadingId === approval.id}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Team Progress Card (FILTERED ONLY HERE) */}
      <Card title="Team Progress">
        <div className="space-y-5">

          <input
            type="text"
            placeholder="Filter by employee number..."
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="w-full md:w-1/3 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {filteredRows.map((row) => (
            <div key={row.principal_id}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-500">Employee No: {row.employee_number} | {row.name}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {row.completed_count} completed
                </p>
              </div>
              <ProgressBar
                progress={Number(row.avg_progress)}
                showLabel
                size="sm"
              />
            </div>
          ))}

          {!loading && filteredRows.length === 0 && (
            <p className="text-sm text-slate-500">
              No matching employees found.
            </p>
          )}
        </div>
      </Card>

    </div>
  );
}