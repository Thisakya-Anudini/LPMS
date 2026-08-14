import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Download,
  FileText,
  RefreshCcw,
  School,
  Search,
  Users,
  X,
  Settings,
  UserPlus,
  RefreshCw,
  ClipboardCheck,
  Filter,
  CheckCircle,
} from "lucide-react";
import { learningApi } from "../../api/lpmsApi";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ModalOverlay } from "../../components/ui/ModalOverlay";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

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
  courseProgress: Array<{
    courseId: string;
    courseCode: string;
    progress: number;
  }>;
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
  learners: Array<{
    id: string;
    name: string;
    email: string;
    designation: string;
    gradeName: string;
  }>;
};

type ClassDetailFieldKey =
  | "courseCategory"
  | "courseName"
  | "offeringName"
  | "catalogYear"
  | "location"
  | "classTitle"
  | "trainingCenter"
  | "startDate"
  | "endDate"
  | "duration"
  | "enrollmentStartDate"
  | "enrollmentEndDate"
  | "startTime"
  | "endTime"
  | "perHeadCost"
  | "bond"
  | "bondValue"
  | "bondDuration";

type ClassDetailFormValues = Record<ClassDetailFieldKey, string>;

const classDetailFields: Array<{ key: ClassDetailFieldKey; label: string }> = [
  { key: "courseCategory", label: "CourseCategory" },
  { key: "courseName", label: "CourseName" },
  { key: "offeringName", label: "OfferingName" },
  { key: "catalogYear", label: "CatalogYear" },
  { key: "location", label: "Location" },
  { key: "classTitle", label: "ClassTitle" },
  { key: "trainingCenter", label: "TrainingCenter" },
  { key: "startDate", label: "StartDate" },
  { key: "endDate", label: "EndDate" },
  { key: "duration", label: "Duration" },
  { key: "enrollmentStartDate", label: "EnrollmentStartDate" },
  { key: "enrollmentEndDate", label: "EnrollmentEndDate" },
  { key: "startTime", label: "StartTime" },
  { key: "endTime", label: "EndTime" },
  { key: "perHeadCost", label: "Perheadcost" },
  { key: "bond", label: "Bond" },
  { key: "bondValue", label: "Bond Value" },
  { key: "bondDuration", label: "Bond Duration" },
];

const createEmptyClassDetailForm = (): ClassDetailFormValues =>
  classDetailFields.reduce((values, field) => {
    values[field.key] = "";
    return values;
  }, {} as ClassDetailFormValues);

const getAssignmentForCourse = (learner: EnrolledLearner, courseCode: string) =>
  learner.classAssignments.find(
    (assignment) => assignment.courseCode === courseCode,
  );

const isLearnerCourseCompleted = (
  learner: EnrolledLearner,
  course: PathCourse | null,
) => {
  if (!course) {
    return false;
  }

  const selectedCourseId = String(course.courseId || "")
    .trim()
    .toLowerCase();
  const selectedCourseCode = String(course.courseCode || "")
    .trim()
    .toLowerCase();
  const progress = learner.courseProgress.find((courseProgress) => {
    const progressCourseId = String(courseProgress.courseId || "")
      .trim()
      .toLowerCase();
    const progressCourseCode = String(courseProgress.courseCode || "")
      .trim()
      .toLowerCase();
    return (
      (selectedCourseId && progressCourseId === selectedCourseId) ||
      (selectedCourseCode && progressCourseCode === selectedCourseCode)
    );
  });

  return Number(progress?.progress || 0) >= 100;
};

const learnerMatchesSearch = (learner: EnrolledLearner, search: string) =>
  [learner.name, learner.employeeNumber]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));

const getPayloadValue = (
  payload: Record<string, unknown> | undefined,
  keys: string[],
) => {
  if (!payload) {
    return "";
  }

  const normalizedEntries = Object.entries(payload).map(([key, value]) => ({
    key: key.toLowerCase().replace(/[^a-z0-9]/g, ""),
    value,
  }));

  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = normalizedEntries.find(
      (entry) => entry.key === normalizedKey,
    );
    if (
      match?.value !== null &&
      match?.value !== undefined &&
      String(match.value).trim() !== ""
    ) {
      return String(match.value).trim();
    }
  }

  return "";
};

const getPayloadValueByTokens = (
  payload: Record<string, unknown> | undefined,
  tokenGroups: string[][],
) => {
  if (!payload) {
    return "";
  }

  const entries = Object.entries(payload);
  for (const tokens of tokenGroups) {
    const normalizedTokens = tokens.map((token) => token.toLowerCase());
    const match = entries.find(([key, value]) => {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {
        return false;
      }
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalizedTokens.every((token) => normalizedKey.includes(token));
    });
    if (match) {
      return String(match[1]).trim();
    }
  }

  return "";
};

const getClassPayloadDate = (
  payload: Record<string, unknown> | undefined,
  keys: string[],
  tokenGroups: string[][],
) => {
  const rawPayload =
    payload?.raw && typeof payload.raw === "object"
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
  tokenGroups: string[][] = [],
) => {
  const rawPayload =
    payload?.raw && typeof payload.raw === "object"
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
  const dateMatch = String(value || "").match(/\b(19|20)\d{2}\b/);
  return dateMatch?.[0] || "";
};

const buildDefaultClassDetailValues = (
  group: ClassReportGroup,
): ClassDetailFormValues => {
  const payload = group.classPayload;
  const startDate =
    group.startDate ||
    getClassPayloadDate(
      payload,
      [
        "startDate",
        "classStartDate",
        "courseStartDate",
        "sessionStartDate",
        "fromDate",
        "dateFrom",
        "startDt",
        "fromDt",
      ],
      [
        ["start", "date"],
        ["from", "date"],
      ],
    );
  const endDate =
    group.endDate ||
    getClassPayloadDate(
      payload,
      [
        "endDate",
        "classEndDate",
        "courseEndDate",
        "sessionEndDate",
        "toDate",
        "dateTo",
        "endDt",
        "toDt",
      ],
      [
        ["end", "date"],
        ["to", "date"],
      ],
    );

  return {
    courseCategory: group.courseTitle,
    courseName: group.courseTitle,
    offeringName: group.classTitle || group.classCode,
    catalogYear:
      getClassPayloadField(
        payload,
        ["catalogYear", "catalogueYear", "year"],
        [["catalog", "year"]],
      ) || getYearFromDateValue(startDate),
    location: getClassPayloadField(
      payload,
      ["location", "venue", "classVenue", "trainingLocation"],
      [["loc"], ["venue"]],
    ),
    classTitle: group.classTitle || group.classCode,
    trainingCenter: getClassPayloadField(
      payload,
      [
        "trainingCenter",
        "trainingCentre",
        "center",
        "centre",
        "trainingCenterName",
      ],
      [
        ["training", "center"],
        ["training", "centre"],
      ],
    ),
    startDate,
    endDate,
    duration: getClassPayloadField(
      payload,
      ["duration", "classDuration", "courseDuration"],
      [["duration"]],
    ),
    enrollmentStartDate: getClassPayloadField(
      payload,
      [
        "enrollmentStartDate",
        "enrolmentStartDate",
        "registrationStartDate",
        "enrollStartDate",
      ],
      [
        ["enrollment", "start"],
        ["enrolment", "start"],
        ["registration", "start"],
      ],
    ),
    enrollmentEndDate: getClassPayloadField(
      payload,
      [
        "enrollmentEndDate",
        "enrolmentEndDate",
        "registrationEndDate",
        "enrollEndDate",
      ],
      [
        ["enrollment", "end"],
        ["enrolment", "end"],
        ["registration", "end"],
      ],
    ),
    startTime: getClassPayloadField(
      payload,
      ["startTime", "classStartTime", "fromTime"],
      [
        ["start", "time"],
        ["from", "time"],
      ],
    ),
    endTime: getClassPayloadField(
      payload,
      ["endTime", "classEndTime", "toTime"],
      [
        ["end", "time"],
        ["to", "time"],
      ],
    ),
    perHeadCost: getClassPayloadField(
      payload,
      ["perHeadCost", "perheadcost", "perHead", "costPerHead", "cost", "fee"],
      [["per", "head"], ["cost"]],
    ),
    bond: getClassPayloadField(payload, ["bond", "bondRequired"], [["bond"]]),
    bondValue: getClassPayloadField(
      payload,
      ["bondValue", "bondAmount"],
      [
        ["bond", "value"],
        ["bond", "amount"],
      ],
    ),
    bondDuration: getClassPayloadField(
      payload,
      ["bondDuration", "bondPeriod"],
      [
        ["bond", "duration"],
        ["bond", "period"],
      ],
    ),
  };
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const safeFilenamePart = (value: string, fallback: string) =>
  (value || fallback)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function AssignEnrollmentToClassesPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [learningPaths, setLearningPaths] = useState<LearningPathOption[]>([]);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [courses, setCourses] = useState<PathCourse[]>([]);
  const [learners, setLearners] = useState<EnrolledLearner[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [courseClassCounts, setCourseClassCounts] = useState<
    Record<string, number>
  >({});
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>(
    [],
  );
  const [statusTransferEnrollmentIds, setStatusTransferEnrollmentIds] =
    useState<string[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<
    "assign" | "reassign" | "completion"
  >("assign");
  const [showCourseStatusPanel, setShowCourseStatusPanel] = useState(false);
  const [setupCourseStatusTab, setSetupCourseStatusTab] = useState<
    "notCompleted" | "completed"
  >("notCompleted");
  const [setupCourseStatusSearch, setSetupCourseStatusSearch] = useState("");
  const [learnerSearch, setLearnerSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [batchSize, setBatchSize] = useState("50");
  const [pathsLoading, setPathsLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classAvailabilityLoading, setClassAvailabilityLoading] =
    useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedReportGroupKey, setSelectedReportGroupKey] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    "assign" | "reports"
  >("assign");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [classDetailGroup, setClassDetailGroup] =
    useState<ClassReportGroup | null>(null);
  const [classDetailForm, setClassDetailForm] = useState<ClassDetailFormValues>(
    createEmptyClassDetailForm,
  );
  const [classDetailLoading, setClassDetailLoading] = useState(false);
  const [classDetailSaving, setClassDetailSaving] = useState(false);

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
  }, []);

  const closeClassDetailModal = useCallback(() => {
    setClassDetailGroup(null);
    setClassDetailForm(createEmptyClassDetailForm());
  }, []);

  useEffect(() => {
    if (!isReportModalOpen && !classDetailGroup && !showCourseStatusPanel) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (classDetailGroup) {
        closeClassDetailModal();
        return;
      }

      if (showCourseStatusPanel) {
        setShowCourseStatusPanel(false);
        return;
      }

      closeReportModal();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    classDetailGroup,
    closeClassDetailModal,
    closeReportModal,
    isReportModalOpen,
    showCourseStatusPanel,
  ]);

  const selectedPath = useMemo(
    () => learningPaths.find((path) => path.id === selectedPathId) || null,
    [learningPaths, selectedPathId],
  );
  const selectedCourse = useMemo(
    () =>
      courses.find((course) => course.courseCode === selectedCourseCode) ||
      null,
    [courses, selectedCourseCode],
  );
  const selectedClass = useMemo(
    () => classes.find((classItem) => classItem.id === selectedClassId) || null,
    [classes, selectedClassId],
  );

  const assignedForCourse = useMemo(
    () =>
      learners.filter((learner) =>
        Boolean(getAssignmentForCourse(learner, selectedCourseCode)),
      ).length,
    [learners, selectedCourseCode],
  );

  const unassignedLearners = useMemo(() => {
    if (!selectedCourseCode) {
      return learners;
    }
    return learners.filter(
      (learner) => !getAssignmentForCourse(learner, selectedCourseCode),
    );
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

  const completedCourseLearners = useMemo(
    () =>
      learners.filter((learner) =>
        isLearnerCourseCompleted(learner, selectedCourse),
      ),
    [learners, selectedCourse],
  );

  const notCompletedCourseLearners = useMemo(
    () =>
      learners.filter(
        (learner) => !isLearnerCourseCompleted(learner, selectedCourse),
      ),
    [learners, selectedCourse],
  );

  const filteredCompletedCourseLearners = useMemo(() => {
    const search = learnerSearch.trim().toLowerCase();
    if (!search) {
      return completedCourseLearners;
    }
    return completedCourseLearners.filter((learner) =>
      learnerMatchesSearch(learner, search),
    );
  }, [completedCourseLearners, learnerSearch]);

  const filteredSetupNotCompletedLearners = useMemo(() => {
    const search = setupCourseStatusSearch.trim().toLowerCase();
    if (!search) {
      return notCompletedCourseLearners;
    }
    return notCompletedCourseLearners.filter((learner) =>
      learnerMatchesSearch(learner, search),
    );
  }, [notCompletedCourseLearners, setupCourseStatusSearch]);

  const filteredSetupCompletedLearners = useMemo(() => {
    const search = setupCourseStatusSearch.trim().toLowerCase();
    if (!search) {
      return completedCourseLearners;
    }
    return completedCourseLearners.filter((learner) =>
      learnerMatchesSearch(learner, search),
    );
  }, [completedCourseLearners, setupCourseStatusSearch]);

  const statusTransferLearners = useMemo(
    () =>
      learners.filter((learner) =>
        statusTransferEnrollmentIds.includes(learner.enrollmentId),
      ),
    [learners, statusTransferEnrollmentIds],
  );

  const selectableLearners = useMemo(
    () =>
      assignmentMode === "completion"
        ? []
        : assignmentMode === "reassign"
          ? reassignableLearners
          : statusTransferLearners.length > 0
            ? statusTransferLearners
            : unassignedLearners,
    [
      assignmentMode,
      reassignableLearners,
      statusTransferLearners,
      unassignedLearners,
    ],
  );

  const designationOptions = useMemo(() => {
    const opts = new Set(learners.map((l) => l.designation).filter(Boolean));
    return Array.from(opts) as string[];
  }, [learners]);

  const gradeOptions = useMemo(() => {
    const opts = new Set(learners.map((l) => l.gradeName).filter(Boolean));
    return Array.from(opts) as string[];
  }, [learners]);

  const filteredLearners = useMemo(() => {
    let result = selectableLearners;

    if (designationFilter) {
      result = result.filter((l) => l.designation === designationFilter);
    }
    if (gradeFilter) {
      result = result.filter((l) => l.gradeName === gradeFilter);
    }

    const search = learnerSearch.trim().toLowerCase();
    if (!search) {
      return result;
    }

    return result.filter((learner) => learnerMatchesSearch(learner, search));
  }, [learnerSearch, selectableLearners, designationFilter, gradeFilter]);

  const selectedLearnersForCourse = useMemo(
    () =>
      learners.filter((learner) =>
        selectedEnrollmentIds.includes(learner.enrollmentId),
      ),
    [learners, selectedEnrollmentIds],
  );

  const selectedReassignmentCount = useMemo(
    () =>
      selectedLearnersForCourse.filter((learner) =>
        Boolean(getAssignmentForCourse(learner, selectedCourseCode)),
      ).length,
    [selectedCourseCode, selectedLearnersForCourse],
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
          employeeNumber: learner.employeeNumber || "",
          learnerName: learner.name,
          email: learner.email,
          designation: learner.designation || "",
          gradeName: learner.gradeName || "",
          courseCode: course.courseCode,
          courseTitle: course.title,
          classId: assignment?.classId || "",
          classCode: assignment?.classCode || "",
          classTitle: assignment?.classTitle || "",
          classPayload: assignment?.classPayload,
          startDate: getClassPayloadDate(
            assignment?.classPayload,
            [
              "startDate",
              "classStartDate",
              "courseStartDate",
              "sessionStartDate",
              "fromDate",
              "dateFrom",
              "startDt",
              "fromDt",
              "commenceDate",
              "commencementDate",
            ],
            [
              ["start", "date"],
              ["from", "date"],
              ["commence", "date"],
            ],
          ),
          endDate: getClassPayloadDate(
            assignment?.classPayload,
            [
              "endDate",
              "classEndDate",
              "courseEndDate",
              "sessionEndDate",
              "toDate",
              "dateTo",
              "endDt",
              "toDt",
              "completionDate",
              "finishDate",
            ],
            [
              ["end", "date"],
              ["to", "date"],
              ["completion", "date"],
              ["finish", "date"],
            ],
          ),
          assignmentStatus: assignment ? "Assigned" : "Not Assigned",
        };
      }),
    );
  }, [courses, learners, selectedPath]);

  const classReportGroups = useMemo<ClassReportGroup[]>(() => {
    const groups = new Map<string, ClassReportGroup>();

    for (const row of reportRows) {
      const hasClassAssignment =
        row.assignmentStatus === "Assigned" && Boolean(row.classCode);
      if (!hasClassAssignment && courseClassCounts[row.courseCode] !== 0) {
        continue;
      }

      const key = hasClassAssignment
        ? `${row.courseCode}::${row.classCode}`
        : `${row.courseCode}::NO_CLASS`;
      const existing = groups.get(key);
      const learner = {
        id: row.employeeNumber || "",
        name: row.learnerName,
        email: row.email || "",
        designation: row.designation || "",
        gradeName: row.gradeName || "",
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
          learners: [learner],
        });
      }
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      learners: group.learners.sort(
        (first, second) =>
          first.name.localeCompare(second.name) ||
          first.id.localeCompare(second.id),
      ),
    }));
  }, [courseClassCounts, reportRows]);

  const selectedReportGroup = useMemo(
    () =>
      classReportGroups.find((group) => group.key === selectedReportGroupKey) ||
      classReportGroups[0] ||
      null,
    [classReportGroups, selectedReportGroupKey],
  );

  const loadLearningPaths = useCallback(async () => {
    try {
      setPathsLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }
      const response = await learningApi.getLearningPaths(token);
      setLearningPaths(response.learningPaths);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to load learning paths.",
        "error",
      );
    } finally {
      setPathsLoading(false);
    }
  }, [getAccessToken, showToast]);

  const loadPathOptions = useCallback(async () => {
    if (!selectedPathId) {
      setCourses([]);
      setLearners([]);
      setCourseClassCounts({});
      setStatusTransferEnrollmentIds([]);
      setSelectedCourseCode("");
      setSelectedEnrollmentIds([]);
      setShowCourseStatusPanel(false);
      setSetupCourseStatusSearch("");
      return;
    }

    try {
      setOptionsLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }
      const response = await learningApi.getClassAssignmentOptions(
        token,
        selectedPathId,
      );
      setCourses(response.courses);
      setLearners(response.learners);
      setCourseClassCounts({});
      setStatusTransferEnrollmentIds([]);
      setSelectedCourseCode("");
      setSelectedEnrollmentIds([]);
      setSelectedClassId("");
      setShowCourseStatusPanel(false);
      setSetupCourseStatusSearch("");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to load class assignment options.",
        "error",
      );
    } finally {
      setOptionsLoading(false);
    }
  }, [getAccessToken, selectedPathId, showToast]);

  const loadClasses = useCallback(async () => {
    if (!selectedCourseCode) {
      setClasses([]);
      setSelectedClassId("");
      return;
    }

    try {
      setClassesLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }
      const response = await learningApi.getClassesByCourseCode(
        token,
        selectedCourseCode,
      );
      setClasses(response.classes);
      setCourseClassCounts((currentCounts) => ({
        ...currentCounts,
        [selectedCourseCode]: response.classes.length,
      }));
      setSelectedClassId(response.classes[0]?.id || "");
      setSelectedEnrollmentIds([]);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to load ERP classes for this course.",
        "error",
      );
      setClasses([]);
      setSelectedClassId("");
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
          showToast("Session expired. Please login again.", "error");
          return;
        }

        const classCounts = await Promise.all(
          courses.map(async (course) => {
            const response = await learningApi.getClassesByCourseCode(
              token,
              course.courseCode,
            );
            return [course.courseCode, response.classes.length] as const;
          }),
        );

        if (!cancelled) {
          setCourseClassCounts(Object.fromEntries(classCounts));
        }
      } catch (error) {
        if (!cancelled) {
          showToast(
            error instanceof Error
              ? error.message
              : "Failed to check ERP class availability.",
            "error",
          );
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
      setSelectedReportGroupKey("");
      return;
    }
    if (
      !classReportGroups.some((group) => group.key === selectedReportGroupKey)
    ) {
      setSelectedReportGroupKey(classReportGroups[0].key);
    }
  }, [classReportGroups, selectedReportGroupKey]);

  const toggleLearner = (enrollmentId: string) => {
    setSelectedEnrollmentIds((prev) =>
      prev.includes(enrollmentId)
        ? prev.filter((id) => id !== enrollmentId)
        : [...prev, enrollmentId],
    );
  };

  const selectVisibleLearners = () => {
    setSelectedEnrollmentIds(
      filteredLearners.map((learner) => learner.enrollmentId),
    );
  };

  const selectNextBatch = () => {
    const count = Math.max(1, Number(batchSize) || 50);
    const nextLearners = filteredLearners
      .slice(0, count)
      .map((learner) => learner.enrollmentId);
    setSelectedEnrollmentIds(nextLearners);
  };

  const clearSelection = () => {
    setSelectedEnrollmentIds([]);
    setStatusTransferEnrollmentIds([]);
  };

  const handleAssign = async () => {
    if (
      !selectedPathId ||
      !selectedCourseCode ||
      !selectedClass ||
      selectedEnrollmentIds.length === 0
    ) {
      showToast(
        "Select a learning path, course, class, and at least one learner.",
        "error",
      );
      return false;
    }

    try {
      setAssigning(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return false;
      }
      const response = await learningApi.assignClassEnrollments(token, {
        learningPathId: selectedPathId,
        courseCode: selectedCourseCode,
        class: selectedClass,
        enrollmentIds: selectedEnrollmentIds,
      });
      const actionLabel =
        assignmentMode === "assign" ? "assigned" : "reassigned";
      showToast(
        `${response.assigned.length} learner(s) ${actionLabel} to ${selectedClass.title}.`,
        "success",
      );
      setStatusTransferEnrollmentIds([]);
      await loadPathOptions();
      return true;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : `Failed to ${assignmentMode === "assign" ? "assign" : "reassign"} learners to class.`,
        "error",
      );
      return false;
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignAnotherClassFromStatus = async () => {
    if (selectedEnrollmentIds.length === 0) {
      showToast("Select at least one not completed learner.", "error");
      return;
    }
    setStatusTransferEnrollmentIds(selectedEnrollmentIds);
    setAssignmentMode("assign");
    setActiveWorkspaceTab("assign");
    setShowCourseStatusPanel(false);
    setSelectedClassId("");
    setLearnerSearch("");
    setSetupCourseStatusSearch("");
  };

  const downloadReportExcel = (reportGroup: ClassReportGroup | null) => {
    if (!reportGroup) {
      showToast(
        "Select a course class report before downloading Excel.",
        "error",
      );
      return;
    }

    const rows = reportGroup.learners
      .map(
        (learner) => `
          <tr>
            <td style="mso-number-format:'\\@';">${escapeHtml(learner.id)}</td>
          </tr>`,
      )
      .join("");

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
                    : "No class assigned",
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
      new Blob([workbookHtml], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      }),
      `${safeFilenamePart(reportGroup.learningPathTitle, "learning-path")}_${safeFilenamePart(
        reportGroup.courseCode,
        "course",
      )}_${safeFilenamePart(reportGroup.classCode, "no-class")}_learners.xls`,
    );
    showToast("Excel report downloaded.", "success");
  };

  const openClassDetailModal = async (reportGroup: ClassReportGroup) => {
    if (!reportGroup.hasClassAssignment || !reportGroup.classId) {
      showToast(
        "Class details are only available after a course is assigned to an ERP class.",
        "info",
      );
      return;
    }

    setClassDetailGroup(reportGroup);
    setClassDetailForm(buildDefaultClassDetailValues(reportGroup));
    setClassDetailLoading(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const response = await learningApi.getClassDetailReport(token, {
        learningPathId: reportGroup.learningPathId,
        courseCode: reportGroup.courseCode,
        classId: reportGroup.classId,
      });

      if (response.report?.values) {
        setClassDetailForm((currentValues) => ({
          ...currentValues,
          ...response.report?.values,
        }));
      }
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to load class details.",
        "error",
      );
    } finally {
      setClassDetailLoading(false);
    }
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
                ${classDetailFields.map((field) => `<th>${escapeHtml(field.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              <tr>
                ${classDetailFields.map((field) => `<td>${escapeHtml(values[field.key])}</td>`).join("")}
              </tr>
            </tbody>
          </table>
        </body>
      </html>`;

    downloadBlob(
      new Blob([workbookHtml], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      }),
      `${safeFilenamePart(values.courseName || classDetailGroup?.courseTitle || "", "course")}_${safeFilenamePart(
        values.classTitle || classDetailGroup?.classCode || "",
        "class",
      )}_class_details.xls`,
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
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const response = await learningApi.saveClassDetailReport(token, {
        learningPathId: classDetailGroup.learningPathId,
        courseCode: classDetailGroup.courseCode,
        classId: classDetailGroup.classId,
        values: classDetailForm,
      });
      const savedValues = {
        ...classDetailForm,
        ...(response.report?.values || {}),
      };
      setClassDetailForm(savedValues);
      downloadClassDetailExcel(savedValues);
      showToast("Class details saved and downloaded.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to save class details.",
        "error",
      );
    } finally {
      setClassDetailSaving(false);
    }
  };

  const pathOptions = [
    { value: "", label: "Select learning path" },
    ...learningPaths.map((path) => ({ value: path.id, label: path.title })),
  ];
  const courseOptions = [
    {
      value: "",
      label: optionsLoading ? "Loading courses..." : "Select course",
    },
    ...courses.map((course) => ({
      value: course.courseCode,
      label: `${course.courseCode} - ${course.title}`,
    })),
  ];

  const handleResetFilters = () => {
    setLearnerSearch("");
    setDesignationFilter("");
    setGradeFilter("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">
            Assign Enrollment [Classes]
          </h1>
          <p className="mt-2 text-secondary-600">
            Allocate learners already enrolled in a learning path into ERP
            classes for each course.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadPathOptions}
          disabled={!selectedPathId || optionsLoading}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Courses Card */}
        <Card
          className="relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-medium border-l-4 border-l-primary-500 bg-gradient-to-br from-indigo-50/80 to-white"
          bodyClassName="h-28 px-6 py-5 flex flex-col justify-center relative z-10"
        >
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-25 transition-transform duration-300 hover:scale-110 hover:opacity-20">
            <BookOpen size={64} className="text-primary-800" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
            Courses
          </p>
          <p className="mt-2 text-4xl font-extrabold text-slate-900">
            {courses.length}
          </p>
        </Card>

        {/* Enrolled Learners Card */}
        <Card
          className="relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-medium border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/80 to-white"
          bodyClassName="h-28 px-6 py-5 flex flex-col justify-center relative z-10"
        >
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-25 transition-transform duration-300 hover:scale-110 hover:opacity-20">
            <Users size={64} className="text-emerald-800" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
            Enrolled Learners
          </p>
          <p className="mt-2 text-4xl font-extrabold text-slate-900">
            {learners.length}
          </p>
        </Card>
      </div>

      <Card
        title="Class Assignment Setup"
        description="Choose the learning path, course, and ERP class before selecting learners."
        action={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setActiveWorkspaceTab("assign");
              setIsReportModalOpen(true);
            }}
            className="min-h-10 rounded-xl px-5 font-semibold"
          >
            <FileText className="h-4 w-4" />
            Report
          </Button>
        }
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Configuration Options
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Select
              label="Learning Path"
              value={selectedPathId}
              options={pathOptions}
              isLoading={pathsLoading}
              onChange={(event) => {
                setSelectedPathId(event.target.value);
                setSelectedCourseCode("");
                setSelectedClassId("");
                setSelectedEnrollmentIds([]);
                setShowCourseStatusPanel(false);
                setSetupCourseStatusSearch("");
              }}
            />
            <Select
              label="Course in Learning Path"
              value={selectedCourseCode}
              options={courseOptions}
              disabled={
                !selectedPathId || optionsLoading || courses.length === 0
              }
              onChange={(event) => {
                const courseCode = event.target.value;
                setSelectedCourseCode(courseCode);
                setSelectedClassId("");
                setSelectedEnrollmentIds([]);
                setAssignmentMode("assign");
                setShowCourseStatusPanel(Boolean(courseCode));
                setSetupCourseStatusTab("notCompleted");
                setSetupCourseStatusSearch("");
              }}
            />
          </div>
        </div>

        {selectedPath ? (
          <div className="mt-4 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                if (selectedCourse) {
                  setShowCourseStatusPanel(true);
                }
              }}
              disabled={!selectedCourse}
              className="flex w-full items-center justify-between gap-3 text-left text-sm text-primary-900 transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-primary-700">
                  Selected setup
                </span>
                <span className="mt-1 block font-semibold">
                  {selectedCourse
                    ? `${selectedCourse.courseCode} - ${selectedCourse.title}`
                    : `${selectedPath.title} / Select course`}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-primary-700">
                {selectedCourse ? "View course status" : "Select course"}
              </span>
            </button>
          </div>
        ) : null}
      </Card>

      <p className="text-sm text-secondary-500">
        {selectedEnrollmentIds.length} selected / {filteredLearners.length}{" "}
        available
      </p>

      {activeWorkspaceTab === "assign" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,430px)_minmax(0,1fr)]">
          <Card
            title="ERP Classes"
            description="Classes are loaded from ERP using the selected course code."
          >
            {classesLoading ? (
              <div className="grid grid-cols-1 gap-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : !selectedCourseCode ? (
              <p className="text-sm text-secondary-500">
                Select a course to view available classes.
              </p>
            ) : classes.length === 0 ? (
              <p className="text-sm text-secondary-500">
                No ERP classes found for this course.
              </p>
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
                      className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 ${
                        active
                          ? "border-primary-500 bg-primary-50 shadow-md ring-1 ring-primary-500"
                          : "border-slate-200 bg-white hover:scale-[1.01] hover:border-primary-300 hover:shadow-sm"
                      }`}
                    >
                      {active && (
                        <div className="absolute right-0 top-0 rounded-bl-xl bg-primary-500 p-1.5 shadow-sm">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="pr-6">
                          <p
                            className={`text-sm font-bold ${active ? "text-primary-950" : "text-slate-800"}`}
                          >
                            {classItem.title}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {classItem.code}
                          </p>
                        </div>
                        <School
                          className={`h-6 w-6 shrink-0 transition-colors ${active ? "text-primary-600" : "text-slate-300"}`}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 text-xs font-medium text-slate-600 sm:grid-cols-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Start:</span>{" "}
                          {classItem.startDate || "-"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">End:</span>{" "}
                          {classItem.endDate || "-"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Mode:</span>{" "}
                          {classItem.venue || "-"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Capacity:</span>{" "}
                          {classItem.capacity || "-"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title={
              assignmentMode === "completion"
                ? "Completion Course Status"
                : assignmentMode === "reassign"
                  ? "Reassign Learners to Replacement Class"
                  : "Learners in Selected Learning Path"
            }
            description={
              assignmentMode === "completion"
                ? "Review learners who have completed the selected course."
                : assignmentMode === "reassign"
                  ? "Move learners who missed an earlier session into the selected course class."
                  : "Select unassigned learners to allocate to the selected course class."
            }
            action={
              assignmentMode === "completion" ? undefined : (
                <Button
                  onClick={handleAssign}
                  isLoading={assigning}
                  disabled={
                    !selectedClass || selectedEnrollmentIds.length === 0
                  }
                >
                  {assignmentMode === "assign"
                    ? "Assign to Class"
                    : "Reassign to Class"}
                </Button>
              )
            }
          >
            <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 shadow-sm w-fit">
              <button
                type="button"
                onClick={() => {
                  setAssignmentMode("assign");
                  setSelectedEnrollmentIds([]);
                }}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  assignmentMode === "assign"
                    ? "bg-primary-700 text-white shadow-md ring-1 ring-primary-700/50"
                    : "text-slate-600 hover:bg-white hover:text-primary-600 hover:shadow-sm"
                }`}
              >
                <UserPlus
                  size={18}
                  className={
                    assignmentMode === "assign"
                      ? "text-primary-100"
                      : "text-slate-400 group-hover:text-primary-500"
                  }
                />
                Assign new
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignmentMode("reassign");
                  setSelectedEnrollmentIds([]);
                }}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  assignmentMode === "reassign"
                    ? "bg-primary-700 text-white shadow-md ring-1 ring-primary-700/50"
                    : "text-slate-600 hover:bg-white hover:text-primary-600 hover:shadow-sm"
                }`}
              >
                <RefreshCw
                  size={18}
                  className={
                    assignmentMode === "reassign"
                      ? "text-primary-100"
                      : "text-slate-400 group-hover:text-primary-500"
                  }
                />
                Reassign missed session
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignmentMode("completion");
                  setSelectedEnrollmentIds([]);
                }}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  assignmentMode === "completion"
                    ? "bg-primary-700 text-white shadow-md ring-1 ring-primary-700/50"
                    : "text-slate-600 hover:bg-white hover:text-primary-600 hover:shadow-sm"
                }`}
              >
                <ClipboardCheck
                  size={18}
                  className={
                    assignmentMode === "completion"
                      ? "text-primary-100"
                      : "text-slate-400 group-hover:text-primary-500"
                  }
                />
                Completion course status
              </button>
            </div>

            {assignmentMode === "completion" ? (
              <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                  Selected Course
                </p>
                <p className="mt-1 text-sm font-semibold text-primary-950">
                  {selectedCourse
                    ? `${selectedCourse.courseCode} - ${selectedCourse.title}`
                    : "Select a course"}
                </p>
              </div>
            ) : null}

            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-white">
                <Filter className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">
                  Filter & Select Learners
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Search and Batch Actions */}
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_140px_auto_auto_auto]">
                  <Input
                    value={learnerSearch}
                    onChange={(event) => setLearnerSearch(event.target.value)}
                    placeholder="Search by Employee ID or Name"
                    aria-label="Search learners"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={batchSize}
                    onChange={(event) => setBatchSize(event.target.value)}
                    aria-label="Batch size"
                  />
                  <Button
                    variant="outline"
                    onClick={selectNextBatch}
                    disabled={
                      assignmentMode === "completion" ||
                      !selectedCourseCode ||
                      selectableLearners.length === 0
                    }
                  >
                    Select Batch
                  </Button>
                  <Button
                    variant="outline"
                    onClick={selectVisibleLearners}
                    disabled={
                      assignmentMode === "completion" ||
                      filteredLearners.length === 0
                    }
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={clearSelection}
                    disabled={selectedEnrollmentIds.length === 0}
                  >
                    Clear Selection
                  </Button>
                </div>

                {/* Filter Options */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end pt-1 border-t border-slate-200/60">
                  <div className="w-full sm:flex-1">
                    <Select
                      label="Filter by Designation"
                      value={designationFilter}
                      onChange={(event) =>
                        setDesignationFilter(event.target.value)
                      }
                      options={[
                        { value: "", label: "All Designations" },
                        ...designationOptions.map((opt) => ({
                          value: opt,
                          label: opt,
                        })),
                      ]}
                    />
                  </div>
                  <div className="w-full sm:flex-1">
                    <Select
                      label="Filter by Grade"
                      value={gradeFilter}
                      onChange={(event) => setGradeFilter(event.target.value)}
                      options={[
                        { value: "", label: "All Grades" },
                        ...gradeOptions.map((opt) => ({
                          value: opt,
                          label: opt,
                        })),
                      ]}
                    />
                  </div>
                  <div className="flex pb-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetFilters}
                      disabled={
                        !learnerSearch && !designationFilter && !gradeFilter
                      }
                      className="w-full sm:w-auto"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Reset Filters
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 text-sm text-secondary-600">
              <Search className="h-4 w-4" />
              {assignmentMode === "completion"
                ? `${filteredCompletedCourseLearners.length} completed learners`
                : `${selectedEnrollmentIds.length} selected from ${filteredLearners.length} visible ${
                    assignmentMode === "reassign"
                      ? "reassignable"
                      : "unassigned"
                  } learners`}
              {selectedCourseCode
                ? ` (${assignedForCourse} already assigned, ${unassignedLearners.length} unassigned)`
                : ""}
              {selectedReassignmentCount > 0
                ? ` - ${selectedReassignmentCount} will move from another class`
                : ""}
            </div>

            {assignmentMode === "completion" ? (
              <div className="rounded-lg border border-emerald-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[34rem]">
                <div className="overflow-auto flex-1 relative">
                  <div className="grid min-w-[712px] grid-cols-[1.4fr_140px_1.4fr] bg-emerald-50/95 backdrop-blur px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 border-b border-emerald-200 sticky top-0 z-10">
                    <span>Name</span>
                    <span>ID</span>
                    <span>Email</span>
                  </div>
                  {optionsLoading ? (
                    <div className="space-y-2 p-4 min-w-[712px]">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : filteredCompletedCourseLearners.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white min-w-[712px]">
                      <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3 border border-emerald-100 shadow-sm">
                        <Users className="h-6 w-6 text-emerald-500" />
                      </div>
                      <p className="text-sm font-bold text-emerald-950 mb-1">
                        No completed learners
                      </p>
                      <p className="text-xs text-emerald-600/80 max-w-sm">
                        No learners have completed this course yet.
                      </p>
                    </div>
                  ) : (
                    <div className="min-w-[712px] divide-y divide-emerald-100 flex flex-col">
                      {filteredCompletedCourseLearners.map((learner) => (
                        <div
                          key={`completed-${learner.enrollmentId}`}
                          className="grid grid-cols-[1.4fr_140px_1.4fr] items-center px-4 py-3 text-sm hover:bg-emerald-50/30 transition-colors"
                        >
                          <span className="flex items-center gap-2 font-bold text-emerald-900">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            {learner.name || "-"}
                          </span>
                          <span className="text-emerald-800 font-medium">
                            {learner.employeeNumber || "-"}
                          </span>
                          <span className="text-emerald-800">
                            {learner.email || "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[36rem]">
                <div className="overflow-auto flex-1 relative">
                  <div className="grid min-w-[760px] grid-cols-[48px_1.6fr_120px_1fr] bg-slate-50/95 backdrop-blur px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200 border-l-4 border-l-transparent sticky top-0 z-10">
                    <span />
                    <span>Learner</span>
                    <span>Employee No</span>
                    <span>Current Class</span>
                  </div>

                  {optionsLoading ? (
                    <div className="space-y-2 p-4 min-w-[760px]">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : filteredLearners.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white min-w-[760px]">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 border border-slate-100 shadow-sm">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-900 mb-1">
                        No learners found
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {assignmentMode === "reassign"
                          ? "No learners are assigned to another class for this course. Choose a different replacement class or course."
                          : "No unassigned learners found for this course. Use reassignment if a learner missed a previous session."}
                      </p>
                    </div>
                  ) : (
                    <div className="min-w-[760px] flex flex-col">
                      {filteredLearners.map((learner) => {
                        const assignedClass = getAssignmentForCourse(
                          learner,
                          selectedCourseCode,
                        );
                        const checked = selectedEnrollmentIds.includes(
                          learner.enrollmentId,
                        );
                        return (
                          <label
                            key={learner.enrollmentId}
                            className={`grid cursor-pointer grid-cols-[48px_1.6fr_120px_1fr] items-center px-4 py-3 text-sm transition-all duration-200 border-b border-slate-100 last:border-b-0 ${
                              checked
                                ? "bg-primary-50 border-l-4 border-l-primary-500"
                                : "bg-white hover:bg-slate-50 hover:shadow-sm border-l-4 border-l-transparent"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleLearner(learner.enrollmentId)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-500 cursor-pointer ml-1"
                            />
                            <span>
                              <span
                                className={`block font-bold ${checked ? "text-primary-950" : "text-slate-800"}`}
                              >
                                {learner.name}
                              </span>
                              <span className="block text-xs text-slate-500 mt-0.5 font-medium">
                                {learner.email}
                              </span>
                            </span>
                            <span className="text-slate-600 font-medium">
                              {learner.employeeNumber || "-"}
                            </span>
                            <span className="text-slate-500">
                              {assignedClass
                                ? assignedClass.classTitle ||
                                  assignedClass.classCode ||
                                  assignedClass.classId
                                : "-"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {showCourseStatusPanel && selectedCourse ? (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-large animate-slide-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-course-status-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-secondary-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                  Course Status
                </p>
                <h2
                  id="setup-course-status-title"
                  className="mt-1 text-lg font-semibold text-secondary-900"
                >
                  {selectedCourse.courseCode} - {selectedCourse.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCourseStatusPanel(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-secondary-500 transition hover:bg-secondary-100 hover:text-secondary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Close course status"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-secondary-200 bg-secondary-50 p-1 sm:w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setSetupCourseStatusTab("notCompleted");
                    setSelectedEnrollmentIds([]);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    setupCourseStatusTab === "notCompleted"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-red-700 hover:bg-red-50"
                  }`}
                >
                  Not Completed ({notCompletedCourseLearners.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupCourseStatusTab("completed");
                    setSelectedEnrollmentIds([]);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    setupCourseStatusTab === "completed"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  Completed ({completedCourseLearners.length})
                </button>
              </div>

              <div className="mt-4">
                <Input
                  value={setupCourseStatusSearch}
                  onChange={(event) =>
                    setSetupCourseStatusSearch(event.target.value)
                  }
                  placeholder="Search learners by name or ID"
                  aria-label="Search course status learners"
                />
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-secondary-200">
                {setupCourseStatusTab === "notCompleted" ? (
                  <>
                    <div className="grid min-w-[760px] grid-cols-[48px_1.4fr_140px_1.4fr] bg-red-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-red-700">
                      <span />
                      <span>Name</span>
                      <span>ID</span>
                      <span>Email</span>
                    </div>
                    {filteredSetupNotCompletedLearners.length === 0 ? (
                      <p className="p-4 text-sm text-secondary-500">
                        No not completed learners found for this course.
                      </p>
                    ) : (
                      <div className="max-h-80 min-w-[760px] divide-y divide-red-100 overflow-auto">
                        {filteredSetupNotCompletedLearners.map((learner) => {
                          const checked = selectedEnrollmentIds.includes(
                            learner.enrollmentId,
                          );
                          return (
                            <label
                              key={`setup-not-completed-${learner.enrollmentId}`}
                              className={`grid cursor-pointer grid-cols-[48px_1.4fr_140px_1.4fr] items-center px-4 py-3 text-sm transition ${
                                checked
                                  ? "bg-red-100"
                                  : "bg-white hover:bg-red-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  toggleLearner(learner.enrollmentId)
                                }
                                className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                              />
                              <span className="flex items-center gap-2 font-medium text-red-900">
                                <X className="h-4 w-4 text-red-600" />
                                {learner.name || "-"}
                              </span>
                              <span className="text-red-800">
                                {learner.employeeNumber || "-"}
                              </span>
                              <span className="text-red-800">
                                {learner.email || "-"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid min-w-[712px] grid-cols-[1.4fr_140px_1.4fr] bg-emerald-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      <span>Name</span>
                      <span>ID</span>
                      <span>Email</span>
                    </div>
                    {filteredSetupCompletedLearners.length === 0 ? (
                      <p className="p-4 text-sm text-secondary-500">
                        No completed learners found for this course.
                      </p>
                    ) : (
                      <div className="max-h-80 min-w-[712px] divide-y divide-emerald-100 overflow-auto">
                        {filteredSetupCompletedLearners.map((learner) => (
                          <div
                            key={`setup-completed-${learner.enrollmentId}`}
                            className="grid grid-cols-[1.4fr_140px_1.4fr] items-center px-4 py-3 text-sm"
                          >
                            <span className="flex items-center gap-2 font-medium text-emerald-900">
                              <Check className="h-4 w-4 text-emerald-600" />
                              {learner.name || "-"}
                            </span>
                            <span className="text-emerald-800">
                              {learner.employeeNumber || "-"}
                            </span>
                            <span className="text-emerald-800">
                              {learner.email || "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-secondary-200 bg-secondary-50 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCourseStatusPanel(false)}
              >
                Close
              </Button>
              {setupCourseStatusTab === "notCompleted" ? (
                <Button
                  type="button"
                  onClick={handleAssignAnotherClassFromStatus}
                  disabled={selectedEnrollmentIds.length === 0}
                >
                  Assign Another Class
                </Button>
              ) : null}
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {isReportModalOpen ? (
        <ModalOverlay className="fixed inset-0 z-[65] flex items-center justify-center bg-[#034c96]/70 p-4 backdrop-blur-sm">
          <div
            className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-large ring-1 ring-white/20 animate-slide-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-assignment-report-title"
          >
            <div className="bg-white border-b border-secondary-200 px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#034c96]/10 text-[#034c96] ring-1 ring-[#034c96]/20">
                    <FileText className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-secondary-500">
                      Class Assignment Report
                    </p>
                    <h2
                      id="class-assignment-report-title"
                      className="mt-1 text-2xl font-bold text-secondary-900"
                    >
                      Course/Class Learner Reports
                    </h2>
                    <p className="mt-1 text-sm text-secondary-500">
                      Select a course class box to view learner details and
                      download the Excel report.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeReportModal}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-secondary-200 bg-white text-secondary-500 transition hover:bg-secondary-50 hover:text-secondary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300"
                  aria-label="Close report window"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-3">
                  <p className="text-xs font-semibold uppercase text-secondary-500">
                    Learning Path
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-secondary-900">
                    {selectedPath?.title || "Not selected"}
                  </p>
                </div>
                <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-3">
                  <p className="text-xs font-semibold uppercase text-secondary-500">
                    Report Boxes
                  </p>
                  <p className="mt-1 text-sm font-semibold text-secondary-900">
                    {classReportGroups.length} ready
                  </p>
                </div>
                <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-3">
                  <p className="text-xs font-semibold uppercase text-secondary-500">
                    Learners
                  </p>
                  <p className="mt-1 text-sm font-semibold text-secondary-900">
                    {learners.length} enrolled
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto bg-secondary-50 p-5">
              {reportRows.length === 0 ? (
                <p className="rounded-xl border border-secondary-200 bg-white p-5 text-sm text-secondary-500 shadow-soft">
                  Select a learning path to generate the report.
                </p>
              ) : classAvailabilityLoading ? (
                <p className="rounded-xl border border-secondary-200 bg-white p-5 text-sm text-secondary-500 shadow-soft">
                  Checking ERP class availability for these courses...
                </p>
              ) : classReportGroups.length === 0 ? (
                <p className="rounded-xl border border-secondary-200 bg-white p-5 text-sm text-secondary-500 shadow-soft">
                  No report-ready learners found. Assign learners to available
                  ERP classes, or use courses with no ERP classes.
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
                            if (event.key === "Enter" || event.key === " ") {
                              setSelectedReportGroupKey(group.key);
                            }
                          }}
                          className={`cursor-pointer rounded-xl border p-4 text-left transition ${
                            active
                              ? "border-[#034c96] bg-white shadow-medium ring-2 ring-[#034c96]/15"
                              : "border-secondary-200 bg-white shadow-soft hover:border-[#0563bb] hover:bg-secondary-50"
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                            {group.learningPathTitle}
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="font-semibold text-secondary-900">
                                {group.courseCode}
                              </p>
                              <p className="text-xs text-secondary-500">
                                {group.courseTitle}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-secondary-900">
                                {group.hasClassAssignment
                                  ? `Class No: ${group.classCode}`
                                  : "No class assigned"}
                              </p>
                              <p className="text-xs text-secondary-500">
                                {group.hasClassAssignment
                                  ? group.classTitle || "-"
                                  : "Report generated from LP enrollment"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-[#034c96]">
                            {group.learners.length} learner(s)
                          </p>
                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-auto min-h-9 w-full whitespace-normal px-3 py-2 !border-[#034c96] !bg-white !text-[#034c96] hover:!bg-[#034c96]/10"
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
                              size="sm"
                              className="h-auto min-h-9 w-full whitespace-normal rounded-xl px-3 py-2 !bg-[#034c96] !text-white shadow-sm hover:!bg-[#0563bb]"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedReportGroupKey(group.key);
                                openClassDetailModal(group);
                              }}
                              disabled={!group.hasClassAssignment}
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span>Class detail report</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedReportGroup ? (
                    <div className="overflow-hidden rounded-xl border border-secondary-200 bg-white shadow-soft">
                      <div className="grid gap-2 border-b border-secondary-200 bg-white px-4 py-3 text-sm lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                            Learning Path
                          </p>
                          <p className="font-semibold text-secondary-900">
                            {selectedReportGroup.learningPathTitle}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                            Course
                          </p>
                          <p className="font-semibold text-secondary-900">
                            {selectedReportGroup.courseCode}
                          </p>
                          <p className="text-xs text-secondary-500">
                            {selectedReportGroup.courseTitle}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                            Class
                          </p>
                          <p className="font-semibold text-secondary-900">
                            {selectedReportGroup.hasClassAssignment
                              ? `Class No: ${selectedReportGroup.classCode}`
                              : "No class assigned"}
                          </p>
                          <p className="text-xs text-secondary-500">
                            {selectedReportGroup.hasClassAssignment
                              ? selectedReportGroup.classTitle || "-"
                              : "Report generated from LP enrollment"}
                          </p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                          {selectedReportGroup.learners.length} learner(s)
                        </span>
                      </div>
                      <div className="max-h-80 overflow-auto">
                        <table className="w-full min-w-[800px] table-fixed text-left text-sm">
                          <thead className="sticky top-0 z-10 border-b border-secondary-200 bg-secondary-50 text-xs font-semibold uppercase tracking-wide text-secondary-500">
                            <tr>
                              <th className="w-[120px] px-4 py-3">ID</th>
                              <th className="w-[30%] px-4 py-3">Name</th>
                              <th className="w-[30%] px-4 py-3">Email</th>
                              <th className="w-[20%] px-4 py-3">Designation</th>
                              <th className="w-[20%] px-4 py-3">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-secondary-100 bg-white">
                            {selectedReportGroup.learners.map((learner) => (
                              <tr
                                key={`${selectedReportGroup.key}-${learner.id}`}
                                className="transition-colors hover:bg-secondary-50/50"
                              >
                                <td
                                  className="truncate px-4 py-3 text-secondary-700"
                                  title={learner.id}
                                >
                                  {learner.id || "-"}
                                </td>
                                <td
                                  className="truncate px-4 py-3 font-medium text-secondary-900"
                                  title={learner.name}
                                >
                                  {learner.name || "-"}
                                </td>
                                <td
                                  className="truncate px-4 py-3 text-secondary-500"
                                  title={learner.email}
                                >
                                  {learner.email || "-"}
                                </td>
                                <td
                                  className="truncate px-4 py-3 text-secondary-500"
                                  title={learner.designation}
                                >
                                  {learner.designation || "-"}
                                </td>
                                <td
                                  className="truncate px-4 py-3 text-secondary-500"
                                  title={learner.gradeName}
                                >
                                  {learner.gradeName || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-secondary-200 bg-white px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeReportModal}
              >
                Close
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {classDetailGroup ? (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-[#034c96]/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
            <div className="border-b border-[#034c96] bg-[linear-gradient(90deg,#034c96_0%,#0563bb_35%,#3faa45_100%)] px-5 py-4">
              <h2 className="text-lg font-semibold text-white">
                Class Details
              </h2>
              <p className="mt-1 text-sm text-white/75">
                {classDetailGroup.courseCode} - {classDetailGroup.classCode}
              </p>
            </div>

            <div className="overflow-y-auto p-5">
              {classDetailLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton
                      key={`class-detail-skeleton-${index}`}
                      className="h-16 w-full"
                    />
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
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-secondary-200 bg-secondary-50 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeClassDetailModal}
              >
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
