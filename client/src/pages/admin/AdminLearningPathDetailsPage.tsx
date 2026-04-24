import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { learningApi, superAdminApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

export function AdminLearningPathDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [popupSection, setPopupSection] = useState<'DETAILS' | 'ENROLLMENTS'>('DETAILS');
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

  const formatDate = useCallback((value?: string | null) => {
    if (!value) {
      return '-';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  }, []);

  const loadDetails = useCallback(async () => {
    if (!id) {
      return;
    }
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const [detailResponse, enrollmentsResponse] = await Promise.all([
        learningApi.getLearningPathById(token, id),
        superAdminApi.getLearningPathEnrollments(token, id)
      ]);
      setPathDetail(detailResponse.learningPath);
      setPathEnrollments(enrollmentsResponse.enrollments);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learning path details.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id, showToast]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const stagedCourses = useMemo(() => {
    if (!pathDetail) {
      return [];
    }
    return pathDetail.stages
      .slice()
      .sort((a, b) => a.stage_order - b.stage_order)
      .map((stage) => ({
        ...stage,
        courses: (stage.courses || []).slice().sort((a, b) => a.course_order - b.course_order)
      }));
  }, [pathDetail]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Learning Path Details</h1>
          <p className="text-slate-500">Review learning path details and enrolled learner progress.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/learning-paths')}>
          Back to Learning Paths
        </Button>
      </div>

      <Card>
        {loading ? (
          <p className="text-sm text-slate-500">Loading learning path details...</p>
        ) : !pathDetail ? (
          <p className="text-sm text-slate-500">Learning path not found.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-slate-900">{pathDetail.title}</p>
            <p className="text-sm text-slate-600">{pathDetail.description}</p>
            <p className="text-xs text-slate-500">
              {pathDetail.category.replace('_', ' ')} | {pathDetail.total_duration} | {pathDetail.status}
            </p>
            <p className="text-xs text-slate-500">Created: {formatDate(pathDetail.created_at)}</p>
          </div>
        )}
      </Card>

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

      {popupSection === 'DETAILS' ? (
        <Card title="Courses">
          {loading ? (
            <p className="text-sm text-slate-500">Loading courses...</p>
          ) : stagedCourses.length === 0 ? (
            <p className="text-sm text-slate-500">No courses found for this learning path.</p>
          ) : (
            <div className="space-y-2">
              {stagedCourses.map((stage) => (
                <div key={stage.id} className="p-2 rounded border border-slate-200 bg-white text-sm text-slate-800">
                  <p className="font-semibold text-slate-900">
                    Stage {stage.stage_order}: {stage.title}
                  </p>
                  <div className="mt-1 space-y-1">
                    {(stage.courses || []).map((course) => (
                      <p key={course.course_id} className="text-slate-700">
                        {course.course_order}. {course.title}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card title="Enrolled Learners & Progress">
          {loading ? (
            <p className="text-sm text-slate-500">Loading enrollments...</p>
          ) : pathEnrollments.length === 0 ? (
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
        </Card>
      )}
    </div>
  );
}
