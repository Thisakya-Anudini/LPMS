import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Layers } from 'lucide-react';
import { superAdminApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type LearnerPath = {
  enrollment_id: string;
  status: string;
  progress: number;
  enrolled_at: string;
  completed_at?: string;
  learning_path_id: string;
  title: string;
  description: string;
  category: string;
  total_duration: string;
};

const getCategoryStyle = (category: string) => {
  const map: Record<string, string> = {
    PUBLIC: 'bg-green-50 text-green-700 border-green-200',
    RESTRICTED: 'bg-red-50 text-red-700 border-red-200',
    SEMI_RESTRICTED: 'bg-amber-50 text-amber-700 border-amber-200'
  };
  return map[category] || 'bg-slate-100 text-slate-500 border-slate-200';
};

const getEnrollmentStatusStyle = (status: string) => {
  const map: Record<string, string> = {
    COMPLETED: 'bg-green-50 text-green-700 border-green-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    NOT_STARTED: 'bg-slate-100 text-slate-500 border-slate-200'
  };
  return map[status] || 'bg-slate-100 text-slate-500 border-slate-200';
};

export function AdminLearnerDetailsPage() {
  const { principalId } = useParams();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [learner, setLearner] = useState<{ id: string; name: string; email: string } | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearnerPath[]>([]);

  const loadDetails = useCallback(async () => {
    if (!principalId) return;
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) { showToast('Session expired. Please login again.', 'error'); return; }
      const response = await superAdminApi.getLearnerLearningPaths(token, principalId);
      setLearner({ id: response.learner.id, name: response.learner.name, email: response.learner.email });
      setLearningPaths(response.learningPaths);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learner learning paths.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, principalId, showToast]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const completedCount = learningPaths.filter((p) => p.status === 'COMPLETED').length;
  const inProgressCount = learningPaths.filter((p) => p.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Learner Details</h1>
          <p className="mt-1 text-sm text-slate-500">View all learning paths assigned to this learner.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/learners')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back
        </Button>
      </div>

      {/* Learner Profile Card */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-blue-100">
          <h3 className="text-sm font-bold text-blue-700">Learner Profile</h3>
        </div>
        <div className="p-5 bg-white">
          {loading ? (
            <div className="space-y-2">
              <div className="h-5 w-1/3 rounded bg-slate-100 animate-pulse" />
              <div className="h-4 w-1/4 rounded bg-slate-100 animate-pulse" />
            </div>
          ) : !learner ? (
            <p className="text-sm text-slate-400">Learner not found.</p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold shrink-0 select-none">
                  {learner.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900 leading-tight">{learner.name}</p>
                  <p className="text-base text-slate-400 mt-0.5">{learner.email}</p>
                </div>
              </div>
              {!loading && learningPaths.length > 0 && (
                <div className="flex gap-4 sm:gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{learningPaths.length}</p>
                    <p className="text-sm text-slate-500 mt-0.5">Assigned</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
                    <p className="text-sm text-slate-500 mt-0.5">In Progress</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                    <p className="text-sm text-slate-500 mt-0.5">Completed</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assigned Learning Paths — table style */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-blue-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-blue-700">Assigned Learning Paths</h3>
          {!loading && (
            <span className="text-sm text-slate-500">
              {learningPaths.length} path{learningPaths.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : learningPaths.length === 0 ? (
            <div className="bg-white text-center py-10">
              <Layers className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-base text-slate-400">No learning paths assigned to this learner.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-100/80 text-blue-900 border-b border-blue-200/60 text-left">
                  <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Learning Path</th>
                  <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Category</th>
                  <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Duration</th>
                  <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Progress</th>
                  <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100/60 bg-white">
                {learningPaths.map((path) => (
                  <tr key={path.enrollment_id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900 leading-tight">{path.title}</p>
                      {path.description && (
                        <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{path.description}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-sm font-medium border ${getCategoryStyle(path.category)}`}>
                        {path.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-sm text-slate-400">
                        <Clock className="h-3 w-3" />
                        {path.total_duration}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 min-w-[140px]">
                      <ProgressBar progress={Number(path.progress || 0)} showLabel size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getEnrollmentStatusStyle(path.status)}`}>
                        {path.status === 'COMPLETED' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {path.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}