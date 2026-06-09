import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, LibraryBig, Sparkles, X } from 'lucide-react';
import { learnerApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';
import { LearnerPublicPathsPanel } from './LearnerPublicPathsPage';

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
  duration: string | null;
  order: number;
  stageTitle: string | null;
  stageOrder: number;
  isCompleted: boolean;
  erpStatus: string | null;
  deliveryMode: 'ONLINE' | 'PHYSICAL';
  venue: string | null;
  videoUrl: string | null;
};

type LearningPathSummary = {
  id: string;
  title: string;
  description: string;
  category: 'PUBLIC' | 'RESTRICTED';
  totalDuration: string;
};

type OtherCourse = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  duration: string | null;
  durationHours?: number | null;
  deliveryMode: 'ONLINE' | 'PHYSICAL' | null;
  videoUrl?: string | null;
  venue?: string | null;
  erpStatus: string | null;
  isCompleted: boolean;
  alreadyEnrolled: boolean;
  learningPaths: LearningPathSummary[];
};

type AlreadyEnrolledCourse = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  duration: string | null;
  erpStatus: string | null;
  isCompleted: boolean;
  deliveryMode: 'ONLINE' | 'PHYSICAL';
  stageTitle: string | null;
  stageOrder: number;
  courseOrder: number;
  enrollment: {
    id: string;
    status: string;
    progress: number;
  };
  learningPath: LearningPathSummary;
};

const normalizeDisplayValue = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  return normalized && !['-', 'n/a', 'na', 'null', 'undefined'].includes(normalized.toLowerCase())
    ? normalized
    : null;
};

const getCourseStatusClassName = (isCompleted: boolean, status: string | null | undefined) => {
  if (isCompleted) {
    return 'bg-success-100 text-success-700';
  }
  if (normalizeDisplayValue(status)) {
    return 'bg-primary-50 text-primary-700';
  }
  return 'bg-secondary-100 text-secondary-700';
};

export function LearnerMyProgressPage() {
  const { getAccessToken, user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [activeLearningSection, setActiveLearningSection] = useState<'assigned' | 'self'>('assigned');
  const [activeSelfEnrollmentSection, setActiveSelfEnrollmentSection] = useState<'public' | 'other'>('public');
  const [activeOtherCourseSection, setActiveOtherCourseSection] = useState<'enrolled' | 'preferred'>('enrolled');
  const [otherCoursesLoading, setOtherCoursesLoading] = useState(false);
  const [otherCoursesLoaded, setOtherCoursesLoaded] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [isSupervisor, setIsSupervisor] = useState(Boolean(user?.isSupervisor));
  const [learnerName, setLearnerName] = useState(user?.name || 'Learner');
  const [assignedLearningPaths, setAssignedLearningPaths] = useState<AssignedLearningPath[]>([]);
  const [selectedPathCourses, setSelectedPathCourses] = useState<PathCourse[]>([]);
  const [alreadyEnrolledCourses, setAlreadyEnrolledCourses] = useState<AlreadyEnrolledCourse[]>([]);
  const [preferredCourses, setPreferredCourses] = useState<OtherCourse[]>([]);
  const [selectedPathMeta, setSelectedPathMeta] = useState<{
    enrollmentId: string;
    learningPathTitle: string;
    totalDuration: string | null;
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

  const loadOtherCourses = useCallback(async () => {
    try {
      setOtherCoursesLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learnerApi.getOtherCourses(token);
      setAlreadyEnrolledCourses(response.alreadyEnrolledCourses);
      setPreferredCourses(response.preferredCourses);
      // Note: 'All Courses' list removed per UI change
      setOtherCoursesLoaded(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load other courses.', 'error');
    } finally {
      setOtherCoursesLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    if (activeLearningSection === 'self' && activeSelfEnrollmentSection === 'other' && !otherCoursesLoaded) {
      loadOtherCourses();
    }
  }, [activeLearningSection, activeSelfEnrollmentSection, loadOtherCourses, otherCoursesLoaded]);

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

  const normalizedCourseSearch = courseSearch.trim().toLowerCase();
  const filteredPreferredCourses = useMemo(() => {
    if (!normalizedCourseSearch) {
      return preferredCourses;
    }
    return preferredCourses.filter((course) =>
      [course.title, course.code, course.description]
        .some((value) => String(value || '').toLowerCase().includes(normalizedCourseSearch))
    );
  }, [normalizedCourseSearch, preferredCourses]);

  const selectedPathDuration = normalizeDisplayValue(selectedPathMeta?.totalDuration);

  // 'All Courses' list and filtering removed

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
        totalDuration: response.enrollment.totalDuration,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Welcome {learnerName}</h1>
        <p className="text-secondary-600 mt-2">
          My learning progress
          {isSupervisor ? ' | You also have Supervisor Dashboard access from the top navigation.' : ''}
        </p>
      </div>

      <div className="rounded-xl border border-secondary-200 bg-white p-2 shadow-soft">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveLearningSection('assigned')}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all ${
              activeLearningSection === 'assigned'
                ? 'bg-primary-600 text-white shadow-soft'
                : 'text-secondary-700 hover:bg-secondary-50'
            }`}
          >
            <BookOpen className="h-5 w-5" />
            <span>
              <span className="block text-sm font-semibold">Assigned LPs</span>
              <span className={`block text-xs ${activeLearningSection === 'assigned' ? 'text-primary-100' : 'text-secondary-500'}`}>
                Learning paths assigned to you
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveLearningSection('self')}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all ${
              activeLearningSection === 'self'
                ? 'bg-primary-600 text-white shadow-soft'
                : 'text-secondary-700 hover:bg-secondary-50'
            }`}
          >
            <Sparkles className="h-5 w-5" />
            <span>
              <span className="block text-sm font-semibold">Self Enrollment</span>
              <span className={`block text-xs ${activeLearningSection === 'self' ? 'text-primary-100' : 'text-secondary-500'}`}>
                Public LPs and other learning options
              </span>
            </span>
          </button>
        </div>
      </div>

      {activeLearningSection === 'assigned' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statSkeletons.map((index) => (
              <Card key={`progress-stat-${index}`} className="px-4 py-1.5">
                <p className="text-lg font-medium text-secondary-600">
                  {index === 0 ? 'Assigned Learning Paths' : index === 1 ? 'Completed Learning Paths' : 'Pending Learning Paths'}
                </p>
                {loading ? (
                  <Skeleton className="mt-2 h-9 w-16" />
                ) : (
                  <p className={`text-2xl font-bold ${index === 1 ? 'text-success-600' : index === 2 ? 'text-warning-600' : 'text-secondary-900'}`}>
                    {index === 0 ? summary.totalLearningPaths : index === 1 ? summary.completedLearningPaths : summary.remainingLearningPaths}
                  </p>
                )}
              </Card>
            ))}
          </div>

          <Card title="Assigned LPs" className="animate-fade-in">
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
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-3">
            <div className="relative w-full max-w-3xl mx-auto">
              <div className="relative rounded-full bg-white/10 p-1">
                <div
                  aria-hidden
                  className={`absolute top-1 bottom-1 left-1 w-1/2 rounded-full bg-gradient-to-r from-primary-600 to-primary-500 shadow-md transition-transform duration-300 ${
                    activeSelfEnrollmentSection === 'other' ? 'translate-x-full' : 'translate-x-0'
                  }`}
                />

                <div className="relative z-10 grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setActiveSelfEnrollmentSection('public')}
                    className={`flex items-center justify-center gap-3 px-6 py-3 rounded-full text-sm font-semibold transition-colors duration-200 ${
                      activeSelfEnrollmentSection === 'public' ? 'text-white' : 'text-secondary-700'
                    }`}
                  >
                    <Sparkles className={`h-4 w-4 ${activeSelfEnrollmentSection === 'public' ? 'text-white' : 'text-secondary-400'}`} />
                    <span>Public LPs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSelfEnrollmentSection('other')}
                    className={`flex items-center justify-center gap-3 px-6 py-3 rounded-full text-sm font-semibold transition-colors duration-200 ${
                      activeSelfEnrollmentSection === 'other' ? 'text-white' : 'text-secondary-700'
                    }`}
                  >
                    <LibraryBig className={`h-4 w-4 ${activeSelfEnrollmentSection === 'other' ? 'text-white' : 'text-secondary-400'}`} />
                    <span>Other Courses</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {activeSelfEnrollmentSection === 'public' ? (
            <LearnerPublicPathsPanel showHeader={false} cardTitle="Public LPs" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-3">
                <div className="relative w-full max-w-3xl mx-auto">
                  <div className="relative rounded-full bg-white/10 p-1">
                    <div
                      aria-hidden
                      className={`absolute top-1 bottom-1 left-1 w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                        activeOtherCourseSection === 'preferred' ? 'translate-x-full' : 'translate-x-0'
                      }`}
                    />

                    <div className="relative z-10 grid grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setActiveOtherCourseSection('enrolled')}
                        className={`px-6 py-3 text-sm font-medium rounded-full transition-colors duration-200 ${
                          activeOtherCourseSection === 'enrolled' ? 'text-primary-700' : 'text-secondary-600'
                        }`}
                      >
                        Already Enrolled Courses ({alreadyEnrolledCourses.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveOtherCourseSection('preferred')}
                        className={`px-6 py-3 text-sm font-medium rounded-full transition-colors duration-200 ${
                          activeOtherCourseSection === 'preferred' ? 'text-primary-700' : 'text-secondary-600'
                        }`}
                      >
                        Preferred Courses ({preferredCourses.length})
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {activeOtherCourseSection === 'enrolled' ? (
                <Card title="Already Enrolled Courses">
                  {otherCoursesLoading ? (
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
                      {listSkeletons.map((index) => (
                        <div key={`enrolled-course-skeleton-${index}`} className="rounded-lg border border-secondary-200 bg-white p-3">
                          <Skeleton className="mb-2 h-5 w-56" />
                          <Skeleton className="mb-2 h-4 w-40" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : alreadyEnrolledCourses.length === 0 ? (
                    <p className="text-sm text-secondary-500">No already enrolled courses found.</p>
                  ) : (
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
                      {alreadyEnrolledCourses.map((course, index) => {
                        const courseDuration = normalizeDisplayValue(course.duration);
                        const courseStatus = normalizeDisplayValue(course.erpStatus) || 'Already Enrolled';
                        return (
                        <div
                          key={`${course.learningPath.id}-${course.code || course.id}-${index}`}
                          className="rounded-lg border border-secondary-200 bg-white p-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-secondary-900">
                              {course.title}{' '}
                              {course.deliveryMode === 'ONLINE' ? 'Online' : course.deliveryMode === 'PHYSICAL' ? 'Physical' : ''}
                            </p>

                            <p className="mt-2 text-xs font-medium tracking-wide text-secondary-500">{course.code}</p>
                            {courseDuration ? (
                              <p className="mt-1 text-xs text-secondary-600">Duration: {courseDuration}</p>
                            ) : null}

                            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-secondary-700">
                              {course.learningPath.category}
                            </p>

                            <p className="mt-1 text-xs text-secondary-700">
                              Learning Path - {course.learningPath.title}
                            </p>

                            <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getCourseStatusClassName(course.isCompleted, course.erpStatus)}`}>
                              {courseStatus}
                            </span>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ) : (
                <Card title="Preferred Courses">
                <div className="mb-4">
                  <input
                    type="search"
                    value={courseSearch}
                    onChange={(event) => setCourseSearch(event.target.value)}
                    placeholder="Search by course name or ID"
                    className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm text-secondary-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                </div>
                {otherCoursesLoading ? (
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
                    {listSkeletons.map((index) => (
                      <div key={`preferred-course-skeleton-${index}`} className="rounded-lg border border-secondary-200 bg-white p-3">
                        <Skeleton className="mb-2 h-5 w-56" />
                        <Skeleton className="mb-2 h-4 w-40" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                ) : filteredPreferredCourses.length === 0 ? (
                  <p className="text-sm text-secondary-500">No preferred courses found.</p>
                ) : (
                  <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-2 lg:grid-cols-2">
                    {filteredPreferredCourses.map((course, index) => {
                      const courseDuration = normalizeDisplayValue(course.duration);
                      const courseStatus = normalizeDisplayValue(course.erpStatus);
                      return (
                      <div key={`${course.code || course.id}-preferred-${index}`} className="rounded-lg border border-secondary-200 bg-white p-3">
                        <div className="flex h-full flex-col gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-secondary-900">{course.title}</p>
                            <p className="mt-1 text-xs text-secondary-500">{course.code}</p>
                            {courseDuration ? (
                              <p className="mt-1 text-xs text-secondary-600">Duration: {courseDuration}</p>
                            ) : null}
                            {course.description ? (
                              <p className="mt-1 text-xs text-secondary-600">{course.description}</p>
                            ) : null}
                            <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getCourseStatusClassName(course.isCompleted, course.erpStatus)}`}>
                              {courseStatus || 'Preferred'}
                            </span>
                          </div>
                          <Button type="button" size="sm" className="w-full" disabled>
                            Enroll
                          </Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
                </Card>
              )}

              {/* 'All Courses' section removed per request */}
            </div>
          )}
        </div>
      )}

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
                      {selectedPathDuration ? ` | Duration: ${selectedPathDuration}` : ''}
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
                        {stage.courses.map((course) => {
                          const courseDuration = normalizeDisplayValue(course.duration);
                          return (
                          <div
                            key={course.courseId}
                            className="flex items-start gap-4 p-4 rounded-xl border border-secondary-200 bg-white hover:border-primary-300 hover:shadow-soft transition-all duration-200"
                          >
                            <input
                              type="checkbox"
                              checked={course.isCompleted}
                              disabled
                              readOnly
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
                                {course.erpStatus || (course.isCompleted ? 'Completed' : 'Not Enrolled')}
                              </span>
                              <span className="block text-xs text-secondary-500 mt-2">
                                {course.deliveryMode === 'ONLINE'
                                  ? 'Mode: Online'
                                  : `Mode: Physical${course.venue ? ` | Venue: ${course.venue}` : ''}`}
                                {courseDuration ? ` | Duration: ${courseDuration}` : ''}
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
                          );
                        })}
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
