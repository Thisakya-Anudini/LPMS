import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Download, Layers, RefreshCcw, School, Search, Users } from 'lucide-react';
import { learningApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type LearningPathOption = {
  id: string;
  title: string;
  description: string;
  status: string;
};

type PathCourse = {
  courseId: string;
  courseCode: string;
  title: string;
  stageTitle: string | null;
  stageOrder: number;
  order: number;
};

type ClassOption = {
  id: string;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
  venue: string;
  instructor: string;
  capacity: string;
  raw: Record<string, unknown>;
};

type EnrolledLearner = {
  enrollmentId: string;
  principalId: string;
  employeeNumber: string | null;
  name: string;
  email: string;
  designation: string | null;
  gradeName: string | null;
  status: string;
  progress: number;
  enrolledAt: string;
  classAssignments: Array<{
    id: string;
    courseCode: string;
      classId: string;
      classCode: string | null;
      classTitle: string | null;
      classPayload?: Record<string, unknown>;
      assignedAt: string;
    }>;
};

const getAssignmentForCourse = (learner: EnrolledLearner, courseCode: string) =>
  learner.classAssignments.find((assignment) => assignment.courseCode === courseCode);

const getPayloadValue = (payload: Record<string, unknown> | undefined, keys: string[]) => {
  if (!payload) {
    return '';
  }

  const normalizedEntries = Object.entries(payload).map(([key, value]) => ({
    key: key.toLowerCase().replace(/[^a-z0-9]/g, ''),
    value
  }));

  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = normalizedEntries.find((entry) => entry.key === normalizedKey);
    if (match?.value !== null && match?.value !== undefined && String(match.value).trim() !== '') {
      return String(match.value).trim();
    }
  }

  return '';
};

const getPayloadValueByTokens = (payload: Record<string, unknown> | undefined, tokenGroups: string[][]) => {
  if (!payload) {
    return '';
  }

  const entries = Object.entries(payload);
  for (const tokens of tokenGroups) {
    const normalizedTokens = tokens.map((token) => token.toLowerCase());
    const match = entries.find(([key, value]) => {
      if (value === null || value === undefined || String(value).trim() === '') {
        return false;
      }
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedTokens.every((token) => normalizedKey.includes(token));
    });
    if (match) {
      return String(match[1]).trim();
    }
  }

  return '';
};

const getClassPayloadDate = (
  payload: Record<string, unknown> | undefined,
  keys: string[],
  tokenGroups: string[][]
) => {
  const rawPayload = payload?.raw && typeof payload.raw === 'object'
    ? (payload.raw as Record<string, unknown>)
    : undefined;

  return (
    getPayloadValue(payload, keys) ||
    getPayloadValue(rawPayload, keys) ||
    getPayloadValueByTokens(payload, tokenGroups) ||
    getPayloadValueByTokens(rawPayload, tokenGroups)
  );
};

const escapeCsvValue = (value: unknown) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

export function AssignEnrollmentToClassesPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [learningPaths, setLearningPaths] = useState<LearningPathOption[]>([]);
  const [selectedPathId, setSelectedPathId] = useState('');
  const [courses, setCourses] = useState<PathCourse[]>([]);
  const [learners, setLearners] = useState<EnrolledLearner[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);
  const [learnerSearch, setLearnerSearch] = useState('');
  const [batchSize, setBatchSize] = useState('50');
  const [pathsLoading, setPathsLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const selectedPath = useMemo(
    () => learningPaths.find((path) => path.id === selectedPathId) || null,
    [learningPaths, selectedPathId]
  );
  const selectedCourse = useMemo(
    () => courses.find((course) => course.courseCode === selectedCourseCode) || null,
    [courses, selectedCourseCode]
  );
  const selectedClass = useMemo(
    () => classes.find((classItem) => classItem.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const assignedForCourse = useMemo(
    () => learners.filter((learner) => Boolean(getAssignmentForCourse(learner, selectedCourseCode))).length,
    [learners, selectedCourseCode]
  );
  const unassignedForCourse = selectedCourseCode ? learners.length - assignedForCourse : 0;

  const availableLearners = useMemo(() => {
    if (!selectedCourseCode) {
      return learners;
    }
    return learners.filter((learner) => !getAssignmentForCourse(learner, selectedCourseCode));
  }, [learners, selectedCourseCode]);

  const filteredLearners = useMemo(() => {
    const search = learnerSearch.trim().toLowerCase();
    if (!search) {
      return availableLearners;
    }
    return availableLearners.filter((learner) =>
      [
        learner.name,
        learner.email,
        learner.employeeNumber,
        learner.designation,
        learner.gradeName,
        getAssignmentForCourse(learner, selectedCourseCode)?.classTitle
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }, [availableLearners, learnerSearch, selectedCourseCode]);

  const reportRows = useMemo(() => {
    if (!selectedPath || courses.length === 0 || learners.length === 0) {
      return [];
    }

    return learners.flatMap((learner) =>
      courses.map((course) => {
        const assignment = getAssignmentForCourse(learner, course.courseCode);
        return {
          learningPath: selectedPath.title,
          employeeNumber: learner.employeeNumber || '',
          learnerName: learner.name,
          email: learner.email,
          designation: learner.designation || '',
          gradeName: learner.gradeName || '',
          courseCode: course.courseCode,
          courseTitle: course.title,
          classCode: assignment?.classCode || '',
          classTitle: assignment?.classTitle || '',
          startDate: getClassPayloadDate(
            assignment?.classPayload,
            [
              'startDate',
              'classStartDate',
              'courseStartDate',
              'sessionStartDate',
              'fromDate',
              'dateFrom',
              'startDt',
              'fromDt',
              'commenceDate',
              'commencementDate'
            ],
            [
              ['start', 'date'],
              ['from', 'date'],
              ['commence', 'date']
            ]
          ),
          endDate: getClassPayloadDate(
            assignment?.classPayload,
            [
              'endDate',
              'classEndDate',
              'courseEndDate',
              'sessionEndDate',
              'toDate',
              'dateTo',
              'endDt',
              'toDt',
              'completionDate',
              'finishDate'
            ],
            [
              ['end', 'date'],
              ['to', 'date'],
              ['completion', 'date'],
              ['finish', 'date']
            ]
          ),
          assignmentStatus: assignment ? 'Assigned' : 'Not Assigned'
        };
      })
    );
  }, [courses, learners, selectedPath]);

  const reportSummary = useMemo(() => {
    const assigned = reportRows.filter((row) => row.assignmentStatus === 'Assigned').length;
    return {
      total: reportRows.length,
      assigned,
      notAssigned: reportRows.length - assigned
    };
  }, [reportRows]);

  const loadLearningPaths = useCallback(async () => {
    try {
      setPathsLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await learningApi.getLearningPaths(token);
      setLearningPaths(response.learningPaths);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load learning paths.', 'error');
    } finally {
      setPathsLoading(false);
    }
  }, [getAccessToken, showToast]);

  const loadPathOptions = useCallback(async () => {
    if (!selectedPathId) {
      setCourses([]);
      setLearners([]);
      return;
    }

    try {
      setOptionsLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await learningApi.getClassAssignmentOptions(token, selectedPathId);
      setCourses(response.courses);
      setLearners(response.learners);
      setSelectedCourseCode((currentCourseCode) =>
        response.courses.some((course) => course.courseCode === currentCourseCode)
          ? currentCourseCode
          : response.courses[0]?.courseCode || ''
      );
      setSelectedEnrollmentIds([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load class assignment options.', 'error');
    } finally {
      setOptionsLoading(false);
    }
  }, [getAccessToken, selectedPathId, showToast]);

  const loadClasses = useCallback(async () => {
    if (!selectedCourseCode) {
      setClasses([]);
      setSelectedClassId('');
      return;
    }

    try {
      setClassesLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await learningApi.getClassesByCourseCode(token, selectedCourseCode);
      setClasses(response.classes);
      setSelectedClassId(response.classes[0]?.id || '');
      setSelectedEnrollmentIds([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load ERP classes for this course.', 'error');
      setClasses([]);
      setSelectedClassId('');
    } finally {
      setClassesLoading(false);
    }
  }, [getAccessToken, selectedCourseCode, showToast]);

  useEffect(() => {
    loadLearningPaths();
  }, [loadLearningPaths]);

  useEffect(() => {
    loadPathOptions();
  }, [loadPathOptions]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const toggleLearner = (enrollmentId: string) => {
    setSelectedEnrollmentIds((prev) =>
      prev.includes(enrollmentId) ? prev.filter((id) => id !== enrollmentId) : [...prev, enrollmentId]
    );
  };

  const selectVisibleLearners = () => {
    setSelectedEnrollmentIds(filteredLearners.map((learner) => learner.enrollmentId));
  };

  const selectNextBatch = () => {
    const count = Math.max(1, Number(batchSize) || 50);
    const nextLearners = availableLearners
      .slice(0, count)
      .map((learner) => learner.enrollmentId);
    setSelectedEnrollmentIds(nextLearners);
  };

  const clearSelection = () => {
    setSelectedEnrollmentIds([]);
  };

  const handleAssign = async () => {
    if (!selectedPathId || !selectedCourseCode || !selectedClass || selectedEnrollmentIds.length === 0) {
      showToast('Select a learning path, course, class, and at least one learner.', 'error');
      return;
    }

    try {
      setAssigning(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await learningApi.assignClassEnrollments(token, {
        learningPathId: selectedPathId,
        courseCode: selectedCourseCode,
        class: selectedClass,
        enrollmentIds: selectedEnrollmentIds
      });
      showToast(`${response.assigned.length} learner(s) assigned to ${selectedClass.title}.`, 'success');
      await loadPathOptions();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to assign learners to class.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const downloadReport = () => {
    if (reportRows.length === 0) {
      showToast('Select a learning path with learners and courses before downloading the report.', 'error');
      return;
    }

    const headers = [
      'Learning Path',
      'Employee No',
      'Learner Name',
      'Email',
      'Designation',
      'Grade',
      'Course Code',
      'Course Title',
      'Class Code',
      'Class Title',
      'Start Date',
      'End Date',
      'Assignment Status'
    ];
    const csv = [
      headers.map(escapeCsvValue).join(','),
      ...reportRows.map((row) =>
        [
          row.learningPath,
          row.employeeNumber,
          row.learnerName,
          row.email,
          row.designation,
          row.gradeName,
          row.courseCode,
          row.courseTitle,
          row.classCode,
          row.classTitle,
          row.startDate,
          row.endDate,
          row.assignmentStatus
        ]
          .map(escapeCsvValue)
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (selectedPath?.title || 'learning-path-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    link.href = url;
    link.download = `${safeTitle}-class-assignment-report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pathOptions = [
    { value: '', label: 'Select learning path' },
    ...learningPaths.map((path) => ({ value: path.id, label: path.title }))
  ];
  const courseOptions = [
    { value: '', label: optionsLoading ? 'Loading courses...' : 'Select course' },
    ...courses.map((course) => ({ value: course.courseCode, label: `${course.courseCode} - ${course.title}` }))
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Assign Enrollment [Classes]</h1>
          <p className="mt-2 text-secondary-600">
            Allocate learners already enrolled in a learning path into ERP classes for each course.
          </p>
        </div>
        <Button variant="outline" onClick={loadPathOptions} disabled={!selectedPathId || optionsLoading}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary-700" />
            <div>
              <p className="text-sm text-secondary-500">Courses</p>
              <p className="text-xl font-bold text-secondary-900">{courses.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary-700" />
            <div>
              <p className="text-sm text-secondary-500">Enrolled Learners</p>
              <p className="text-xl font-bold text-secondary-900">{learners.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success-600" />
            <div>
              <p className="text-sm text-secondary-500">Assigned for Course</p>
              <p className="text-xl font-bold text-secondary-900">{assignedForCourse}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-warning-600" />
            <div>
              <p className="text-sm text-secondary-500">Not Assigned</p>
              <p className="text-xl font-bold text-secondary-900">{unassignedForCourse}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Class Assignment Setup" description="Choose the learning path, course, and ERP class before selecting learners.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Select
            label="Learning Path"
            value={selectedPathId}
            options={pathOptions}
            isLoading={pathsLoading}
            onChange={(event) => setSelectedPathId(event.target.value)}
          />
          <Select
            label="Course in Learning Path"
            value={selectedCourseCode}
            options={courseOptions}
            disabled={!selectedPathId || optionsLoading || courses.length === 0}
            onChange={(event) => {
              setSelectedCourseCode(event.target.value);
              setSelectedClassId('');
              setSelectedEnrollmentIds([]);
            }}
          />
        </div>
        {selectedPath ? (
          <p className="mt-4 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900">
            {selectedPath.title}
            {selectedCourse ? ` / ${selectedCourse.courseCode}` : ''}
          </p>
        ) : null}
      </Card>

      <Card title="ERP Classes" description="Classes are loaded from ERP using the selected course code.">
        {classesLoading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !selectedCourseCode ? (
          <p className="text-sm text-secondary-500">Select a course to view available classes.</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-secondary-500">No ERP classes found for this course.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {classes.map((classItem) => {
              const active = selectedClassId === classItem.id;
              return (
                <button
                  key={`${classItem.id}-${classItem.code}`}
                  type="button"
                  onClick={() => setSelectedClassId(classItem.id)}
                  className={`rounded-lg border p-4 text-left transition ${
                    active
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-secondary-200 bg-white hover:border-primary-300 hover:bg-secondary-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-secondary-900">{classItem.title}</p>
                      <p className="mt-1 text-xs text-secondary-500">{classItem.code}</p>
                    </div>
                    <School className={`h-5 w-5 ${active ? 'text-primary-700' : 'text-secondary-400'}`} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-secondary-600 sm:grid-cols-2">
                    <span>Start Date: {classItem.startDate || '-'}</span>
                    <span>End Date: {classItem.endDate || '-'}</span>
                    <span>Venue: {classItem.venue || '-'}</span>
                    <span>Capacity: {classItem.capacity || '-'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Learners in Selected Learning Path"
        description="Select unassigned learners to allocate to the selected course class."
        action={
          <Button
            onClick={handleAssign}
            isLoading={assigning}
            disabled={!selectedClass || selectedEnrollmentIds.length === 0}
          >
            Assign to Class
          </Button>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_140px_auto_auto_auto]">
          <Input
            value={learnerSearch}
            onChange={(event) => setLearnerSearch(event.target.value)}
            placeholder="Search learners, employee no, designation, class"
            aria-label="Search learners"
          />
          <Input
            type="number"
            min="1"
            value={batchSize}
            onChange={(event) => setBatchSize(event.target.value)}
            aria-label="Batch size"
          />
          <Button variant="outline" onClick={selectNextBatch} disabled={!selectedCourseCode || availableLearners.length === 0}>
            Select
          </Button>
          <Button variant="outline" onClick={selectVisibleLearners} disabled={filteredLearners.length === 0}>
            Select All
          </Button>
          <Button variant="ghost" onClick={clearSelection} disabled={selectedEnrollmentIds.length === 0}>
            Clear
          </Button>
        </div>

        <div className="mb-3 flex items-center gap-2 text-sm text-secondary-600">
          <Search className="h-4 w-4" />
          {selectedEnrollmentIds.length} selected from {filteredLearners.length} visible unassigned learners
          {selectedCourseCode ? ` (${assignedForCourse} already assigned)` : ''}
        </div>

        <div className="overflow-x-auto rounded-lg border border-secondary-200">
          <div className="grid min-w-[920px] grid-cols-[48px_1.5fr_1fr_1fr_1fr] bg-secondary-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-secondary-500">
            <span />
            <span>Learner</span>
            <span>Employee No</span>
            <span>Designation</span>
            <span>Current Class</span>
          </div>

          {optionsLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredLearners.length === 0 ? (
            <p className="p-4 text-sm text-secondary-500">
              No unassigned learners found for this course. Check the report below to view learners already assigned to classes.
            </p>
          ) : (
            <div className="max-h-[32rem] min-w-[920px] divide-y divide-secondary-100 overflow-auto">
              {filteredLearners.map((learner) => {
                const assignedClass = getAssignmentForCourse(learner, selectedCourseCode);
                const checked = selectedEnrollmentIds.includes(learner.enrollmentId);
                return (
                  <label
                    key={learner.enrollmentId}
                    className={`grid cursor-pointer grid-cols-[48px_1.5fr_1fr_1fr_1fr] items-center px-4 py-3 text-sm transition ${
                      checked ? 'bg-primary-50' : 'bg-white hover:bg-secondary-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLearner(learner.enrollmentId)}
                      className="h-4 w-4 rounded border-secondary-300 text-primary-700 focus:ring-primary-500"
                    />
                    <span>
                      <span className="block font-medium text-secondary-900">{learner.name}</span>
                      <span className="block text-xs text-secondary-500">{learner.email}</span>
                    </span>
                    <span className="text-secondary-700">{learner.employeeNumber || '-'}</span>
                    <span className="text-secondary-700">{learner.designation || '-'}</span>
                    <span className="text-secondary-700">
                      {assignedClass ? assignedClass.classTitle || assignedClass.classCode || assignedClass.classId : '-'}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Learning Path Class Report"
        description="Complete view of enrolled learners, learning path courses, and class assignment status."
        action={
          <Button variant="outline" onClick={downloadReport} disabled={reportRows.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-4">
            <p className="text-sm text-secondary-500">Report Rows</p>
            <p className="mt-1 text-xl font-bold text-secondary-900">{reportSummary.total}</p>
          </div>
          <div className="rounded-lg border border-success-200 bg-success-50 p-4">
            <p className="text-sm text-success-700">Assigned</p>
            <p className="mt-1 text-xl font-bold text-success-800">{reportSummary.assigned}</p>
          </div>
          <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
            <p className="text-sm text-warning-700">Not Assigned</p>
            <p className="mt-1 text-xl font-bold text-warning-800">{reportSummary.notAssigned}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-secondary-200">
          <div className="grid min-w-[1180px] grid-cols-[1.2fr_1fr_1.2fr_1.2fr_1fr_1fr] bg-secondary-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-secondary-500">
            <span>Learner</span>
            <span>Employee No</span>
            <span>Course</span>
            <span>Class</span>
            <span>Dates</span>
            <span>Status</span>
          </div>

          {reportRows.length === 0 ? (
            <p className="p-4 text-sm text-secondary-500">Select a learning path to generate the report.</p>
          ) : (
            <div className="max-h-[34rem] min-w-[1180px] divide-y divide-secondary-100 overflow-auto">
              {reportRows.map((row) => (
                <div
                  key={`${row.employeeNumber}-${row.courseCode}`}
                  className="grid grid-cols-[1.2fr_1fr_1.2fr_1.2fr_1fr_1fr] items-center px-4 py-3 text-sm"
                >
                  <span>
                    <span className="block font-medium text-secondary-900">{row.learnerName}</span>
                    <span className="block text-xs text-secondary-500">{row.email}</span>
                  </span>
                  <span className="text-secondary-700">{row.employeeNumber || '-'}</span>
                  <span>
                    <span className="block font-medium text-secondary-900">{row.courseCode}</span>
                    <span className="block text-xs text-secondary-500">{row.courseTitle}</span>
                  </span>
                  <span>
                    <span className="block font-medium text-secondary-900">{row.classTitle || '-'}</span>
                    <span className="block text-xs text-secondary-500">{row.classCode || '-'}</span>
                  </span>
                  <span className="text-secondary-700">
                    {row.startDate || '-'} / {row.endDate || '-'}
                  </span>
                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      row.assignmentStatus === 'Assigned'
                        ? 'bg-success-100 text-success-700'
                        : 'bg-warning-100 text-warning-700'
                    }`}
                  >
                    {row.assignmentStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
