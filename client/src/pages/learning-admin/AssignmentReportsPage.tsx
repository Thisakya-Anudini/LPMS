import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Eye } from 'lucide-react';
import { learningApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type AssignmentReportLearner = {
  id: string;
  principalId: string | null;
  employeeNumber: string;
  learnerName: string;
  learnerEmail: string | null;
  designation: string | null;
  gradeName: string | null;
};

type AssignmentReport = {
  id: string;
  learning_path_id: string | null;
  learning_path_title: string;
  assigned_by_name: string;
  assigned_by_role: string;
  assignment_source: 'LEARNING_ADMIN' | 'SUPERVISOR';
  report_status: 'ASSIGNED_IN_LPMS' | 'ENROLLED_IN_ERP';
  assigned_at: string;
  learners: AssignmentReportLearner[];
};

const formatStatusLabel = (value: AssignmentReport['report_status']) =>
  value === 'ASSIGNED_IN_LPMS' ? 'Assigned in LPMS' : 'Enrolled in ERP';

const getStatusSelectClassName = (value: AssignmentReport['report_status']) =>
  value === 'ASSIGNED_IN_LPMS'
    ? 'border border-amber-200 bg-amber-50 text-amber-800 focus:ring-amber-200'
    : 'border border-emerald-200 bg-emerald-50 text-emerald-800 focus:ring-emerald-200';

function StatusSelect({
  value,
  disabled,
  onChange
}: {
  value: AssignmentReport['report_status'];
  disabled?: boolean;
  onChange: (value: AssignmentReport['report_status']) => void;
}) {
  return (
    <div className="relative inline-block w-auto min-w-[150px]">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as AssignmentReport['report_status'])}
        className={`h-8 w-full appearance-none rounded-full px-3 pr-9 text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70 ${getStatusSelectClassName(value)}`}
      >
        <option value="ASSIGNED_IN_LPMS">Assigned in LPMS</option>
        <option value="ENROLLED_IN_ERP">Enrolled in ERP</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-70" />
    </div>
  );
}

function StatusBadge({ value }: { value: AssignmentReport['report_status'] }) {
  return (
    <span
      className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold shadow-sm ${getStatusSelectClassName(value)}`}
    >
      {formatStatusLabel(value)}
    </span>
  );
}

export function AssignmentReportsPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [reports, setReports] = useState<AssignmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<AssignmentReport | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const statSkeletons = Array.from({ length: 3 }, (_, index) => index);
  const rowSkeletons = Array.from({ length: 4 }, (_, index) => index);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learningApi.getAssignmentReports(token);
      setReports(response.reports);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load assignment reports.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const stats = useMemo(() => {
    return {
      totalReports: reports.length,
      assignedInLpms: reports.filter((report) => report.report_status === 'ASSIGNED_IN_LPMS').length,
      enrolledInErp: reports.filter((report) => report.report_status === 'ENROLLED_IN_ERP').length
    };
  }, [reports]);

  const handleMarkEnrolled = async (reportId: string) => {
    return handleStatusChange(reportId, 'ENROLLED_IN_ERP');
  };

  const handleStatusChange = async (
    reportId: string,
    status: AssignmentReport['report_status']
  ) => {
    try {
      setUpdatingReportId(reportId);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      await learningApi.updateAssignmentReportStatus(token, reportId, status);
      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId ? { ...report, report_status: status } : report
        )
      );
      setSelectedReport((prev) =>
        prev && prev.id === reportId ? { ...prev, report_status: status } : prev
      );
      showToast(`Report status updated to ${formatStatusLabel(status)}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update report status.', 'error');
    } finally {
      setUpdatingReportId(null);
    }
  };

  const downloadReport = (report: AssignmentReport) => {
    const rows = [
      ['Learning Path', report.learning_path_title],
      ['Assigned By', report.assigned_by_name],
      ['Assigned At', new Date(report.assigned_at).toLocaleString()],
      ['Status', formatStatusLabel(report.report_status)],
      [],
      ['Learner Name', 'Employee No', 'Designation', 'Grade', 'Email']
    ];

    report.learners.forEach((learner) => {
      rows.push([
        learner.learnerName,
        learner.employeeNumber,
        learner.designation || '',
        learner.gradeName || '',
        learner.learnerEmail || ''
      ]);
    });

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = report.learning_path_title.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    link.href = url;
    link.download = `assignment_report_${safeTitle}_${report.id.slice(0, 8)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Assignment Reports</h1>
        <p className="text-slate-500">
          Review enrollments assigned from Learning Admin and Supervisor workflows.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statSkeletons.map((index) => (
          <Card key={`report-stat-${index}`} className="p-4">
            <p className="text-sm text-slate-500">
              {index === 0 ? 'Total Reports' : index === 1 ? 'Pending ERP Enrollment' : 'Enrolled in ERP'}
            </p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className={`text-2xl font-bold ${index === 1 ? 'text-amber-700' : index === 2 ? 'text-emerald-700' : 'text-slate-900'}`}>
                {index === 0 ? stats.totalReports : index === 1 ? stats.assignedInLpms : stats.enrolledInErp}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card title="Assignment Report List">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Learning Path</th>
                <th className="px-4 py-3 font-semibold">Learners</th>
                <th className="px-4 py-3 font-semibold">Assigned By</th>
                <th className="px-4 py-3 font-semibold">Assigned At</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                rowSkeletons.map((row) => (
                  <tr key={`report-skeleton-${row}`}>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-40" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-10" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-28" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-8 w-36 rounded-full" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-8 w-28 rounded-lg" /></td>
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={6}>
                    No assignment reports available yet.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{report.learning_path_title}</td>
                    <td className="px-4 py-4 text-slate-600">{report.learners.length}</td>
                    <td className="px-4 py-4 text-slate-600">
                      <p className="font-medium text-slate-800">{report.assigned_by_name}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(report.assigned_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <StatusSelect
                        value={report.report_status}
                        disabled={updatingReportId === report.id}
                        onChange={(value) => handleStatusChange(report.id, value)}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedReport(report)}>
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => downloadReport(report)}>
                          Download Report
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedReport ? (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedReport.learning_path_title}</h2>
                <p className="text-sm text-slate-500">
                  Assigned by {selectedReport.assigned_by_name} on{' '}
                  {new Date(selectedReport.assigned_at).toLocaleString()}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setSelectedReport(null)}>
                Close
              </Button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="p-4">
                  <p className="text-sm text-slate-500">Assigned By</p>
                  <p className="text-base font-semibold text-slate-900">{selectedReport.assigned_by_name}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-slate-500">Learner Count</p>
                  <p className="text-base font-semibold text-slate-900">{selectedReport.learners.length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-slate-500">Report Status</p>
                  <div className="mt-2">
                    <StatusBadge value={selectedReport.report_status} />
                  </div>
                </Card>
              </div>

              <Card title="Assigned Learners">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Learner</th>
                        <th className="px-4 py-3 font-semibold">Employee No</th>
                        <th className="px-4 py-3 font-semibold">Designation</th>
                        <th className="px-4 py-3 font-semibold">Grade</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedReport.learners.map((learner) => (
                        <tr key={learner.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">{learner.learnerName}</td>
                          <td className="px-4 py-3 text-slate-600">{learner.employeeNumber}</td>
                          <td className="px-4 py-3 text-slate-600">{learner.designation || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{learner.gradeName || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{learner.learnerEmail || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
