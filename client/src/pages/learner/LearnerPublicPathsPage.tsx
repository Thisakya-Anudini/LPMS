import React, { useCallback, useEffect, useState } from 'react';
import { learnerApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

export function LearnerPublicPathsPage() {
  const { getAccessToken, user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selfEnrollLoadingId, setSelfEnrollLoadingId] = useState<string | null>(null);
  const [publicLearningPaths, setPublicLearningPaths] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      total_duration: string;
      already_enrolled: boolean;
    }>
  >([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learnerApi.getPublicPaths(token);
      setPublicLearningPaths(response.learningPaths);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load public learning paths.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelfEnroll = async (learningPathId: string) => {
    try {
      setSelfEnrollLoadingId(learningPathId);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      await learnerApi.selfEnroll(token, learningPathId);
      showToast('Enrolled successfully.', 'success');
      await load();
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to self enroll.', 'error');
    } finally {
      setSelfEnrollLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Public Learning Paths</h1>
        <p className="text-slate-500">Self enroll to available public learning paths.</p>
        {user?.name ? <p className="text-sm text-slate-500 mt-1">Learner: {user.name}</p> : null}
      </div>

      <Card title="Public Learning Paths - Self Enrollment">
        <div className="space-y-3">
          {publicLearningPaths.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">No public learning paths available.</p>
          ) : (
            publicLearningPaths.map((path) => (
              <div
                key={path.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{path.title}</p>
                  <p className="text-xs text-slate-500">{path.description}</p>
                  <p className="text-xs text-slate-500 mt-1">Duration: {path.total_duration}</p>
                </div>
                <Button
                  onClick={() => handleSelfEnroll(path.id)}
                  isLoading={selfEnrollLoadingId === path.id}
                  disabled={path.already_enrolled}
                >
                  {path.already_enrolled ? 'Already Enrolled' : 'Self Enroll'}
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
