import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, RefreshCcw, School, Search, Users } from 'lucide-react';
import { learningApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
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

type ClassReportGroup = {
  key: string;
  learningPathId: string;
  learningPathTitle: string;
  classId: string;
  courseCode: string;
  courseTitle: string;
  classCode: string;
  classTitle: string;
  startDate: string;
  endDate: string;
  classPayload?: Record<string, unknown>;
  hasClassAssignment: boolean;
  learners: Array<{ id: string; name: string }>;
};

type ClassDetailFieldKey =
  | 'courseCategory'
  | 'courseName'
  | 'offeringName'
  | 'catalogYear'
  | 'location'
  | 'classTitle'
  | 'trainingCenter'
  | 'startDate'
  | 'endDate'
  | 'duration'
  | 'enrollmentStartDate'
  | 'enrollmentEndDate'
  | 'startTime'
  | 'endTime'
  | 'perHeadCost'
  | 'bond'
  | 'bondValue'
  | 'bondDuration';

type ClassDetailFormValues = Record<ClassDetailFieldKey, string>;

const classDetailFields: Array<{ key: ClassDetailFieldKey; label: string }> = [
  { key: 'courseCategory', label: 'CourseCategory' },
  { key: 'courseName', label: 'CourseName' },
  { key: 'offeringName', label: 'OfferingName' },
  { key: 'catalogYear', label: 'CatalogYear' },
  { key: 'location', label: 'Location' },
  { key: 'classTitle', label: 'ClassTitle' },
  { key: 'trainingCenter', label: 'TrainingCenter' },
  { key: 'startDate', label: 'StartDate' },
  { key: 'endDate', label: 'EndDate' },
  { key: 'duration', label: 'Duration' },
  { key: 'enrollmentStartDate', label: 'EnrollmentStartDate' },
  { key: 'enrollmentEndDate', label: 'EnrollmentEndDate' },
  { key: 'startTime', label: 'StartTime' },
  { key: 'endTime', label: 'EndTime' },
  { key: 'perHeadCost', label: 'Perheadcost' },
  { key: 'bond', label: 'Bond' },
  { key: 'bondValue', label: 'Bond Value' },
  { key: 'bondDuration', label: 'Bond Duration' }
];

const createEmptyClassDetailForm = (): ClassDetailFormValues =>
  classDetailFields.reduce((values, field) => {
    values[field.key] = '';
    return values;
  }, {} as ClassDetailFormValues);

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

const getClassPayloadField = (
  payload: Record<string, unknown> | undefined,
  keys: string[],
  tokenGroups: string[][] = []
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

const getYearFromDateValue = (value: string) => {
  const dateMatch = String(value || '').match(/\b(19|20)\d{2}\b/);
  return dateMatch?.[0] || '';
};

const buildDefaultClassDetailValues = (group: ClassReportGroup): ClassDetailFormValues => {
  const payload = group.classPayload;
  const startDate =
    group.startDate ||
    getClassPayloadDate(
      payload,
      ['startDate', 'classStartDate', 'courseStartDate', 'sessionStartDate', 'fromDate', 'dateFrom', 'startDt', 'fromDt'],
      [['start', 'date'], ['from', 'date']]
    );
  const endDate =
    group.endDate ||
    getClassPayloadDate(
      payload,
      ['endDate', 'classEndDate', 'courseEndDate', 'sessionEndDate', 'toDate', 'dateTo', 'endDt', 'toDt'],
      [['end', 'date'], ['to', 'date']]
    );

  return {
    courseCategory: group.courseTitle,
    courseName: group.courseTitle,
    offeringName: group.classTitle || group.classCode,
    catalogYear:
      getClassPayloadField(payload, ['catalogYear', 'catalogueYear', 'year'], [['catalog', 'year']]) ||
      getYearFromDateValue(startDate),
    location: getClassPayloadField(payload, ['location', 'venue', 'classVenue', 'trainingLocation'], [['loc'], ['venue']]),
    classTitle: group.classTitle || group.classCode,
    trainingCenter: getClassPayloadField(
      payload,
      ['trainingCenter', 'trainingCentre', 'center', 'centre', 'trainingCenterName'],
      [['training', 'center'], ['training', 'centre']]
    ),
    startDate,
    endDate,
    duration: getClassPayloadField(payload, ['duration', 'classDuration', 'courseDuration'], [['duration']]),
    enrollmentStartDate: getClassPayloadField(
      payload,
      ['enrollmentStartDate', 'enrolmentStartDate', 'registrationStartDate', 'enrollStartDate'],
      [['enrollment', 'start'], ['enrolment', 'start'], ['registration', 'start']]
    ),
    enrollmentEndDate: getClassPayloadField(
      payload,
      ['enrollmentEndDate', 'enrolmentEndDate', 'registrationEndDate', 'enrollEndDate'],
      [['enrollment', 'end'], ['enrolment', 'end'], ['registration', 'end']]
    ),
    startTime: getClassPayloadField(payload, ['startTime', 'classStartTime', 'fromTime'], [['start', 'time'], ['from', 'time']]),
    endTime: getClassPayloadField(payload, ['endTime', 'classEndTime', 'toTime'], [['end', 'time'], ['to', 'time']]),
    perHeadCost: getClassPayloadField(
      payload,
      ['perHeadCost', 'perheadcost', 'perHead', 'costPerHead', 'cost', 'fee'],
      [['per', 'head'], ['cost']]
    ),
    bond: getClassPayloadField(payload, ['bond', 'bondRequired'], [['bond']]),
    bondValue: getClassPayloadField(payload, ['bondValue', 'bondAmount'], [['bond', 'value'], ['bond', 'amount']]),
    bondDuration: getClassPayloadField(payload, ['bondDuration', 'bondPeriod'], [['bond', 'duration'], ['bond', 'period']])
  };
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const safeFilenamePart = (value: string, fallback: string) =>
  (value || fallback)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || fallback;

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function AssignEnrollmentToClassesPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [learningPaths, setLearningPaths] = useState<LearningPathOption[]>([]);
  const [selectedPathId, setSelectedPathId] = useState('');
  const [courses, setCourses] = useState<PathCourse[]>([]);
  const [learners, setLearners] = useState<EnrolledLearner[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [courseClassCounts, setCourseClassCounts] = useState<Record<string, number>>({});
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<'assign' | 'reassign'>('assign');
  const [learnerSearch, setLearnerSearch] = useState('');
  const [batchSize, setBatchSize] = useState('50');
  const [pathsLoading, setPathsLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classAvailabilityLoading, setClassAvailabilityLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedReportGroupKey, setSelectedReportGroupKey] = useState('');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'assign' | 'reports'>('assign');
  const [classDetailGroup, setClassDetailGroup] = useState<ClassReportGroup | null>(null);
  const [classDetailForm, setClassDetailForm] = useState<ClassDetailFormValues>(createEmptyClassDetailForm);
  const [classDetailLoading, setClassDetailLoading] = useState(false);
  const [classDetailSaving, setClassDetailSaving] = useState(false);

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

  const unassignedLearners = useMemo(() => {
    if (!selectedCourseCode) {
      return learners;
    }
    return learners.filter((learner) => !getAssignmentForCourse(learner, selectedCourseCode));
  }, [learners, selectedCourseCode]);

  const reassignableLearners = useMemo(() => {
    if (!selectedCourseCode) {
      return [];
    }
    return learners.filter((learner) => {
      const assignment = getAssignmentForCourse(learner, selectedCourseCode);
      return assignment && assignment.classId !== selectedClassId;
    });
  }, [learners, selectedClassId, selectedCourseCode]);

  const selectableLearners = assignmentMode === 'reassign' ? reassignableLearners : unassignedLearners;

  const filteredLearners = useMemo(() => {
    const search = learnerSearch.trim().toLowerCase();
    if (!search) {
      return selectableLearners;
    }
    return selectableLearners.filter((learner) =>
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
  }, [learnerSearch, selectableLearners, selectedCourseCode]);

  const selectedLearnersForCourse = useMemo(
    () => learners.filter((learner) => selectedEnrollmentIds.includes(learner.enrollmentId)),
    [learners, selectedEnrollmentIds]
  );

  const selectedReassignmentCount = useMemo(
    () =>
      selectedLearnersForCourse.filter((learner) => Boolean(getAssignmentForCourse(learner, selectedCourseCode))).length,
    [selectedCourseCode, selectedLearnersForCourse]
  );

  const reportRows = useMemo(() => {
    if (!selectedPath || courses.length === 0 || learners.length === 0) {
      return [];
    }

    return learners.flatMap((learner) =>
      courses.map((course) => {
        const assignment = getAssignmentForCourse(learner, course.courseCode);
        return {
          learningPathId: selectedPath.id,
          learningPath: selectedPath.title,
          employeeNumber: learner.employeeNumber || '',
          learnerName: learner.name,
          email: learner.email,
          designation: learner.designation || '',
          gradeName: learner.gradeName || '',
          courseCode: course.courseCode,
          courseTitle: course.title,
          classId: assignment?.classId || '',
          classCode: assignment?.classCode || '',
          classTitle: assignment?.classTitle || '',
          classPayload: assignment?.classPayload,
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

  const classReportGroups = useMemo<ClassReportGroup[]>(() => {
    const groups = new Map<string, ClassReportGroup>();

    for (const row of reportRows) {
      const hasClassAssignment = row.assignmentStatus === 'Assigned' && Boolean(row.classCode);
      if (!hasClassAssignment && courseClassCounts[row.courseCode] !== 0) {
        continue;
      }

      const key = hasClassAssignment ? `${row.courseCode}::${row.classCode}` : `${row.courseCode}::NO_CLASS`;
      const existing = groups.get(key);
      const learner = {
        id: row.employeeNumber || '',
        name: row.learnerName
      };

      if (existing) {
        existing.learners.push(learner);
      } else {
        groups.set(key, {
          key,
          learningPathTitle: row.learningPath,
          learningPathId: row.learningPathId,
          classId: row.classId,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          classCode: row.classCode,
          classTitle: row.classTitle,
          startDate: row.startDate,
          endDate: row.endDate,
          classPayload: row.classPayload,
          hasClassAssignment,
          learners: [learner]
        });
      }
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      learners: group.learners.sort((first, second) =>
        first.name.localeCompare(second.name) || first.id.localeCompare(second.id)
      )
    }));
  }, [courseClassCounts, reportRows]);

  const selectedReportGroup = useMemo(
    () => classReportGroups.find((group) => group.key === selectedReportGroupKey) || classReportGroups[0] || null,
    [classReportGroups, selectedReportGroupKey]
  );

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
      setCourseClassCounts({});
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
      setCourseClassCounts({});
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
      setCourseClassCounts((currentCounts) => ({
        ...currentCounts,
        [selectedCourseCode]: response.classes.length
      }));
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

  useEffect(() => {
    let cancelled = false;

    const loadCourseClassAvailability = async () => {
      if (courses.length === 0) {
        setCourseClassCounts({});
        return;
      }

      try {
        setClassAvailabilityLoading(true);
        const token = await getAccessToken();
        if (!token) {
          showToast('Session expired. Please login again.', 'error');
          return;
        }

        const classCounts = await Promise.all(
          courses.map(async (course) => {
            const response = await learningApi.getClassesByCourseCode(token, course.courseCode);
            return [course.courseCode, response.classes.length] as const;
          })
        );

        if (!cancelled) {
          setCourseClassCounts(Object.fromEntries(classCounts));
        }
      } catch (error) {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : 'Failed to check ERP class availability.', 'error');
          setCourseClassCounts({});
        }
      } finally {
        if (!cancelled) {
          setClassAvailabilityLoading(false);
        }
      }
    };

    loadCourseClassAvailability();

    return () => {
      cancelled = true;
    };
  }, [courses, getAccessToken, showToast]);

  useEffect(() => {
    if (classReportGroups.length === 0) {
      setSelectedReportGroupKey('');
      return;
    }
    if (!classReportGroups.some((group) => group.key === selectedReportGroupKey)) {
      setSelectedReportGroupKey(classReportGroups[0].key);
    }
  }, [classReportGroups, selectedReportGroupKey]);

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
    const nextLearners = selectableLearners
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
      const actionLabel = assignmentMode === 'reassign' ? 'reassigned' : 'assigned';
      showToast(`${response.assigned.length} learner(s) ${actionLabel} to ${selectedClass.title}.`, 'success');
      await loadPathOptions();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : `Failed to ${assignmentMode === 'reassign' ? 'reassign' : 'assign'} learners to class.`,
        'error'
      );
    } finally {
      setAssigning(false);
    }
  };

  const downloadReportExcel = (reportGroup: ClassReportGroup | null) => {
    if (!reportGroup) {
      showToast('Select a course class report before downloading Excel.', 'error');
      return;
    }

    const rows = reportGroup.learners
      .map(
        (learner) => `
          <tr>
            <td style="mso-number-format:'\\@';">${escapeHtml(learner.id)}</td>
          </tr>`
      )
      .join('');

    const workbookHtml = `
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <tbody>
              <tr>
                <th>Learning Path</th>
                <td>${escapeHtml(reportGroup.learningPathTitle)}</td>
              </tr>
              <tr>
                <th>Course</th>
                <td>${escapeHtml(reportGroup.courseCode)} - ${escapeHtml(reportGroup.courseTitle)}</td>
              </tr>
              <tr>
                <th>Class</th>
                <td>${escapeHtml(
                  reportGroup.hasClassAssignment
                    ? `${reportGroup.classCode} - ${reportGroup.classTitle}`
                    : 'No class assigned'
                )}</td>
              </tr>
              <tr>
                <td></td>
                <td></td>
              </tr>
            </tbody>
            <thead>
              <tr>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>`;

    downloadBlob(
      new Blob([workbookHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      `${safeFilenamePart(reportGroup.learningPathTitle, 'learning-path')}_${safeFilenamePart(
        reportGroup.courseCode,
        'course'
      )}_${safeFilenamePart(reportGroup.classCode, 'no-class')}_learners.xls`
    );
    showToast('Excel report downloaded.', 'success');
  };

  const openClassDetailModal = async (reportGroup: ClassReportGroup) => {
    if (!reportGroup.hasClassAssignment || !reportGroup.classId) {
      showToast('Class details are only available after a course is assigned to an ERP class.', 'info');
      return;
    }

    setClassDetailGroup(reportGroup);
    setClassDetailForm(buildDefaultClassDetailValues(reportGroup));
    setClassDetailLoading(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learningApi.getClassDetailReport(token, {
        learningPathId: reportGroup.learningPathId,
        courseCode: reportGroup.courseCode,
        classId: reportGroup.classId
      });

      if (response.report?.values) {
        setClassDetailForm((currentValues) => ({
          ...currentValues,
          ...response.report?.values
        }));
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load class details.', 'error');
    } finally {
      setClassDetailLoading(false);
    }
  };

  const closeClassDetailModal = () => {
    setClassDetailGroup(null);
    setClassDetailForm(createEmptyClassDetailForm());
  };

  const downloadClassDetailExcel = (values: ClassDetailFormValues) => {
    const workbookHtml = `
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <thead>
              <tr>
                ${classDetailFields.map((field) => `<th>${escapeHtml(field.label)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                ${classDetailFields.map((field) => `<td>${escapeHtml(values[field.key])}</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </body>
      </html>`;

    downloadBlob(
      new Blob([workbookHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      `${safeFilenamePart(values.courseName || classDetailGroup?.courseTitle || '', 'course')}_${safeFilenamePart(
        values.classTitle || classDetailGroup?.classCode || '',
        'class'
      )}_class_details.xls`
    );
  };

  const saveAndDownloadClassDetails = async () => {
    if (!classDetailGroup) {
      return;
    }

    try {
      setClassDetailSaving(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learningApi.saveClassDetailReport(token, {
        learningPathId: classDetailGroup.learningPathId,
        courseCode: classDetailGroup.courseCode,
        classId: classDetailGroup.classId,
        values: classDetailForm
      });
      const savedValues = {
        ...classDetailForm,
        ...(response.report?.values || {})
      };
      setClassDetailForm(savedValues);
      downloadClassDetailExcel(savedValues);
      showToast('Class details saved and downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save class details.', 'error');
    } finally {
      setClassDetailSaving(false);
    }
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

      <div className="rounded-xl border border-secondary-200 bg-white px-4 py-3 shadow-soft">
        <div className="grid grid-cols-1 divide-y divide-secondary-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 py-2 sm:pr-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">Courses</p>
              <p className="text-2xl font-bold text-secondary-900">{courses.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-2 sm:pl-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50 text-success-700">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">Enrolled Learners</p>
              <p className="text-2xl font-bold text-secondary-900">{learners.length}</p>
            </div>
          </div>
        </div>
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
              setAssignmentMode('assign');
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

      <div className="flex flex-col gap-3 rounded-xl border border-secondary-200 bg-white p-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveWorkspaceTab('assign')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeWorkspaceTab === 'assign'
                ? 'bg-primary-700 text-white shadow-sm'
                : 'bg-secondary-50 text-secondary-700 hover:bg-secondary-100'
            }`}
          >
            Assign learners
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkspaceTab('reports')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeWorkspaceTab === 'reports'
                ? 'bg-primary-700 text-white shadow-sm'
                : 'bg-secondary-50 text-secondary-700 hover:bg-secondary-100'
            }`}
          >
            Reports
          </button>
        </div>
        <p className="text-sm text-secondary-500">
          {activeWorkspaceTab === 'assign'
            ? `${selectedEnrollmentIds.length} selected / ${filteredLearners.length} available`
            : `${classReportGroups.length} report box(es) ready`}
        </p>
      </div>

      {activeWorkspaceTab === 'assign' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,430px)_minmax(0,1fr)]">
      <Card title="ERP Classes" description="Classes are loaded from ERP using the selected course code.">
        {classesLoading ? (
          <div className="grid grid-cols-1 gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !selectedCourseCode ? (
          <p className="text-sm text-secondary-500">Select a course to view available classes.</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-secondary-500">No ERP classes found for this course.</p>
        ) : (
          <div className="grid max-h-[34rem] grid-cols-1 gap-3 overflow-auto pr-1">
            {classes.map((classItem) => {
              const active = selectedClassId === classItem.id;
              return (
                <button
                  key={`${classItem.id}-${classItem.code}`}
                  type="button"
                  onClick={() => {
                    setSelectedClassId(classItem.id);
                    setSelectedEnrollmentIds([]);
                  }}
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
                    <span>Mode: {classItem.venue || '-'}</span>
                    <span>Capacity: {classItem.capacity || '-'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title={assignmentMode === 'reassign' ? 'Reassign Learners to Replacement Class' : 'Learners in Selected Learning Path'}
        description={
          assignmentMode === 'reassign'
            ? 'Move learners who missed an earlier session into the selected course class.'
            : 'Select unassigned learners to allocate to the selected course class.'
        }
        action={
          <Button
            onClick={handleAssign}
            isLoading={assigning}
            disabled={!selectedClass || selectedEnrollmentIds.length === 0}
          >
            {assignmentMode === 'reassign' ? 'Reassign to Class' : 'Assign to Class'}
          </Button>
        }
      >
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-secondary-200 bg-secondary-50 p-1 sm:w-fit">
          <button
            type="button"
            onClick={() => {
              setAssignmentMode('assign');
              setSelectedEnrollmentIds([]);
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
              assignmentMode === 'assign'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-secondary-700 hover:bg-white/70'
            }`}
          >
            Assign new
          </button>
          <button
            type="button"
            onClick={() => {
              setAssignmentMode('reassign');
              setSelectedEnrollmentIds([]);
            }}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
              assignmentMode === 'reassign'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-secondary-700 hover:bg-white/70'
            }`}
          >
            Reassign missed session
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_140px_auto_auto_auto]">
          <Input
            value={learnerSearch}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/\D/g, '');
              setLearnerSearch(nextValue);
            }}
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
          <Button variant="outline" onClick={selectNextBatch} disabled={!selectedCourseCode || selectableLearners.length === 0}>
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
          {selectedEnrollmentIds.length} selected from {filteredLearners.length} visible{' '}
          {assignmentMode === 'reassign' ? 'reassignable' : 'unassigned'} learners
          {selectedCourseCode
            ? ` (${assignedForCourse} already assigned, ${unassignedLearners.length} unassigned)`
            : ''}
          {selectedReassignmentCount > 0 ? ` - ${selectedReassignmentCount} will move from another class` : ''}
        </div>

        <div className="overflow-x-auto rounded-lg border border-secondary-200">
          <div className="grid min-w-[760px] grid-cols-[48px_1.6fr_120px_1fr] bg-secondary-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-secondary-500">
            <span />
            <span>Learner</span>
            <span>Employee No</span>
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
              {assignmentMode === 'reassign'
                ? 'No learners are assigned to another class for this course. Choose a different replacement class or course.'
                : 'No unassigned learners found for this course. Use reassignment if a learner missed a previous session.'}
            </p>
          ) : (
            <div className="max-h-[32rem] min-w-[760px] divide-y divide-secondary-100 overflow-auto">
              {filteredLearners.map((learner) => {
                const assignedClass = getAssignmentForCourse(learner, selectedCourseCode);
                const checked = selectedEnrollmentIds.includes(learner.enrollmentId);
                return (
                  <label
                    key={learner.enrollmentId}
                    className={`grid cursor-pointer grid-cols-[48px_1.6fr_120px_1fr] items-center px-4 py-3 text-sm transition ${
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
        </div>
      ) : null}

      {activeWorkspaceTab === 'reports' ? (
      <Card
        title="Course/Class Learner Reports"
        description="Select a course class box to view learner details and download the Excel report."
      >
        {reportRows.length === 0 ? (
          <p className="rounded-lg border border-secondary-200 p-4 text-sm text-secondary-500">
            Select a learning path to generate the report.
          </p>
        ) : classAvailabilityLoading ? (
          <p className="rounded-lg border border-secondary-200 p-4 text-sm text-secondary-500">
            Checking ERP class availability for these courses...
          </p>
        ) : classReportGroups.length === 0 ? (
          <p className="rounded-lg border border-secondary-200 p-4 text-sm text-secondary-500">
            No report-ready learners found. Assign learners to available ERP classes, or use courses with no ERP classes.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {classReportGroups.map((group) => {
                const active = selectedReportGroup?.key === group.key;
                return (
                  <div
                    key={group.key}
                    onClick={() => setSelectedReportGroupKey(group.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelectedReportGroupKey(group.key);
                      }
                    }}
                    className={`rounded-lg border p-4 text-left transition cursor-pointer ${
                      active
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-secondary-200 bg-white hover:border-primary-300 hover:bg-secondary-50'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                      {group.learningPathTitle}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="font-semibold text-secondary-900">{group.courseCode}</p>
                        <p className="text-xs text-secondary-500">{group.courseTitle}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-secondary-900">
                          {group.hasClassAssignment ? `Class No: ${group.classCode}` : 'No class assigned'}
                        </p>
                        <p className="text-xs text-secondary-500">
                          {group.hasClassAssignment ? group.classTitle || '-' : 'Report generated from LP enrollment'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-primary-700">{group.learners.length} learner(s)</p>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-9 w-full whitespace-normal px-3 py-2"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedReportGroupKey(group.key);
                          downloadReportExcel(group);
                        }}
                      >
                        <Download className="h-4 w-4 shrink-0" />
                        <span>Download enrolled learners Excel</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-9 w-full whitespace-normal px-3 py-2"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedReportGroupKey(group.key);
                          openClassDetailModal(group);
                        }}
                        disabled={!group.hasClassAssignment}
                      >
                        <Download className="h-4 w-4 shrink-0" />
                        <span>Download class details</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedReportGroup ? (
              <div className="rounded-lg border border-secondary-200">
                <div className="grid gap-2 border-b border-secondary-200 bg-secondary-50 px-4 py-3 text-sm lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">Learning Path</p>
                    <p className="font-semibold text-secondary-900">{selectedReportGroup.learningPathTitle}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">Course</p>
                    <p className="font-semibold text-secondary-900">{selectedReportGroup.courseCode}</p>
                    <p className="text-xs text-secondary-500">{selectedReportGroup.courseTitle}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">Class</p>
                    <p className="font-semibold text-secondary-900">
                      {selectedReportGroup.hasClassAssignment
                        ? `Class No: ${selectedReportGroup.classCode}`
                        : 'No class assigned'}
                    </p>
                    <p className="text-xs text-secondary-500">
                      {selectedReportGroup.hasClassAssignment
                        ? selectedReportGroup.classTitle || '-'
                        : 'Report generated from LP enrollment'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                    {selectedReportGroup.learners.length} learner(s)
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] border-b border-secondary-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-secondary-500">
                  <span>ID</span>
                  <span>Name</span>
                </div>
                <div className="max-h-80 divide-y divide-secondary-100 overflow-auto">
                  {selectedReportGroup.learners.map((learner) => (
                    <div
                      key={`${selectedReportGroup.key}-${learner.id}`}
                      className="grid grid-cols-[160px_1fr] px-4 py-2 text-sm"
                    >
                      <span className="text-secondary-700">{learner.id || '-'}</span>
                      <span className="font-medium text-secondary-900">{learner.name || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>
      ) : null}

      {classDetailGroup ? (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
            <div className="border-b border-secondary-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-secondary-900">Class Details</h2>
              <p className="mt-1 text-sm text-secondary-500">
                {classDetailGroup.courseCode} - {classDetailGroup.classCode}
              </p>
            </div>

            <div className="overflow-y-auto p-5">
              {classDetailLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton key={`class-detail-skeleton-${index}`} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {classDetailFields.map((field) => (
                    <Input
                      key={field.key}
                      label={field.label}
                      value={classDetailForm[field.key]}
                      onChange={(event) =>
                        setClassDetailForm((currentValues) => ({
                          ...currentValues,
                          [field.key]: event.target.value
                        }))
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-secondary-200 bg-secondary-50 px-5 py-4">
              <Button type="button" variant="outline" onClick={closeClassDetailModal}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveAndDownloadClassDetails}
                isLoading={classDetailSaving}
                disabled={classDetailLoading}
              >
                <Download className="h-4 w-4" />
                Save & Download Excel
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
