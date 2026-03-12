import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await learningApi.getLearningPaths(token);
      setPaths(response.learningPaths as LearningPathRow[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learning paths.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadPaths();
  }, [loadPaths]);

  const filteredPaths = useMemo(() => {
    if (filter === 'ALL') {
      return paths;
    }
    return paths.filter((path) => path.category === filter);
  }, [filter, paths]);

  const openPathDetail = (pathId: string) => {
    navigate(`/admin/learning-paths/${pathId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Learning Paths</h1>
        <p className="text-slate-500">Browse learning paths, included courses, and enrolled learner progress.</p>
      </div>

      <Card title="All Learning Paths">
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['ALL', 'PUBLIC', 'RESTRICTED', 'SEMI_RESTRICTED'] as CategoryFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                filter === item
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {item === 'SEMI_RESTRICTED' ? 'SEMI RESTRICTED' : item}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">Loading learning paths...</td>
                </tr>
              ) : filteredPaths.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">No learning paths found.</td>
                </tr>
              ) : (
                filteredPaths.map((path) => (
                  <tr
                    key={path.id}
                    onClick={() => openPathDetail(path.id)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{path.title}</td>
                    <td className="px-3 py-2 text-slate-700">{path.category.replace('_', ' ')}</td>
                    <td className="px-3 py-2 text-slate-700">{path.total_duration}</td>
                    <td className="px-3 py-2 text-slate-700">{path.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
