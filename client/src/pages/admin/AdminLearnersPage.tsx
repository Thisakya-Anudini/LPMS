import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { superAdminApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
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
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [employeeNoSearch, setEmployeeNoSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('ALL');

  const loadLearners = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) { showToast('Session expired. Please login again.', 'error'); return; }
      const response = await superAdminApi.getLearners(token);
      setLearners(response.learners);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learners.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => { loadLearners(); }, [loadLearners]);

  const openLearnerDetails = (learner: LearnerRow) => navigate(`/admin/learners/${learner.principal_id}`);

  const designationOptions = useMemo(() => {
    const values = Array.from(
      new Set(learners.map((l) => (l.designation || '').trim()).filter((v) => v.length > 0))
    ).sort((a, b) => a.localeCompare(b));
    return ['ALL', ...values];
  }, [learners]);

  const filteredLearners = useMemo(() => {
    const empTerm = employeeNoSearch.trim().toLowerCase();
    const nameTerm = nameSearch.trim().toLowerCase();
    return learners.filter((l) => {
      const byEmp = !empTerm || l.employee_number.toLowerCase().includes(empTerm);
      const byName = !nameTerm || l.name.toLowerCase().includes(nameTerm);
      const byDes = designationFilter === 'ALL' || l.designation === designationFilter;
      return byEmp && byName && byDes;
    });
  }, [designationFilter, employeeNoSearch, learners, nameSearch]);

  const getProgressColor = (completed: number, total: number) => {
    if (total === 0) return 'text-slate-400';
    const ratio = completed / total;
    if (ratio === 1) return 'text-green-600';
    if (ratio >= 0.5) return 'text-amber-600';
    return 'text-slate-600';
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Learners</h1>
        <p className="mt-1 text-sm text-slate-500">
          View all learners and inspect assigned learning path progress.
        </p>
      </div>

      {/* Filters + Table — unified blue table style */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
        {/* Panel heading */}
        <div className="px-5 py-3.5 border-b border-blue-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-blue-700">All Learners</h3>
          {!loading && (
            <span className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-700">{filteredLearners.length}</span> of{' '}
              <span className="font-semibold text-slate-700">{learners.length}</span>
            </span>
          )}
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3.5 border-b border-blue-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-2 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                placeholder="Search by employee no."
                value={employeeNoSearch}
                onChange={(e) => setEmployeeNoSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-2 text-sm bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                placeholder="Search by name"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
              />
            </div>
            <select
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
            >
              {designationOptions.map((opt) => (
                <option key={opt} value={opt}>{opt === 'ALL' ? 'All Designations' : opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-blue-100/80 text-blue-900 border-b border-blue-200/60">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Learner</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Employee No.</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Designation</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Progress</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/60 bg-white">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={5}>
                      <div className="h-4 rounded bg-slate-100 animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-base text-slate-400">
                    No learners match the current filters.
                  </td>
                </tr>
              ) : (
                filteredLearners.map((learner) => (
                  <tr
                    key={learner.principal_id}
                    className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                    onClick={() => openLearnerDetails(learner)}
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900 leading-tight">{learner.name}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{learner.email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-sm">{learner.employee_number}</td>
                    <td className="px-4 py-3.5 text-slate-600 text-sm">{learner.designation || '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{
                              width: learner.total_learning_paths > 0
                                ? `${(learner.completed_learning_paths / learner.total_learning_paths) * 100}%`
                                : '0%'
                            }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${getProgressColor(learner.completed_learning_paths, learner.total_learning_paths)}`}>
                          {learner.completed_learning_paths}/{learner.total_learning_paths}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}