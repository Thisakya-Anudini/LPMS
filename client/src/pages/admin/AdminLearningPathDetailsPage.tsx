import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Users } from 'lucide-react';
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
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  }, []);

  const loadDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) { showToast('Session expired. Please login again.', 'error'); return; }
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

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const stagedCourses = useMemo(() => {
    if (!pathDetail) return [];
    return pathDetail.stages
      .slice()
      .sort((a, b) => a.stage_order - b.stage_order)
      .map((stage) => ({
        ...stage,
        courses: (stage.courses || []).slice().sort((a, b) => a.course_order - b.course_order)
      }));
  }, [pathDetail]);

  const getCategoryBadge = (category: string) => {
    const map: Record<string, string> = {
      PUBLIC: 'bg-green-50 text-green-700 border-green-200',
      RESTRICTED: 'bg-red-50 text-red-700 border-red-200',
      SEMI_RESTRICTED: 'bg-amber-50 text-amber-700 border-amber-200'
    };
    return map[category] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getStatusBadge = (status: string) => {
    const active = status === 'ACTIVE' || status === 'PUBLISHED';
    return active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const getEnrollmentStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      COMPLETED: 'bg-green-50 text-green-700 border-green-200',
      IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
      NOT_STARTED: 'bg-slate-100 text-slate-500 border-slate-200'
    };
    return map[status] || 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const tabs = [
    { key: 'DETAILS' as const, label: 'Course Structure', icon: BookOpen },
    { key: 'ENROLLMENTS' as const, label: 'Enrolled Learners', icon: Users }
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Learning Path Details</h1>
          <p className="mt-1 text-sm text-slate-500">Review learning path structure and enrolled learner progress.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/learning-paths')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back
        </Button>
      </div>

      {/* Path Summary Card */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-blue-100">
          <h3 className="text-sm font-bold text-blue-700">Learning Path Summary</h3>
        </div>
        <div className="p-5 bg-white">
          {loading ? (
            <div className="space-y-2">
              <div className="h-5 w-2/3 rounded bg-slate-100 animate-pulse" />
              <div className="h-4 w-full rounded bg-slate-100 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
            </div>
          ) : !pathDetail ? (
            <p className="text-sm text-slate-500">Learning path not found.</p>
          ) : (
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <h2 className="text-lg font-semibold text-slate-900 leading-tight">{pathDetail.title}</h2>
                <p className="text-sm text-slate-500 leading-relaxed">{pathDetail.description}</p>
                <p className="text-sm text-slate-400">Created {formatDate(pathDetail.created_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getCategoryBadge(pathDetail.category)}`}>
                  {pathDetail.category.replace('_', ' ')}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusBadge(pathDetail.status)}`}>
                  {pathDetail.status}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                  {pathDetail.total_duration}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPopupSection(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                popupSection === key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {key === 'ENROLLMENTS' && !loading && (
                <span className="ml-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">
                  {pathEnrollments.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {popupSection === 'DETAILS' ? (
        /* Course Structure Table */
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-blue-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-blue-700">Course Structure</h3>
            {!loading && (
              <span className="text-sm text-slate-500">
                {stagedCourses.length} stage{stagedCourses.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : stagedCourses.length === 0 ? (
              <div className="bg-white text-center py-8">
                <p className="text-base text-slate-400">No courses found for this learning path.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-100/80 text-blue-900 border-b border-blue-200/60 text-left">
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider w-12">Stage</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Stage Title</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider w-16">#</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Course</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/60 bg-white">
                  {stagedCourses.flatMap((stage) =>
                    (stage.courses || []).length === 0 ? (
                      <tr key={stage.id}>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            {stage.stage_order}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">{stage.title}</td>
                        <td className="py-3.5 px-4 text-slate-400" colSpan={2}>No courses</td>
                      </tr>
                    ) : (
                      stage.courses!.map((course, idx) => (
                        <tr key={course.course_id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3 px-4">
                            {idx === 0 && (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                {stage.stage_order}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-sm">{idx === 0 ? stage.title : ''}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-400">{course.course_order}</td>
                          <td className="py-3 px-4 text-slate-700">{course.title}</td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Enrolled Learners Table */
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-blue-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-blue-700">Enrolled Learners</h3>
            {!loading && (
              <span className="text-sm text-slate-500">
                {pathEnrollments.length} learner{pathEnrollments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 rounded bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : pathEnrollments.length === 0 ? (
              <div className="bg-white text-center py-8">
                <p className="text-base text-slate-400">No learners are enrolled in this learning path yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-100/80 text-blue-900 border-b border-blue-200/60 text-left">
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Learner</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Employee No.</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Designation</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Progress</th>
                    <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/60 bg-white">
                  {pathEnrollments.map((enrollment) => (
                    <tr key={enrollment.enrollment_id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-900 leading-tight">{enrollment.name}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{enrollment.email}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-sm">{enrollment.employee_number}</td>
                      <td className="py-3.5 px-4 text-slate-600 text-sm">{enrollment.designation || '—'}</td>
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <ProgressBar progress={Number(enrollment.progress || 0)} showLabel size="sm" />
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getEnrollmentStatusBadge(enrollment.status)}`}>
                          {enrollment.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}