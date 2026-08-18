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
    ? 'border border-[#034c96] bg-[#034c96] text-white focus:ring-[#034c96]'
    : 'border border-transparent bg-gradient-to-r from-[#bffb7e] to-[#7CFC00] text-[#064c00] focus:ring-[#7CFC00]/40 shadow-md hover:brightness-105';

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
  const [page, setPage] = useState(1);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const PAGE_SIZE = 10;
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

  useEffect(() => {
    setPage(1);
  }, [reports.length]);

  const stats = useMemo(() => {
    return {
      totalReports: reports.length,
      assignedInLpms: reports.filter((report) => report.report_status === 'ASSIGNED_IN_LPMS').length,
      enrolledInErp: reports.filter((report) => report.report_status === 'ENROLLED_IN_ERP').length
    };
  }, [reports]);

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

  const paginatedReports = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return reports.slice(startIndex, startIndex + PAGE_SIZE);
  }, [page, PAGE_SIZE, reports]);

  const toggleSelect = (id: string) => {
    setSelectedRowIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = paginatedReports.map((r) => r.id);
    const allSelected = pageIds.every((id) => selectedRowIds.includes(id));
    if (allSelected) {
      setSelectedRowIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedRowIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const pageStart = reports.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = reports.length === 0 ? 0 : Math.min(page * PAGE_SIZE, reports.length);
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const visiblePages = useMemo(() => {
    if (totalPages <= 1) {
      return totalPages === 1 ? [1] : [];
    }

    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    const normalizedStart = Math.max(1, end - windowSize + 1);

    return Array.from(
      { length: end - normalizedStart + 1 },
      (_, index) => normalizedStart + index
    );
  }, [page, totalPages]);

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
      <div className="rounded-lg bg-gradient-to-r from-[#0b66b2] via-[#0fb2ff] to-[#25a33a] p-4 text-white flex items-center justify-between shadow-lg ring-1 ring-white/20">
        <div>
          <h1 className="text-2xl font-bold">Assignment Reports</h1>
          <p className="text-sm opacity-90 mt-1">Review enrollments assigned from Learning Admin and Supervisor workflows.</p>
        </div>
        {/* New Assignment button removed per request */}
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statSkeletons.map((index) => {
          const title = index === 0 ? 'Total Reports' : index === 1 ? 'Pending ERP Enrollment' : 'Enrolled in ERP';
          const value = index === 0 ? stats.totalReports : index === 1 ? stats.assignedInLpms : stats.enrolledInErp;
          const accent = index === 0 ? ['#d8ecff', '#1E90FF'] : index === 1 ? ['#cffaf6', '#2dd6c9'] : ['#e6f9e8', '#7CFC00'];
          const percent = stats.totalReports > 0 ? Math.round((value / stats.totalReports) * 100) : index === 0 ? 100 : 0;

          return (
            <Card
              key={`report-stat-${index}`}
              className={`relative overflow-hidden p-4 rounded-2xl shadow-sm transform transition-all duration-200 hover:scale-[1.02] ${index === 0 ? 'bg-gradient-to-r from-[#e8f7ff] to-[#cfe9ff]' : index === 1 ? 'bg-gradient-to-r from-[#f6fffd] to-[#e6fbfd]' : 'bg-gradient-to-r from-[#f7fff7] to-[#d4ffb8]'}`}
            >
              <div className={`absolute right-4 top-3 h-14 w-14 rounded-full flex items-center justify-center ${index === 0 ? 'bg-gradient-to-br from-white/80 to-[#e8f7ff] ring-1 ring-white/60 shadow' : 'bg-white/70 ring-1 ring-white/50 shadow-sm'}`}>
                {index === 0 ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="g1" x1="0" x2="1">
                          <stop offset="0%" stopColor="#d8ecff" />
                          <stop offset="100%" stopColor="#1E90FF" />
                        </linearGradient>
                      </defs>
                      <circle cx="12" cy="12" r="9" stroke="url(#g1)" strokeWidth="1.2" fill="none" />
                      <rect x="8" y="8" width="8" height="8" rx="2" fill="#e8f7ff" />
                  </svg>
                ) : index === 2 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="9" stroke="#7CFC00" strokeWidth="1.4" fill="none" />
                    <path d="M8 12a4 4 0 018 0" stroke="#7CFC00" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="9" stroke={accent[0]} strokeWidth="1.4" fill="none" />
                    <path d="M8 12a4 4 0 018 0" stroke={accent[1]} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              <div className="flex flex-col">
                <p className="text-sm text-slate-500">{title}</p>
                {loading ? (
                  <Skeleton className="mt-3 h-8 w-20" />
                ) : (
                  <div className="mt-3 flex items-center justify-between">
                    <p className={`text-3xl font-extrabold ${index === 2 ? 'text-[#0b7a00]' : 'text-[#0b66b2]'}`}>{value}</p>
                    <div className="ml-4 w-28">
                      <div className="h-2 w-full rounded-full bg-white/60">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${percent}%`,
                            background: index === 2 ? 'linear-gradient(90deg, #bffb7e, #7CFC00)' : `linear-gradient(90deg, ${accent[0]}, ${accent[1]})`,
                            boxShadow: index === 2 ? '0 2px 8px #7CFC0030' : `0 1px 6px ${accent[1]}30`
                          }}
                        />
                      </div>
                      <p className={`mt-1 text-xs ${index === 2 ? 'text-[#7CFC00]' : 'text-slate-500'}`}>{percent}%</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </section>

      <Card title="Assignment Report List">
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            {loading ? <Skeleton className="h-5 w-52" /> : <p className="text-sm font-semibold text-slate-900">Showing {pageStart}-{pageEnd} of {reports.length} reports</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input type="search" placeholder="Search" className="h-9 w-56 rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm placeholder:text-slate-400" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</div>
            </div>
            {loading ? <Skeleton className="h-8 w-28 rounded-full" /> : <span className="rounded-full bg-[linear-gradient(90deg,#034c96_0%,#0563bb_35%,#3faa45_100%)] px-3 py-1 font-medium text-white shadow-sm">Page {reports.length === 0 ? 0 : page} of {totalPages}</span>}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto overflow-x-auto pb-2">
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-white text-slate-600 sticky top-0 z-20">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-[#034c96]"
                      onChange={toggleSelectAllOnPage}
                      checked={paginatedReports.length > 0 && paginatedReports.every((r) => selectedRowIds.includes(r.id))}
                    />
                  </th>
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3 font-semibold">Learning Path</th>
                  <th className="px-4 py-3 font-semibold">Learners</th>
                  <th className="px-4 py-3 font-semibold">Assigned By</th>
                  <th className="px-4 py-3 font-semibold">Assigned At</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? rowSkeletons.map((row) => (
                  <tr key={`report-skeleton-${row}`}>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-5 rounded" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-3 w-3 rounded-full" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-40" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-10" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-28" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-8 w-36 rounded-full" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-8 w-28 rounded-lg" /></td>
                  </tr>
                )) : (reports.length === 0 ? (
                  <tr><td className="px-4 py-4 text-slate-500" colSpan={8}>No assignment reports available yet.</td></tr>
                ) : (
                  paginatedReports.map((report, idx) => {
                    const isSelected = selectedRowIds.includes(report.id);
                    return (
                      <tr
                        key={report.id}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${isSelected ? 'bg-slate-100 ring-1 ring-slate-200' : ''} hover:bg-slate-100 transition-shadow transition-transform duration-150 hover:shadow-md`}
                      >
                        <td className={`px-4 py-4 ${isSelected ? 'bg-slate-100' : ''}`}>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            style={{ accentColor: isSelected ? '#6B7280' : undefined }}
                            checked={isSelected}
                            onChange={() => toggleSelect(report.id)}
                          />
                        </td>
                        <td className={`px-4 py-4 ${isSelected ? 'bg-slate-100' : ''}`}><span className={`inline-block h-3 w-3 rounded-full ${report.report_status === 'ASSIGNED_IN_LPMS' ? 'bg-[#0b66b2]' : 'bg-[#7CFC00]'}`} /></td>
                        <td className={`px-4 py-4 font-medium text-slate-900 ${isSelected ? 'bg-slate-100' : ''}`}>{report.learning_path_title}</td>
                        <td className={`px-4 py-4 text-slate-600 ${isSelected ? 'bg-slate-100' : ''}`}>{report.learners.length}</td>
                        <td className={`px-4 py-4 text-slate-600 ${isSelected ? 'bg-slate-100' : ''}`}><p className="font-medium text-slate-800">{report.assigned_by_name}</p></td>
                        <td className={`px-4 py-4 text-slate-600 ${isSelected ? 'bg-slate-100' : ''}`}>{new Date(report.assigned_at).toLocaleString()}</td>
                        <td className={`px-4 py-4 ${isSelected ? 'bg-slate-100' : ''}`}><StatusSelect value={report.report_status} disabled={updatingReportId === report.id} onChange={(value) => handleStatusChange(report.id, value)} /></td>
                        <td className={`px-4 py-4 ${isSelected ? 'bg-slate-100' : ''}`}>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedReport(report)}><Eye className="h-4 w-4" /><span className="ml-2">View</span></Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => downloadReport(report)}>Download Report</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {loading ? (
              <>
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPage(1)} disabled={!canGoPrevious}>Prev</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={!canGoPrevious}>{'<'}</Button>
                {visiblePages.map((pageNumber) => (
                  <Button key={pageNumber} type="button" variant={pageNumber === page ? 'primary' : 'outline'} size="sm" onClick={() => setPage(pageNumber)} className="min-w-9">{pageNumber}</Button>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => prev + 1)} disabled={!canGoNext}>{'>'}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={!canGoNext}>Next</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {selectedReport && (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-[#034c96]/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#034c96] bg-[linear-gradient(90deg,#034c96_0%,#0563bb_35%,#3faa45_100%)] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedReport.learning_path_title}</h2>
                <p className="text-sm text-white/75">Assigned by {selectedReport.assigned_by_name} on {new Date(selectedReport.assigned_at).toLocaleString()}</p>
              </div>
              <Button type="button" variant="outline" className="border-white bg-white text-[#034c96] hover:bg-white/90" onClick={() => setSelectedReport(null)}>Close</Button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="p-4"><p className="text-sm text-slate-500">Assigned By</p><p className="text-base font-semibold text-slate-900">{selectedReport.assigned_by_name}</p></Card>
                <Card className="p-4"><p className="text-sm text-slate-500">Learner Count</p><p className="text-base font-semibold text-slate-900">{selectedReport.learners.length}</p></Card>
                <Card className="p-4"><p className="text-sm text-slate-500">Report Status</p><div className="mt-2"><StatusBadge value={selectedReport.report_status} /></div></Card>
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
      )}
    </div>
  );
}
