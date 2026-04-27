import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, Tag } from 'lucide-react';
import { learningApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type CategoryFilter = 'ALL' | 'PUBLIC' | 'RESTRICTED' | 'SEMI_RESTRICTED';

type LearningPathRow = {
  id: string;
  title: string;
  description: string;
  category: 'PUBLIC' | 'RESTRICTED' | 'SEMI_RESTRICTED';
  total_duration: string;
  status: string;
  created_at: string;
};

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PUBLIC', label: 'Public' },
  { key: 'RESTRICTED', label: 'Restricted' },
  { key: 'SEMI_RESTRICTED', label: 'Semi Restricted' }
];

const getCategoryStyle = (category: string) => {
  const map: Record<string, string> = {
    PUBLIC: 'bg-green-50 text-green-700 border-green-200',
    RESTRICTED: 'bg-red-50 text-red-700 border-red-200',
    SEMI_RESTRICTED: 'bg-amber-50 text-amber-700 border-amber-200'
  };
  return map[category] || 'bg-slate-100 text-slate-600 border-slate-200';
};

const getStatusStyle = (status: string) => {
  const active = status === 'ACTIVE' || status === 'PUBLISHED';
  return active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200';
};

export function AdminLearningPathsPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [filter, setFilter] = useState<CategoryFilter>('ALL');

  const loadPaths = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) { showToast('Session expired. Please login again.', 'error'); return; }
      const response = await learningApi.getLearningPaths(token);
      setPaths(response.learningPaths as LearningPathRow[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learning paths.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => { loadPaths(); }, [loadPaths]);

  const filteredPaths = useMemo(() => {
    if (filter === 'ALL') return paths;
    return paths.filter((p) => p.category === filter);
  }, [filter, paths]);

  const openPathDetail = (pathId: string) => navigate(`/admin/learning-paths/${pathId}`);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Learning Paths</h1>
        <p className="mt-1 text-sm text-slate-500">
          Browse learning paths, review course content, and monitor enrolled learner progress.
        </p>
      </div>

      {/* Table Card — unified blue table style */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
        {/* Panel heading */}
        <div className="px-5 py-3.5 border-b border-blue-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-blue-700">All Learning Paths</h3>
          {!loading && (
            <span className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-700">{filteredPaths.length}</span> of{' '}
              <span className="font-semibold text-slate-700">{paths.length}</span>
            </span>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="px-5 py-3 border-b border-blue-100 bg-white flex items-center gap-2 flex-wrap">
          {CATEGORY_FILTERS.map(({ key, label }) => {
            const count = key === 'ALL' ? paths.length : paths.filter((p) => p.category === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  filter === key
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {label}
                {!loading && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${filter === key ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-blue-100/80 text-blue-900 border-b border-blue-200/60">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Status</th>
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
              ) : filteredPaths.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-base text-slate-400">
                    No learning paths found for this category.
                  </td>
                </tr>
              ) : (
                filteredPaths.map((path) => (
                  <tr
                    key={path.id}
                    onClick={() => openPathDetail(path.id)}
                    className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900 leading-tight">{path.title}</p>
                      {path.description && (
                        <p className="text-sm text-slate-400 mt-0.5 truncate max-w-sm">{path.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getCategoryStyle(path.category)}`}>
                        <Tag className="h-3 w-3" />
                        {path.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {path.total_duration}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusStyle(path.status)}`}>
                        {path.status}
                      </span>
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