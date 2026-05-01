import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type LearnerRow = {
  principal_id: string;
  name: string;
  email: string;
  is_active: boolean;
  employee_number: string;
  designation: string;
  grade_name: string;
  total_learning_paths: number;
  completed_learning_paths: number;
};

export function AdminLearnersPage() {
  const PAGE_SIZE = 50;
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [designationOptions, setDesignationOptions] = useState<string[]>([]);
  const [employeeNoSearch, setEmployeeNoSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0
  });

  const loadLearners = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await superAdminApi.getLearners(token, {
        page,
        pageSize: PAGE_SIZE,
        employeeNo: employeeNoSearch,
        name: nameSearch,
        designation: designationFilter
      });
      setLearners(response.learners);
      setDesignationOptions(response.designationOptions);
      setPagination(response.pagination);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learners.', 'error');
    } finally {
      setLoading(false);
    }
  }, [PAGE_SIZE, designationFilter, employeeNoSearch, getAccessToken, nameSearch, page, showToast]);

  useEffect(() => {
    loadLearners();
  }, [loadLearners]);

  useEffect(() => {
    setPage(1);
  }, [employeeNoSearch, nameSearch, designationFilter]);

  const openLearnerDetails = (learner: LearnerRow) => {
    navigate(`/admin/learners/${learner.principal_id}`);
  };

  const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const pageEnd = pagination.total === 0
    ? 0
    : Math.min(pagination.page * pagination.pageSize, pagination.total);
  const canGoPrevious = pagination.page > 1;
  const canGoNext = pagination.totalPages > 0 && pagination.page < pagination.totalPages;
  const designationSelectOptions = useMemo(
    () => ['ALL', ...designationOptions],
    [designationOptions]
  );
  const skeletonRows = Array.from({ length: 8 }, (_, index) => index);
  const visiblePages = useMemo(() => {
    if (pagination.totalPages <= 1) {
      return pagination.totalPages === 1 ? [1] : [];
    }

    const windowSize = 5;
    const start = Math.max(1, pagination.page - Math.floor(windowSize / 2));
    const end = Math.min(pagination.totalPages, start + windowSize - 1);
    const normalizedStart = Math.max(1, end - windowSize + 1);

    return Array.from(
      { length: end - normalizedStart + 1 },
      (_, index) => normalizedStart + index
    );
  }, [pagination.page, pagination.totalPages]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Learners</h1>
        <p className="text-slate-500">View all learners and inspect assigned learning path progress.</p>
      </div>

      <Card title="All Learners">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Search by Employee No</label>
            {loading ? (
              <Skeleton className="h-10 w-full rounded-md" />
            ) : (
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 011338"
                value={employeeNoSearch}
                onChange={(event) => setEmployeeNoSearch(event.target.value)}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Search by Name</label>
            {loading ? (
              <Skeleton className="h-10 w-full rounded-md" />
            ) : (
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Tennakoon"
                value={nameSearch}
                onChange={(event) => setNameSearch(event.target.value)}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Filter by Designation</label>
            {loading ? (
              <Skeleton className="h-10 w-full rounded-md" />
            ) : (
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                value={designationFilter}
                onChange={(event) => setDesignationFilter(event.target.value)}
              >
                {designationSelectOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            {loading ? (
              <Skeleton className="h-5 w-52" />
            ) : (
              <p className="text-sm font-semibold text-slate-900">
                Showing {pageStart}-{pageEnd} of {pagination.total} learners
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {loading ? (
              <Skeleton className="h-8 w-28 rounded-full" />
            ) : (
              <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                Page {pagination.totalPages === 0 ? 0 : pagination.page} of {pagination.totalPages}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Learner</th>
                  <th className="px-3 py-2">Employee No</th>
                  <th className="px-3 py-2">Designation</th>
                  <th className="px-3 py-2">Assigned LPs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  skeletonRows.map((row) => (
                    <tr key={`skeleton-${row}`}>
                      <td className="px-3 py-3">
                        <Skeleton className="mb-2 h-5 w-40" />
                        <Skeleton className="h-4 w-52" />
                      </td>
                      <td className="px-3 py-3">
                        <Skeleton className="h-5 w-20" />
                      </td>
                      <td className="px-3 py-3">
                        <Skeleton className="h-5 w-36" />
                      </td>
                      <td className="px-3 py-3">
                        <Skeleton className="h-5 w-14" />
                      </td>
                    </tr>
                  ))
                ) : learners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-slate-500">No learners match current filters.</td>
                  </tr>
                ) : (
                  learners.map((learner) => (
                    <tr
                      key={learner.principal_id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => openLearnerDetails(learner)}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{learner.name}</p>
                        <p className="text-xs text-slate-500">{learner.email}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{learner.employee_number}</td>
                      <td className="px-3 py-2 text-slate-700">{learner.designation}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {learner.completed_learning_paths}/{learner.total_learning_paths}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {loading ? (
              <>
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-12" />
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={loading || !canGoPrevious}
                >
                  First
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={loading || !canGoPrevious}
                >
                  {'<'}
                </Button>
                {visiblePages.map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    type="button"
                    variant={pageNumber === pagination.page ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNumber)}
                    disabled={loading}
                    className="min-w-9"
                  >
                    {pageNumber}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={loading || !canGoNext}
                >
                  {'>'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(pagination.totalPages)}
                  disabled={loading || !canGoNext}
                >
                  Last
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

    </div>
  );
}
