import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Filter, Search, SlidersHorizontal, UserRound, Users, X } from 'lucide-react';
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
  const [employeeNoSearchError, setEmployeeNoSearchError] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [nameSearchError, setNameSearchError] = useState('');
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

  const handleEmployeeNoSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    const sanitizedValue = nextValue.replace(/\D/g, '');

    if (nextValue !== sanitizedValue) {
      setEmployeeNoSearchError('Only numbers are allowed.');
      setEmployeeNoSearch(sanitizedValue);
      return;
    }

    setEmployeeNoSearchError('');
    setEmployeeNoSearch(nextValue);
  };

  const handleNameSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    const sanitizedValue = nextValue.replace(/[^A-Za-z\s]/g, '');

    if (nextValue !== sanitizedValue) {
      setNameSearchError('Only letters and spaces are allowed.');
      setNameSearch(sanitizedValue);
      return;
    }

    setNameSearchError('');
    setNameSearch(nextValue);
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
  const hasActiveFilters = Boolean(employeeNoSearch || nameSearch || designationFilter !== 'ALL');
  const clearFilters = () => {
    setEmployeeNoSearch('');
    setNameSearch('');
    setDesignationFilter('ALL');
    setEmployeeNoSearchError('');
    setNameSearchError('');
  };
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
    <div className="space-y-6 pb-6">
      {/* Banner Box (Matching System Accounts style with smooth hover effect) */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5">
        {/* Subtle Background Pattern/Gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-50 via-sky-50/20 to-white/50 opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="relative flex flex-col gap-4 px-5 py-6 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
              <Users className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
              <span>Learner Directory</span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Learners
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Find employees and review their learning path progress.
            </p>
          </div>

          <div className="flex w-full flex-col gap-1 rounded-xl border border-primary-100 bg-primary-50/50 px-5 py-4 sm:w-auto sm:min-w-[240px] transition-all duration-200 hover:border-primary-200 hover:bg-primary-50/90 hover:shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-primary-950">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-100 text-primary-700 transition-transform duration-200 group-hover:scale-105">
                  <Users className="h-3.5 w-3.5" />
                </div>
                Total Learners
              </div>
              {!loading && (
                <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-bold text-primary-800">
                  {pagination.total.toLocaleString()}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-primary-700">
              {loading ? "Refreshing learners..." : `${pagination.total.toLocaleString()} total active learners`}
            </p>
          </div>
        </div>
      </div>

      <Card className="shadow-sm" bodyClassName="p-0">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All learners</h2>
              <p className="text-sm text-slate-500">Use a name, employee number, or designation to narrow the directory.</p>
            </div>
            {hasActiveFilters && <Button type="button" variant="ghost" size="sm" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear filters</Button>}
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><SlidersHorizontal className="h-3.5 w-3.5" /> Search & filters</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Employee number</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:ring-2 ${
                    employeeNoSearchError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-slate-300'
                  }`}
                  placeholder="e.g. 011338"
                  inputMode="numeric"
                  value={employeeNoSearch}
                  onChange={handleEmployeeNoSearchChange}
                  aria-invalid={Boolean(employeeNoSearchError)}
                  aria-describedby={employeeNoSearchError ? 'learner-employee-no-search-error' : undefined}
                />
              </div>
              {employeeNoSearchError && (
                <p id="learner-employee-no-search-error" className="mt-1 text-xs font-medium text-red-600">
                  {employeeNoSearchError}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Learner name</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:ring-2 ${
                    nameSearchError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-slate-300'
                  }`}
                  placeholder="e.g. Tennakoon"
                  value={nameSearch}
                  onChange={handleNameSearchChange}
                  aria-invalid={Boolean(nameSearchError)}
                  aria-describedby={nameSearchError ? 'learner-name-search-error' : undefined}
                />
              </div>
              {nameSearchError && (
                <p id="learner-name-search-error" className="mt-1 text-xs font-medium text-red-600">
                  {nameSearchError}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Designation</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-primary-500"
                value={designationFilter}
                onChange={(event) => setDesignationFilter(event.target.value)}
              >
                {designationSelectOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            {loading ? (
              <Skeleton className="h-5 w-52" />
            ) : (
              <p className="text-sm font-medium text-slate-700">
                Showing <span className="font-semibold text-slate-900">{pageStart}-{pageEnd}</span> of <span className="font-semibold text-slate-900">{pagination.total}</span> learners
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {loading ? (
              <Skeleton className="h-8 w-28 rounded-full" />
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                Page {pagination.totalPages === 0 ? 0 : pagination.page} of {pagination.totalPages}
              </span>
            )}
          </div>
        </div>

        <div className="mx-3 overflow-hidden rounded-xl border border-slate-200 sm:mx-4">
          <div className="max-h-[32rem] overflow-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
                <tr>
                  <th className="px-3 py-2">Learner</th>
                  <th className="px-3 py-2">Employee No</th>
                  <th className="px-3 py-2">Designation</th>
                  <th className="px-3 py-2">Learning progress</th>
                  <th className="px-3 py-2 text-right">Actions</th>
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
                      <td className="px-3 py-3">
                        <Skeleton className="ml-auto h-8 w-14 rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : learners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center">
                      <Filter className="mx-auto mb-3 h-6 w-6 text-slate-300" />
                      <p className="font-medium text-slate-700">No learners found</p>
                      <p className="mt-1 text-xs text-slate-500">Try adjusting or clearing your filters.</p>
                      {hasActiveFilters && (
                        <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  learners.map((learner) => (
                    <tr
                      key={learner.principal_id}
                      className="group cursor-pointer transition-colors hover:bg-primary-50/40 focus-within:bg-primary-50/40"
                      onClick={() => openLearnerDetails(learner)}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-8 ring-sky-50/60">
                            <UserRound className="h-5 w-5" strokeWidth={1.75} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{learner.name}</p>
                            <p className="text-xs text-slate-500">{learner.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">{learner.employee_number || '—'}</td>
                      <td className="px-3 py-3">
                        <p className="text-slate-700">{learner.designation || '—'}</p>
                        {learner.grade_name && <p className="mt-0.5 text-xs text-slate-400">{learner.grade_name}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="min-w-[150px]">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">{learner.completed_learning_paths} of {learner.total_learning_paths} completed</span>
                            <span className="rounded-full bg-primary-50 px-2 py-0.5 font-bold text-primary-700">{learner.total_learning_paths ? Math.round((learner.completed_learning_paths / learner.total_learning_paths) * 100) : 0}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-sky-400 shadow-sm"
                              style={{
                                width: `${learner.total_learning_paths ? Math.min(100, Math.round((learner.completed_learning_paths / learner.total_learning_paths) * 100)) : 0}%`
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); openLearnerDetails(learner); }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end px-6 py-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {loading ? (
              <>
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-8" />
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
                  <ChevronLeft className="h-4 w-4" />
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
                  <ChevronRight className="h-4 w-4" />
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
