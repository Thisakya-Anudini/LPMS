import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { learningApi, superAdminApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
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
};

export function AdminLearningPathsPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pathDetail, setPathDetail] = useState<{
    id: string;
    title: string;
    description: string;
    category: string;
    total_duration: string;
    status: string;
    stages: Array<{
      id: string;
      title: string;
      stage_order: number;
      courses?: Array<{ course_id: string; title: string; course_order: number }>;
    }>;
  } | null>(null);
  const [pathEnrollments, setPathEnrollments] = useState<
    Array<{
      enrollment_id: string;
      status: string;
      progress: number;
      enrolled_at: string;
      completed_at?: string;
      principal_id: string;
      name: string;
      email: string;
      employee_number: string;
      designation: string;
      grade_name: string;
    }>
  >([]);
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupSection, setPopupSection] = useState<'DETAILS' | 'ENROLLMENTS'>('DETAILS');

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

  const openPathDetail = async (pathId: string) => {
    try {
      setSelectedPathId(pathId);
      setIsPopupOpen(true);
      setDetailLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const [detailResponse, enrollmentsResponse] = await Promise.all([
        learningApi.getLearningPathById(token, pathId),
        superAdminApi.getLearningPathEnrollments(token, pathId)
      ]);
      setPathDetail(detailResponse.learningPath);
      setPathEnrollments(enrollmentsResponse.enrollments);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learning path details.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const closePopup = () => {
    setIsPopupOpen(false);
    setSelectedPathId(null);
    setPathDetail(null);
    setPathEnrollments([]);
    setPopupSection('DETAILS');
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
                    className={`hover:bg-slate-50 cursor-pointer ${
                      selectedPathId === path.id ? 'bg-blue-50' : ''
                    }`}
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

      {isPopupOpen ? (
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
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPopupSection('DETAILS')}
                      className={`px-3 py-1.5 rounded-md text-sm border ${
                        popupSection === 'DETAILS'
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      Learning Path Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setPopupSection('ENROLLMENTS')}
                      className={`px-3 py-1.5 rounded-md text-sm border ${
                        popupSection === 'ENROLLMENTS'
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      Enrolled Learners & Progress
                    </button>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <p className="font-medium text-slate-900">{pathDetail.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{pathDetail.description}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {pathDetail.category.replace('_', ' ')} | {pathDetail.total_duration} | {pathDetail.status}
                    </p>
                  </div>
                  {popupSection === 'DETAILS' ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-2">Courses</p>
                      <div className="space-y-2">
                        {pathDetail.stages.length === 0 ? (
                          <p className="text-sm text-slate-500">No courses found for this learning path.</p>
                        ) : (
                          pathDetail.stages
                            .sort((a, b) => a.stage_order - b.stage_order)
                            .map((stage) => (
                              <div key={stage.id} className="p-2 rounded border border-slate-200 bg-white text-sm text-slate-800">
                                <p className="font-semibold text-slate-900">
                                  Stage {stage.stage_order}: {stage.title}
                                </p>
                                <div className="mt-1 space-y-1">
                                  {(stage.courses || [])
                                    .sort((a, b) => a.course_order - b.course_order)
                                    .map((course) => (
                                      <p key={course.course_id} className="text-slate-700">
                                        {course.course_order}. {course.title}
                                      </p>
                                    ))}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-2">Enrolled Learners & Progress</p>
                      {pathEnrollments.length === 0 ? (
                        <p className="text-sm text-slate-500">No learners enrolled in this learning path yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {pathEnrollments.map((enrollment) => (
                            <div
                              key={enrollment.enrollment_id}
                              className="p-3 rounded-lg border border-slate-200 bg-slate-50"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {enrollment.name} ({enrollment.employee_number})
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {enrollment.designation || '-'} | {enrollment.email}
                                  </p>
                                </div>
                                <span className="text-xs text-slate-600">
                                  {enrollment.status.replace('_', ' ')}
                                </span>
                              </div>
                              <ProgressBar progress={Number(enrollment.progress || 0)} showLabel size="sm" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
