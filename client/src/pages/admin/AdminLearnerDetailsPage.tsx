import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

export function AdminLearnerDetailsPage() {
  const { principalId } = useParams();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [learner, setLearner] = useState<{ id: string; name: string; email: string } | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearnerPath[]>([]);

  const loadDetails = useCallback(async () => {
    if (!principalId) {
      return;
    }
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await superAdminApi.getLearnerLearningPaths(token, principalId);
      setLearner({
        id: response.learner.id,
        name: response.learner.name,
        email: response.learner.email
      });
      setLearningPaths(response.learningPaths);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learner learning paths.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, principalId, showToast]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Learner Details</h1>
          <p className="text-slate-500">View learning paths assigned to this learner.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/learners')}>
          Back to Learners
        </Button>
      </div>

      <Card>
        {loading ? (
          <p className="text-sm text-slate-500">Loading learner details...</p>
        ) : !learner ? (
          <p className="text-sm text-slate-500">Learner not found.</p>
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-900">{learner.name}</p>
            <p className="text-sm text-slate-500">{learner.email}</p>
          </div>
        )}
      </Card>

      <Card title="Assigned Learning Paths">
        {loading ? (
          <p className="text-sm text-slate-500">Loading learning paths...</p>
        ) : learningPaths.length === 0 ? (
          <p className="text-sm text-slate-500">No learning paths assigned to this learner.</p>
        ) : (
          <div className="space-y-4">
            {learningPaths.map((path) => (
              <div key={path.enrollment_id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-slate-900">{path.title}</p>
                  <span className="text-xs text-slate-500">{path.status.replace('_', ' ')}</span>
                </div>
                <ProgressBar progress={Number(path.progress || 0)} showLabel size="sm" />
                <p className="text-xs text-slate-500 mt-2">
                  {path.category.replace('_', ' ')} | {path.total_duration}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
