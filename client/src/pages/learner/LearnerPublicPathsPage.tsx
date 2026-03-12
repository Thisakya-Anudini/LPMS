import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [pathDetail, setPathDetail] = useState<{
    id: string;
    title: string;
    description: string;
    category: string;
    total_duration: string;
    status: string;
    created_at: string;
    stages: Array<{
      id: string;
      title: string;
      stage_order: number;
      courses?: Array<{ course_id: string; title: string; course_order: number; delivery_mode?: 'ONLINE' | 'PHYSICAL' }>;
    }>;
  } | null>(null);

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

  const handleOpenDetails = async (learningPathId: string) => {
    try {
      setSelectedPathId(learningPathId);
      setDetailLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learnerApi.getPublicPathById(token, learningPathId);
      setPathDetail(response.learningPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learning path details.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const closePopup = () => {
    setSelectedPathId(null);
    setPathDetail(null);
  };

  const formattedCreatedAt = useMemo(() => {
    if (!pathDetail?.created_at) {
      return '-';
    }
    const parsed = new Date(pathDetail.created_at);
    if (Number.isNaN(parsed.getTime())) {
      return pathDetail.created_at;
    }
    return parsed.toLocaleString();
  }, [pathDetail?.created_at]);

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
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => handleOpenDetails(path.id)}>
                    View Details
                  </Button>
                  <Button
                    onClick={() => handleSelfEnroll(path.id)}
                    isLoading={selfEnrollLoadingId === path.id}
                    disabled={path.already_enrolled}
                  >
                    {path.already_enrolled ? 'Already Enrolled' : 'Self Enroll'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {selectedPathId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {pathDetail ? `${pathDetail.title} - Details` : 'Learning Path Details'}
              </h2>
              <button
                type="button"
                onClick={closePopup}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              {detailLoading ? (
                <p className="text-sm text-slate-500">Loading learning path details...</p>
              ) : !pathDetail ? (
                <p className="text-sm text-slate-500">Select a learning path to view details and courses.</p>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <p className="font-medium text-slate-900">{pathDetail.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{pathDetail.description}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {pathDetail.category.replace('_', ' ')} | {pathDetail.total_duration} | {pathDetail.status}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Created: {formattedCreatedAt}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 mb-2">Courses</p>
                    <div className="space-y-2">
                      {pathDetail.stages.length === 0 ? (
                        <p className="text-sm text-slate-500">No courses found for this learning path.</p>
                      ) : (
                        pathDetail.stages
                          .sort((a, b) => a.stage_order - b.stage_order)
                          .map((stage) => (
                            <div
                              key={stage.id}
                              className="p-2 rounded border border-slate-200 bg-white text-sm text-slate-800"
                            >
                              <p className="font-semibold text-slate-900">
                                Stage {stage.stage_order}: {stage.title}
                              </p>
                              <div className="mt-1 space-y-1">
                                {(stage.courses || [])
                                  .sort((a, b) => a.course_order - b.course_order)
                                  .map((course) => (
                                    <p key={course.course_id} className="text-slate-700">
                                      {course.course_order}. {course.title}
                                      {course.delivery_mode ? ` (${course.delivery_mode})` : ''}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-4 py-3 flex justify-end">
              <Button type="button" variant="outline" onClick={closePopup}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
