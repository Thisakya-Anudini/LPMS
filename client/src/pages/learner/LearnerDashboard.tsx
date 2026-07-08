import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { learnerApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';

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
};

export function LearnerDashboard() {
  const { getAccessToken, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [selfEnrollLoadingId, setSelfEnrollLoadingId] = useState<string | null>(null);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [coursePanelLoading, setCoursePanelLoading] = useState(false);
  const [courseUpdateLoadingId, setCourseUpdateLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const [publicLearningPaths, setPublicLearningPaths] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      total_duration: string;
      already_enrolled: boolean;
    }>
  >([]);
  const statSkeletons = Array.from({ length: 3 }, (_, index) => index);
  const listSkeletons = Array.from({ length: 3 }, (_, index) => index);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      const [profileResponse, dashboardResponse, teamResponse, publicPathsResponse] = await Promise.all([
        learnerApi.getProfile(token),
        learnerApi.getDashboard(token),
        learnerApi.getTeam(token),
        learnerApi.getPublicPaths(token)
      ]);

      const profile = profileResponse.profile || {};
      const profileName =
        (typeof profile.employeeName === 'string' && profile.employeeName.trim()) ||
        user?.name ||
        'Learner';

      setLearnerName(profileName);
      setIsSupervisor(teamResponse.isSupervisor);
      setAssignedLearningPaths(dashboardResponse.assignedLearningPaths);
      setPublicLearningPaths(publicPathsResponse.learningPaths);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learner dashboard.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, user?.name]);

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

  const handleSelfEnroll = async (learningPathId: string) => {
    try {
      setSelfEnrollLoadingId(learningPathId);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      await learnerApi.selfEnroll(token, learningPathId);
      await load();
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to self enroll.');
    } finally {
      setSelfEnrollLoadingId(null);
    }
  };

  const handleOpenLearningPath = async (enrollmentId: string) => {
    try {
      setCoursePanelLoading(true);
      setError(null);
      setSelectedEnrollmentId(enrollmentId);
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
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
      setError(err instanceof Error ? err.message : 'Failed to load learning path courses.');
    } finally {
      setCoursePanelLoading(false);
    }
  };

  const handleToggleCourse = async (course: PathCourse, completed: boolean) => {
    if (!selectedEnrollmentId) {
      return;
    }

    try {
      setCourseUpdateLoadingId(course.courseId);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
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
            ? {
              ...path,
              progress: response.enrollment.progress,
              status: response.enrollment.status
            }
            : path
        )
      );
      if (response.enrollment.progress >= 100) {
        window.dispatchEvent(new Event('notifications:updated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update course completion.');
    } finally {
      setCourseUpdateLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome {learnerName}</h1>
        <p className="text-slate-500">
          Learner dashboard
          {isSupervisor ? ' | You also have Supervisor Dashboard access from the top navigation.' : ''}
        </p>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statSkeletons.map((index) => (
          <Card key={`learner-stat-${index}`} className="p-4">
            <p className="text-sm text-slate-500">
              {index === 0 ? 'Assigned Learning Paths' : index === 1 ? 'Completed Learning Paths' : 'Pending Learning Paths'}
            </p>
            {loading ? <Skeleton className="mt-2 h-8 w-16" /> : (
              <p className="text-2xl font-bold text-slate-900">
                {index === 0 ? summary.totalLearningPaths : index === 1 ? summary.completedLearningPaths : summary.remainingLearningPaths}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card title="My Learning Progress">
        <div className="space-y-4">
          {loading ? (
            listSkeletons.map((index) => (
              <div key={`assigned-skeleton-${index}`} className="w-full rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
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
              onClick={() => handleOpenLearningPath(path.enrollmentId)}
              className={`w-full text-left p-2 rounded-lg border transition-colors ${
                selectedEnrollmentId === path.enrollmentId
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-slate-900">{path.title}</p>
                <span className="text-xs text-slate-500">{path.status.replace('_', ' ')}</span>
              </div>
              <ProgressBar progress={path.progress} showLabel size="sm" />
            </button>
          ))}
          {!loading && assignedLearningPaths.length === 0 ? (
            <p className="text-sm text-slate-500">No assigned learning paths yet.</p>
          ) : null}
        </div>
      </Card>

      {selectedEnrollmentId ? (
        <Card title="Learning Path Courses">
          {coursePanelLoading ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Skeleton className="mb-2 h-5 w-56" />
                <Skeleton className="mb-2 h-4 w-44" />
                <Skeleton className="h-3 w-full" />
              </div>
              {listSkeletons.map((index) => (
                <div key={`course-skeleton-${index}`} className="rounded border border-slate-200 bg-white p-3">
                  <Skeleton className="mb-2 h-5 w-40" />
                  <Skeleton className="mb-2 h-4 w-20" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          ) : selectedPathMeta ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <p className="font-semibold text-slate-900">{selectedPathMeta.learningPathTitle}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedPathMeta.completedCourses}/{selectedPathMeta.totalCourses} courses completed
                  {' | '}
                  {selectedPathMeta.status.replace('_', ' ')}
                </p>
                <div className="mt-2">
                  <ProgressBar progress={selectedPathMeta.progress} showLabel size="sm" />
                </div>
              </div>

              <div className="space-y-2">
                {groupedCoursesByStage.map((stage) => (
                  <div key={`${stage.stageOrder}-${stage.stageTitle}`} className="space-y-2">
                    <p className="text-sm font-semibold text-slate-800">
                      Stage {stage.stageOrder}: {stage.stageTitle}
                    </p>
                    {stage.courses.map((course) => (
                      <label
                        key={course.courseId}
                        className="flex items-start gap-3 p-3 rounded border border-slate-200 bg-white hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={course.isCompleted}
                          disabled={courseUpdateLoadingId === course.courseId}
                          onChange={(event) => handleToggleCourse(course, event.target.checked)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-900">
                            {course.order}. {course.title}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {course.isCompleted ? 'Completed' : 'Pending'}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {course.deliveryMode === 'ONLINE'
                              ? 'Mode: Online'
                              : course.deliveryMode === 'PHYSICAL'
                                ? `Mode: Physical${course.venue ? ` | Venue: ${course.venue}` : ''}`
                                : 'Mode: N/A'}
                          </span>
                        </span>
                      </label>
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
        </Card>
      ) : null}

      <Card title="Public Learning Paths - Self Enrollment">
        <div className="space-y-3">
          {loading ? (
            listSkeletons.map((index) => (
              <div
                key={`public-skeleton-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <Skeleton className="mb-2 h-5 w-44" />
                <Skeleton className="mb-2 h-4 w-full" />
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-28 rounded-lg" />
                </div>
              </div>
            ))
          ) : publicLearningPaths.length === 0 ? (
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
