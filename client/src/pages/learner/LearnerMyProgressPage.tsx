import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { learnerApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type AssignedLearningPath = {
  enrollmentId: string;
  learningPathId: string;
  title: string;
  progress: number;
  status: string;
};

type PathCourse = {
  courseId: string;
  title: string;
  order: number;
  stageTitle: string | null;
  stageOrder: number;
  isCompleted: boolean;
  deliveryMode: 'ONLINE' | 'PHYSICAL';
  venue: string | null;
  videoUrl: string | null;
};

export function LearnerMyProgressPage() {
  const { getAccessToken, user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [courseUpdateLoadingId, setCourseUpdateLoadingId] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(Boolean(user?.isSupervisor));
  const [learnerName, setLearnerName] = useState(user?.name || 'Learner');
  const [assignedLearningPaths, setAssignedLearningPaths] = useState<AssignedLearningPath[]>([]);
  const [selectedPathCourses, setSelectedPathCourses] = useState<PathCourse[]>([]);
  const [selectedPathMeta, setSelectedPathMeta] = useState<{
    enrollmentId: string;
    learningPathTitle: string;
    progress: number;
    status: string;
    totalCourses: number;
    completedCourses: number;
  } | null>(null);
  const statSkeletons = Array.from({ length: 3 }, (_, index) => index);
  const listSkeletons = Array.from({ length: 3 }, (_, index) => index);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const [profileResponse, dashboardResponse, teamResponse] = await Promise.all([
        learnerApi.getProfile(token),
        learnerApi.getDashboard(token),
        learnerApi.getTeam(token)
      ]);

      const profile = profileResponse.profile || {};
      const profileName =
        (typeof profile.employeeName === 'string' && profile.employeeName.trim()) ||
        user?.name ||
        'Learner';

      setLearnerName(profileName);
      setIsSupervisor(teamResponse.isSupervisor);
      setAssignedLearningPaths(dashboardResponse.assignedLearningPaths);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learner progress.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast, user?.name]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const totalLearningPaths = assignedLearningPaths.length;
    const completedLearningPaths = assignedLearningPaths.filter((row) => row.status === 'COMPLETED').length;
    const remainingLearningPaths = Math.max(totalLearningPaths - completedLearningPaths, 0);
    return { totalLearningPaths, completedLearningPaths, remainingLearningPaths };
  }, [assignedLearningPaths]);

  const groupedCoursesByStage = useMemo(() => {
    const grouped = new Map<
      string,
      { stageTitle: string; stageOrder: number; courses: PathCourse[] }
    >();

    for (const course of selectedPathCourses) {
      const stageOrder = Number(course.stageOrder || 0);
      const stageTitle =
        (typeof course.stageTitle === 'string' && course.stageTitle.trim()) ||
        `Stage ${stageOrder || 1}`;
      const key = `${stageOrder}-${stageTitle}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          stageTitle,
          stageOrder,
          courses: []
        });
      }
      grouped.get(key)?.courses.push(course);
    }

    return Array.from(grouped.values())
      .sort((a, b) => a.stageOrder - b.stageOrder)
      .map((stage) => ({
        ...stage,
        courses: [...stage.courses].sort((a, b) => a.order - b.order)
      }));
  }, [selectedPathCourses]);

  const openLearningPathModal = async (enrollmentId: string) => {
    try {
      setModalLoading(true);
      setSelectedEnrollmentId(enrollmentId);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learnerApi.getMyPathCourses(token, enrollmentId);
      setSelectedPathMeta({
        enrollmentId: response.enrollment.id,
        learningPathTitle: response.enrollment.learningPathTitle,
        progress: response.enrollment.progress,
        status: response.enrollment.status,
        totalCourses: response.enrollment.totalCourses,
        completedCourses: response.enrollment.completedCourses
      });
      setSelectedPathCourses(response.courses);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learning path courses.', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedEnrollmentId(null);
    setSelectedPathCourses([]);
    setSelectedPathMeta(null);
  };

  const handleToggleCourse = async (course: PathCourse, completed: boolean) => {
    if (!selectedEnrollmentId) {
      return;
    }

    try {
      setCourseUpdateLoadingId(course.courseId);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learnerApi.updateCourseCompletion(
        token,
        selectedEnrollmentId,
        course.courseId,
        completed
      );

      setSelectedPathMeta({
        enrollmentId: response.enrollment.id,
        learningPathTitle: response.enrollment.learningPathTitle,
        progress: response.enrollment.progress,
        status: response.enrollment.status,
        totalCourses: response.enrollment.totalCourses,
        completedCourses: response.enrollment.completedCourses
      });
      setSelectedPathCourses(response.courses);
      setAssignedLearningPaths((prev) =>
        prev.map((path) =>
          path.enrollmentId === response.enrollment.id
            ? { ...path, progress: response.enrollment.progress, status: response.enrollment.status }
            : path
        )
      );
      if (response.enrollment.progress >= 100) {
        window.dispatchEvent(new Event('notifications:updated'));
        showToast('Learning path completed. Certificate generated.', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update course completion.', 'error');
    } finally {
      setCourseUpdateLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Welcome {learnerName}</h1>
        <p className="text-secondary-600 mt-2">
          My learning progress
          {isSupervisor ? ' | You also have Supervisor Dashboard access from the sidebar.' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statSkeletons.map((index) => (
          <Card key={`progress-stat-${index}`} className="p-6">
            <p className="text-sm font-medium text-secondary-600">
              {index === 0 ? 'Assigned Learning Paths' : index === 1 ? 'Completed Learning Paths' : 'Pending Learning Paths'}
            </p>
            {loading ? (
              <Skeleton className="mt-2 h-9 w-16" />
            ) : (
              <p className={`text-3xl font-bold ${index === 1 ? 'text-success-600' : index === 2 ? 'text-warning-600' : 'text-secondary-900'}`}>
                {index === 0 ? summary.totalLearningPaths : index === 1 ? summary.completedLearningPaths : summary.remainingLearningPaths}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card title="My Learning Progress" className="animate-fade-in">
        <div className="space-y-4">
          {loading ? (
            listSkeletons.map((index) => (
              <div key={`progress-row-skeleton-${index}`} className="rounded-xl border border-secondary-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : assignedLearningPaths.map((path) => (
            <button
              key={path.enrollmentId}
              type="button"
              onClick={() => openLearningPathModal(path.enrollmentId)}
              className="w-full text-left p-4 rounded-xl border border-secondary-200 bg-white hover:border-primary-300 hover:shadow-soft transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-secondary-900 group-hover:text-primary-700">{path.title}</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  path.status === 'COMPLETED'
                    ? 'bg-success-100 text-success-700'
                    : path.status === 'IN_PROGRESS'
                    ? 'bg-warning-100 text-warning-700'
                    : 'bg-secondary-100 text-secondary-700'
                }`}>
                  {path.status.replace('_', ' ')}
                </span>
              </div>
              <ProgressBar progress={path.progress} showLabel size="sm" />
            </button>
          ))}
          {!loading && assignedLearningPaths.length === 0 ? (
            <p className="text-sm text-secondary-500 text-center py-8">No assigned learning paths yet.</p>
          ) : null}
        </div>
      </Card>

      {selectedEnrollmentId ? (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-large">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-xl font-semibold text-secondary-900">Learning Path Details</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-secondary-500 hover:bg-secondary-100 hover:text-secondary-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              {modalLoading ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-4">
                    <Skeleton className="mb-2 h-6 w-56" />
                    <Skeleton className="mb-3 h-4 w-48" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  {listSkeletons.map((index) => (
                    <div key={`modal-course-skeleton-${index}`} className="rounded-xl border border-secondary-200 bg-white p-4">
                      <Skeleton className="mb-2 h-5 w-44" />
                      <Skeleton className="mb-2 h-4 w-20 rounded-full" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  ))}
                </div>
              ) : selectedPathMeta ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-secondary-200 bg-secondary-50">
                    <p className="font-semibold text-secondary-900 text-lg">{selectedPathMeta.learningPathTitle}</p>
                    <p className="text-sm text-secondary-600 mt-1">
                      {selectedPathMeta.completedCourses}/{selectedPathMeta.totalCourses} courses completed
                      {' | '}
                      <span className={`font-medium ${
                        selectedPathMeta.status === 'COMPLETED'
                          ? 'text-success-600'
                          : selectedPathMeta.status === 'IN_PROGRESS'
                          ? 'text-warning-600'
                          : 'text-secondary-600'
                      }`}>
                        {selectedPathMeta.status.replace('_', ' ')}
                      </span>
                    </p>
                    <div className="mt-3">
                      <ProgressBar progress={selectedPathMeta.progress} showLabel size="md" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {groupedCoursesByStage.map((stage) => (
                      <div key={`${stage.stageOrder}-${stage.stageTitle}`} className="space-y-2">
                        <p className="text-sm font-semibold text-secondary-800 mb-3">
                          Stage {stage.stageOrder}: {stage.stageTitle}
                        </p>
                        {stage.courses.map((course) => (
                          <div
                            key={course.courseId}
                            className="flex items-start gap-4 p-4 rounded-xl border border-secondary-200 bg-white hover:border-primary-300 hover:shadow-soft transition-all duration-200"
                          >
                            <input
                              type="checkbox"
                              checked={course.isCompleted}
                              disabled={courseUpdateLoadingId === course.courseId}
                              onChange={(event) => handleToggleCourse(course, event.target.checked)}
                              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                            />
                            <div className="flex-1">
                              <span className="block text-sm font-semibold text-secondary-900">
                                {course.order}. {course.title}
                              </span>
                              <span className={`block text-xs px-2 py-1 rounded-full font-medium w-fit mt-1 ${
                                course.isCompleted
                                  ? 'bg-success-100 text-success-700'
                                  : 'bg-secondary-100 text-secondary-700'
                              }`}>
                                {course.isCompleted ? 'Completed' : 'Pending'}
                              </span>
                              <span className="block text-xs text-secondary-500 mt-2">
                                {course.deliveryMode === 'ONLINE'
                                  ? 'Mode: Online'
                                  : `Mode: Physical${course.venue ? ` | Venue: ${course.venue}` : ''}`}
                              </span>
                            </div>
                            {course.deliveryMode === 'ONLINE' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  course.videoUrl && window.open(course.videoUrl, '_blank', 'noopener,noreferrer')
                                }
                                disabled={!course.videoUrl}
                              >
                                Learn Now
                              </Button>
                            ) : (
                              <span className="text-xs text-secondary-500 border border-secondary-200 rounded-lg px-3 py-1 bg-secondary-50">
                                Physical Course
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    {selectedPathCourses.length === 0 ? (
                      <p className="text-sm text-slate-500">No courses configured for this learning path.</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select a learning path to view courses.</p>
              )}
            </div>

            <div className="border-t border-secondary-200 px-6 py-4 flex justify-end bg-secondary-50 rounded-b-2xl">
              <Button type="button" variant="outline" onClick={closeModal}>
                Close
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
