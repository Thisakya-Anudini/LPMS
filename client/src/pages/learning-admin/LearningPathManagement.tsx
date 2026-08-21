import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Search,
  Trash2,
  Globe,
  Lock,
  BookOpen,
  Filter,
  RotateCcw,
  CheckCircle,
  UserPlus,
  Users,
} from "lucide-react";
import { ApiRequestError, courseApi, learningApi } from "../../api/lpmsApi";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ModalOverlay } from "../../components/ui/ModalOverlay";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

type Category = "RESTRICTED" | "PUBLIC";
type PathStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

type LearningPathRow = {
  id: string;
  title: string;
  description: string;
  category: Category;
  total_duration: string;
  status: PathStatus;
};

type AssignableLearner = {
  employeeNumber: string;
  employeeName: string;
  employeeSurname: string;
  email: string;
  designation: string;
  gradeName: string;
  organizationName: string;
  costCenterCode: string;
  costCenterName: string;
  employeeInitials: string;
  employeeSupervisorNumber: string;
};

type CourseItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  durationHours: number | null;
  deliveryMode: "ONLINE" | "PHYSICAL" | null;
  venue: string | null;
  videoUrl: string | null;
};

type DuplicateLearningPathCourse = {
  title?: string;
  code?: string;
};

type DuplicateLearningPathSummary = {
  id: string;
  title?: string;
  overlappingCourses?: DuplicateLearningPathCourse[];
};

type DuplicateLearningPathPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: {
      existing?: DuplicateLearningPathSummary[];
    };
  };
  existing?: DuplicateLearningPathSummary[];
};

type StageForm = {
  stageId: string;
  title: string;
  selectedCourseIds: string[];
};

const EMPLOYEE_NO_LENGTH = 6;

const createStageForm = (index: number): StageForm => ({
  stageId: `stage-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  title: `Stage ${index + 1}`,
  selectedCourseIds: [],
});

const normalizeSearchText = (value: string | null | undefined) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getCourseRenderKey = (course: CourseItem, index: number, scope: string) =>
  `${scope}-${course.id || "no-id"}-${course.code || "no-code"}-${course.title || "no-title"}-${index}`;

const filterCoursesByQuery = (courses: CourseItem[], query: string) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return courses;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return courses.filter((course) => {
    const searchHaystack = [
      normalizeSearchText(course.title),
      normalizeSearchText(course.code),
      normalizeSearchText(course.description),
    ]
      .filter(Boolean)
      .join(" ");

    return queryTokens.every((token) => searchHaystack.includes(token));
  });
};

const normalizeTitleInputSpacing = (value: string) =>
  value.replace(/\s{2,}/g, " ");

const isDuplicateLearningPathPayload = (
  payload: unknown,
): payload is DuplicateLearningPathPayload => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("error" in payload)
  ) {
    return false;
  }

  const error = (payload as { error?: { code?: unknown } }).error;
  return error?.code === "DUPLICATE_LEARNING_PATH";
};

const initialPathForm = {
  title: "",
  description: "",
  category: "PUBLIC" as Category,
  stages: [] as StageForm[],
  draftStage: createStageForm(0) as StageForm,
};

const initialAssignForm = {
  learningPathId: "",
  selectedLearnerEmployeeNumbers: [] as string[],
};

type LearningPathManagementSection = "create" | "assign" | "manage";

const sectionMeta: Record<
  LearningPathManagementSection,
  { title: string; description: string }
> = {
  create: {
    title: "Create Learning Path",
    description: "Create new learning paths and define course order.",
  },
  assign: {
    title: "Assign Enrollments",
    description: "Assign learning paths to learners.",
  },
  manage: {
    title: "Manage Learning Paths",
    description: "Search, edit, and delete existing learning paths.",
  },
};

export function LearningPathManagement({
  section,
}: {
  section: LearningPathManagementSection;
}) {
  const { getAccessToken, user } = useAuth();
  const { showToast } = useToast();

  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [learners, setLearners] = useState<AssignableLearner[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "">("");
  const [statusFilter, setStatusFilter] = useState<PathStatus | "">("");

  const [pathForm, setPathForm] = useState(initialPathForm);
  const [pathDuplicateWarning, setPathDuplicateWarning] = useState<null | {
    message: string;
    existing: DuplicateLearningPathSummary[];
  }>(null);
  const [pathTitleError, setPathTitleError] = useState<string | null>(null);
  const [editTitleError, setEditTitleError] = useState<string | null>(null);
  const [pathFormLoading, setPathFormLoading] = useState(false);
  const [createCourseSearch, setCreateCourseSearch] = useState("");
  const [editCourseSearch, setEditCourseSearch] = useState("");

  const [editPathId, setEditPathId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "PUBLIC" as Category,
    status: "ACTIVE" as PathStatus,
    stages: [] as StageForm[],
  });
  const [originalEditForm, setOriginalEditForm] = useState<
    typeof editForm | null
  >(null);
  const [editLoading, setEditLoading] = useState(false);
  const [pendingDeletePath, setPendingDeletePath] =
    useState<LearningPathRow | null>(null);

  const [assignForm, setAssignForm] = useState(initialAssignForm);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignOptionsLoading, setAssignOptionsLoading] = useState(
    section === "assign",
  );
  const [assignSearchLoading, setAssignSearchLoading] = useState(false);
  const [assignEmployeeNoSearch, setAssignEmployeeNoSearch] = useState("");
  const [assignEmployeeNoError, setAssignEmployeeNoError] = useState("");
  const [assignEmployeeNoChecking, setAssignEmployeeNoChecking] =
    useState(false);
  const [assignSurnameSearch, setAssignSurnameSearch] = useState("");
  const [assignNameError, setAssignNameError] = useState("");
  const [assignNameChecking, setAssignNameChecking] = useState(false);
  const [assignDesignationFilter, setAssignDesignationFilter] = useState("");
  const [assignGradeFilter, setAssignGradeFilter] = useState("");
  const [assignOrganizationFilter, setAssignOrganizationFilter] = useState("");
  const [assignPayrollFilter, setAssignPayrollFilter] = useState("");
  const [designationOptions, setDesignationOptions] = useState<string[]>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([]);
  const [organizationOptions, setOrganizationOptions] = useState<
    Array<{
      organizationId: string;
      organizationName: string;
      parentOrganizationName: string;
    }>
  >([]);
  const [enrolledEmployeeNumbers, setEnrolledEmployeeNumbers] = useState<
    Set<string>
  >(new Set());
  const [coursePageSize] = useState(10);
  const [currentCoursePage, setCurrentCoursePage] = useState(1);
  const [coursePagination, setCoursePagination] = useState<{
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null>(null);
  const [pathPageSize] = useState(10);
  const [currentPathPage, setCurrentPathPage] = useState(1);
  const assignEmployeeNoValidationRequestId = useRef(0);
  const assignNameValidationRequestId = useRef(0);
  const hasAssignEmployeeNoSearch = assignEmployeeNoSearch.trim().length > 0;
  const hasAssignNameSearch = assignSurnameSearch.trim().length > 0;
  const hasAssignFilterSearch =
    Boolean(assignDesignationFilter) ||
    Boolean(assignGradeFilter) ||
    Boolean(assignOrganizationFilter) ||
    Boolean(assignPayrollFilter);
  const hasInvalidAssignEmployeeNoSearch =
    hasAssignEmployeeNoSearch &&
    (assignEmployeeNoSearch.trim().length !== EMPLOYEE_NO_LENGTH ||
      assignEmployeeNoChecking ||
      Boolean(assignEmployeeNoError));
  const hasInvalidAssignNameSearch =
    hasAssignNameSearch && (assignNameChecking || Boolean(assignNameError));
  const isAssignLearnerSearchDisabled =
    (!hasAssignEmployeeNoSearch &&
      !hasAssignNameSearch &&
      !hasAssignFilterSearch) ||
    hasInvalidAssignEmployeeNoSearch ||
    hasInvalidAssignNameSearch;
  const assignEmployeeNoPlaceholder = `e.g. ${user?.employeeNo?.trim() || "employee number"}`;
  const assignNamePlaceholder = `e.g. ${user?.name?.trim() || "name"}`;

  const clearAssignFilters = () => {
    setAssignDesignationFilter("");
    setAssignGradeFilter("");
    setAssignOrganizationFilter("");
    setAssignPayrollFilter("");
  };

  const activateAssignEmployeeSearch = () => {
    setAssignEmployeeNoError("");
    setAssignEmployeeNoChecking(false);
    setAssignNameError("");
    setAssignNameChecking(false);
    if (hasAssignNameSearch) {
      setAssignSurnameSearch("");
    }
    if (hasAssignFilterSearch) {
      clearAssignFilters();
    }
  };

  const activateAssignNameSearch = () => {
    setAssignEmployeeNoError("");
    setAssignEmployeeNoChecking(false);
    setAssignNameError("");
    setAssignNameChecking(false);
    if (hasAssignEmployeeNoSearch) {
      setAssignEmployeeNoSearch("");
    }
    if (hasAssignFilterSearch) {
      clearAssignFilters();
    }
  };

  const activateAssignFilterSearch = () => {
    setAssignEmployeeNoError("");
    setAssignEmployeeNoChecking(false);
    setAssignNameError("");
    setAssignNameChecking(false);
    if (hasAssignEmployeeNoSearch) {
      setAssignEmployeeNoSearch("");
    }
    if (hasAssignNameSearch) {
      setAssignSurnameSearch("");
    }
  };

  const handleAssignEmployeeNoChange = (value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, EMPLOYEE_NO_LENGTH);
    setAssignEmployeeNoError("");
    setAssignEmployeeNoChecking(false);
    if (numericValue.trim()) {
      activateAssignEmployeeSearch();
    }
    setAssignEmployeeNoSearch(numericValue);
  };

  const handleAssignNameSearchChange = (value: string) => {
    const sanitizedValue = value.replace(
      /[^A-Za-z\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g,
      "",
    );
    setAssignNameError("");
    setAssignNameChecking(false);
    if (sanitizedValue.trim()) {
      activateAssignNameSearch();
    }
    setAssignSurnameSearch(sanitizedValue);
  };

  const handleAssignDesignationChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignDesignationFilter(value);
  };

  const handleAssignGradeChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignGradeFilter(value);
  };

  const handleAssignOrganizationChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignOrganizationFilter(value);
  };

  const handleAssignPayrollChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignPayrollFilter(value);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setAssignOptionsLoading(section === "assign");
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const [pathsResponse, coursesResponse] = await Promise.all([
        learningApi.getLearningPaths(token),
        courseApi.getAllCourses(token, currentCoursePage, coursePageSize),
      ]);

      setPaths(pathsResponse.learningPaths as LearningPathRow[]);
      setCourses(coursesResponse.courses);

      if (coursesResponse.pagination) {
        setCoursePagination(coursesResponse.pagination);
      }

      if (section === "assign") {
        const optionsResponse =
          await learningApi.getAssignableEmployeeSearchOptions(token);
        setDesignationOptions(optionsResponse.designations);
        setGradeOptions(optionsResponse.grades);
        setOrganizationOptions(
          optionsResponse.organizations.map((organization) => ({
            organizationId: organization.organizationId,
            organizationName: organization.organizationName,
            parentOrganizationName: organization.parentOrganizationName,
          })),
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load data.",
        "error",
      );
    } finally {
      setLoading(false);
      setAssignOptionsLoading(false);
    }
  }, [getAccessToken, section, showToast, currentCoursePage, coursePageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setCurrentPathPage(1);
  }, [query, categoryFilter, statusFilter]);

  const filteredPaths = useMemo(() => {
    let result = paths;

    if (categoryFilter) {
      result = result.filter((path) => path.category === categoryFilter);
    }
    if (statusFilter) {
      result = result.filter((path) => path.status === statusFilter);
    }

    const normalized = query.trim().toLowerCase();
    if (normalized) {
      result = result.filter(
        (path) =>
          path.title.toLowerCase().includes(normalized) ||
          path.description.toLowerCase().includes(normalized),
      );
    }
    return result;
  }, [paths, query, categoryFilter, statusFilter]);

  const paginatedPaths = useMemo(() => {
    const totalRecords = filteredPaths.length;
    const totalPages = Math.ceil(totalRecords / pathPageSize);
    const startIndex = (currentPathPage - 1) * pathPageSize;
    const endIndex = startIndex + pathPageSize;

    return {
      data: filteredPaths.slice(startIndex, endIndex),
      totalRecords,
      totalPages,
      currentPage: currentPathPage,
      pageSize: pathPageSize,
      hasNextPage: currentPathPage < totalPages,
      hasPrevPage: currentPathPage > 1,
    };
  }, [filteredPaths, currentPathPage, pathPageSize]);

  const toStages = (stages: StageForm[]) =>
    stages
      .filter((stage) => stage.selectedCourseIds.length > 0)
      .map((stage, stageIndex) => ({
        title: stage.title,
        order: stageIndex + 1,
        courses: stage.selectedCourseIds.map((courseId, courseIndex) => ({
          courseId,
          order: courseIndex + 1,
        })),
      }));

  const getCreateStagesPayload = () => {
    const combined = [...pathForm.stages];
    if (pathForm.draftStage.selectedCourseIds.length > 0) {
      combined.push(pathForm.draftStage);
    }
    return toStages(combined);
  };

  const validateTitleValue = (
    value: string,
  ): { valid: true } | { valid: false; message: string } => {
    const normalized = String(value || "").trim();
    if (normalized === "") {
      return { valid: false, message: "Title is required." };
    }

    const allowedTitleRegex = /^[A-Za-z\s]+$/;
    if (!allowedTitleRegex.test(normalized)) {
      return {
        valid: false,
        message: "Title may only contain alphabetic characters and spaces.",
      };
    }

    if (/\s{2,}/.test(normalized)) {
      return {
        valid: false,
        message: "Title must use only one space between words.",
      };
    }

    if (!/[A-Za-z]/.test(normalized)) {
      return {
        valid: false,
        message: "Title must include at least one letter.",
      };
    }

    return { valid: true };
  };

  const validateCoursesSelected = (
    stages: StageForm[],
  ): { valid: true } | { valid: false; message: string } => {
    const hasSelectedCourses = stages.some(
      (stage) => stage.selectedCourseIds.length > 0,
    );
    if (!hasSelectedCourses) {
      return { valid: false, message: "You must select at least one course." };
    }
    return { valid: true };
  };

  const handleCreatePath = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPathFormLoading(true);
    setPathDuplicateWarning(null);
    setPathTitleError(null);
    const titleValidation = validateTitleValue(pathForm.title);
    if (!titleValidation.valid) {
      setPathTitleError(titleValidation.message);
      showToast(titleValidation.message, "error");
      setPathFormLoading(false);
      return;
    }
    const coursesValidation = validateCoursesSelected([
      ...pathForm.stages,
      pathForm.draftStage,
    ]);
    if (!coursesValidation.valid) {
      showToast(coursesValidation.message, "error");
      setPathFormLoading(false);
      return;
    }

    const createStagesPayload = getCreateStagesPayload();
    if (createStagesPayload.length === 0) {
      showToast(
        "A learning path must have at least one stage with selected courses.",
        "error",
      );
      setPathFormLoading(false);
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      await learningApi.createLearningPath(token, {
        title: pathForm.title,
        description: pathForm.description,
        category: pathForm.category,
        totalDuration: "",
        stages: getCreateStagesPayload(),
      });
      setPathForm(initialPathForm);
      showToast("Learning path created successfully.", "success");
      await loadData();
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        isDuplicateLearningPathPayload(err.payload)
      ) {
        const payload = err.payload;
        const message =
          payload.error?.message || "Duplicate learning path detected.";
        setPathDuplicateWarning({
          message,
          existing: payload.error?.details?.existing || payload.existing || [],
        });
        showToast(message, "info");
      } else {
        showToast(
          err instanceof Error
            ? err.message
            : "Failed to create learning path.",
          "error",
        );
      }
    } finally {
      setPathFormLoading(false);
    }
  };

  const startEdit = async (path: LearningPathRow) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const detailResponse = await learningApi.getLearningPathById(
        token,
        path.id,
      );
      const stagesFromApi = detailResponse.learningPath.stages || [];

      const mappedStages: StageForm[] = stagesFromApi
        .sort((a, b) => a.stage_order - b.stage_order)
        .map((stage, stageIndex) => ({
          stageId: stage.id || createStageForm(stageIndex).stageId,
          title: stage.title,
          selectedCourseIds: (stage.courses || [])
            .sort((a, b) => a.course_order - b.course_order)
            .map(
              (course) =>
                courses.find(
                  (catalogCourse) => catalogCourse.title === course.title,
                )?.id,
            )
            .filter((value): value is string => Boolean(value)),
        }));

      setEditPathId(path.id);
      setEditCourseSearch("");

      const initialForm = {
        title: path.title,
        description: path.description,
        category: path.category,
        status: path.status,
        stages: mappedStages.length > 0 ? mappedStages : [createStageForm(0)],
      };

      setEditForm(initialForm);
      setOriginalEditForm(initialForm);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to load learning path details.",
        "error",
      );
    }
  };

  const handleUpdatePath = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editPathId) {
      return;
    }
    setEditLoading(true);
    setEditTitleError(null);
    const titleValidation = validateTitleValue(editForm.title);
    if (!titleValidation.valid) {
      setEditTitleError(titleValidation.message);
      showToast(titleValidation.message, "error");
      setEditLoading(false);
      return;
    }
    const coursesValidation = validateCoursesSelected(editForm.stages);
    if (!coursesValidation.valid) {
      showToast(coursesValidation.message, "error");
      setEditLoading(false);
      return;
    }

    if (editForm.stages.length === 0) {
      showToast("A learning path must have at least one stage.", "error");
      setEditLoading(false);
      return;
    }

    const hasEmptyStages = editForm.stages.some(
      (stage) => stage.selectedCourseIds.length === 0,
    );
    if (hasEmptyStages) {
      showToast(
        "All stages must have at least one selected course. Please select courses or remove empty stages.",
        "error",
      );
      setEditLoading(false);
      return;
    }

    if (originalEditForm) {
      const isUnchanged =
        originalEditForm.title === editForm.title &&
        originalEditForm.description === editForm.description &&
        originalEditForm.category === editForm.category &&
        originalEditForm.status === editForm.status &&
        JSON.stringify(originalEditForm.stages) ===
          JSON.stringify(editForm.stages);

      if (isUnchanged) {
        showToast("No changes were made to the learning path.", "info");
        setEditLoading(false);
        setEditPathId(null);

        return;
      }
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      await learningApi.updateLearningPath(token, editPathId, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        status: editForm.status,
        stages: toStages(editForm.stages),
      });
      showToast("Learning path updated successfully.", "success");
      setEditPathId(null);
      await loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update learning path.",
        "error",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePath = async (id: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }
      await learningApi.deleteLearningPath(token, id);
      showToast("Learning path deleted successfully.", "success");
      setPendingDeletePath(null);
      await loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete learning path.",
        "error",
      );
    }
  };

  const toggleLearnerSelection = (employeeNumber: string) => {
    setAssignForm((prev) => {
      const exists =
        prev.selectedLearnerEmployeeNumbers.includes(employeeNumber);
      return {
        ...prev,
        selectedLearnerEmployeeNumbers: exists
          ? prev.selectedLearnerEmployeeNumbers.filter(
              (value) => value !== employeeNumber,
            )
          : [...prev.selectedLearnerEmployeeNumbers, employeeNumber],
      };
    });
  };

  const updateStageCourses = (
    mode: "create" | "edit",
    stageIndex: number,
    updater: (selectedCourseIds: string[]) => string[],
  ) => {
    if (mode === "create") {
      setPathForm((prev) => ({
        ...prev,
        stages:
          stageIndex < prev.stages.length
            ? prev.stages.map((stage, index) =>
                index === stageIndex
                  ? {
                      ...stage,
                      selectedCourseIds: updater(stage.selectedCourseIds),
                    }
                  : stage,
              )
            : prev.stages,
        draftStage:
          stageIndex < prev.stages.length
            ? prev.draftStage
            : {
                ...prev.draftStage,
                selectedCourseIds: updater(prev.draftStage.selectedCourseIds),
              },
      }));
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, index) =>
        index === stageIndex
          ? { ...stage, selectedCourseIds: updater(stage.selectedCourseIds) }
          : stage,
      ),
    }));
  };

  const toggleCourse = (
    stageIndex: number,
    courseId: string,
    mode: "create" | "edit",
  ) => {
    updateStageCourses(mode, stageIndex, (selectedCourseIds) =>
      selectedCourseIds.includes(courseId)
        ? selectedCourseIds.filter((id) => id !== courseId)
        : [...selectedCourseIds, courseId],
    );
  };

  const moveCourse = (
    stageIndex: number,
    index: number,
    direction: "up" | "down",
    mode: "create" | "edit",
  ) => {
    const selectedCourseIds =
      mode === "create"
        ? (stageIndex < pathForm.stages.length
            ? pathForm.stages[stageIndex]?.selectedCourseIds
            : pathForm.draftStage.selectedCourseIds) || []
        : editForm.stages[stageIndex]?.selectedCourseIds || [];
    const next = [...selectedCourseIds];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) {
      return;
    }
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    updateStageCourses(mode, stageIndex, () => next);
  };

  const updateStageTitle = (
    mode: "create" | "edit",
    stageIndex: number,
    title: string,
  ) => {
    if (mode === "create") {
      setPathForm((prev) => ({
        ...prev,
        stages:
          stageIndex < prev.stages.length
            ? prev.stages.map((stage, index) =>
                index === stageIndex ? { ...stage, title } : stage,
              )
            : prev.stages,
        draftStage:
          stageIndex < prev.stages.length
            ? prev.draftStage
            : { ...prev.draftStage, title },
      }));
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, index) =>
        index === stageIndex ? { ...stage, title } : stage,
      ),
    }));
  };

  const addStage = (mode: "create" | "edit") => {
    if (mode === "create") {
      setPathForm((prev) => {
        if (prev.draftStage.selectedCourseIds.length === 0) {
          showToast(
            "Select at least one course before adding a stage.",
            "error",
          );
          return prev;
        }
        const nextStages = [...prev.stages, prev.draftStage];
        return {
          ...prev,
          stages: nextStages,
          draftStage: createStageForm(nextStages.length),
        };
      });
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      stages: [...prev.stages, createStageForm(prev.stages.length)],
    }));
  };

  const removeStage = (mode: "create" | "edit", stageIndex: number) => {
    if (mode === "create") {
      setPathForm((prev) => {
        if (stageIndex < prev.stages.length) {
          const nextStages = prev.stages.filter(
            (_, index) => index !== stageIndex,
          );
          return {
            ...prev,
            stages: nextStages,
          };
        }
        return {
          ...prev,
          draftStage: createStageForm(prev.stages.length),
        };
      });
      return;
    }
    setEditForm((prev) => {
      const next = prev.stages.filter((_, index) => index !== stageIndex);
      return { ...prev, stages: next.length > 0 ? next : [createStageForm(0)] };
    });
  };

  const renderCourseSelector = (
    stages: StageForm[],
    mode: "create" | "edit",
  ) => {
    const visibleCourses =
      mode === "edit"
        ? filterCoursesByQuery(courses, editCourseSearch)
        : courses;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stages.map((stage, stageIndex) => (
          <div
            key={`${mode}-${stage.stageId}`}
            className="md:col-span-2 border border-slate-200 rounded-lg p-3 space-y-3"
          >
            <div className="flex items-end gap-2">
              <Input
                label={`Stage ${stageIndex + 1} Name`}
                value={stage.title}
                onChange={(event) =>
                  updateStageTitle(mode, stageIndex, event.target.value)
                }
                required
              />
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => removeStage(mode, stageIndex)}
              >
                Remove Stage
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    Select Courses
                  </p>
                  {mode === "edit" ? (
                    <div className="w-full md:w-80">
                      <Input
                        id={`edit-course-search-${stage.stageId}`}
                        placeholder="Search by course name or ID"
                        value={editCourseSearch}
                        onChange={(event) =>
                          setEditCourseSearch(event.target.value)
                        }
                      />
                    </div>
                  ) : null}
                </div>
                <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-slate-500">
                    {mode === "edit" ? (
                      <>
                        Showing {visibleCourses.length} of {courses.length}{" "}
                        courses
                      </>
                    ) : coursePagination ? (
                      <>
                        Total Courses: {coursePagination.totalRecords} | Page{" "}
                        {currentCoursePage} of {coursePagination.totalPages}
                      </>
                    ) : (
                      <>Showing {courses.length} courses</>
                    )}
                  </p>
                  {mode === "create" && coursePagination && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCurrentCoursePage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={!coursePagination.hasPrevPage || loading}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentCoursePage((prev) => prev + 1)}
                        disabled={!coursePagination.hasNextPage || loading}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
                <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
                  {visibleCourses.length === 0 ? (
                    <p className="p-3 text-sm text-slate-500">
                      No courses match "{editCourseSearch.trim()}".
                    </p>
                  ) : (
                    visibleCourses.map((course, courseIndex) => (
                      <label
                        key={getCourseRenderKey(
                          course,
                          courseIndex,
                          `${mode}-${stage.stageId}`,
                        )}
                        className="flex items-start gap-3 p-2 rounded hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={stage.selectedCourseIds.includes(course.id)}
                          onChange={() =>
                            toggleCourse(stageIndex, course.id, mode)
                          }
                        />
                        <span className="text-sm">
                          <span className="block font-medium text-slate-900">
                            {course.title}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {course.code}
                          </span>
                          {course.description ? (
                            <span className="block text-xs text-slate-500">
                              {course.description}
                            </span>
                          ) : null}
                          {course.deliveryMode ? (
                            <span className="block text-xs text-slate-600">
                              {course.deliveryMode === "ONLINE"
                                ? `Online${course.videoUrl ? " | Video available" : ""}`
                                : course.deliveryMode === "PHYSICAL"
                                  ? `Physical${course.venue ? ` | Venue: ${course.venue}` : ""}`
                                  : "N/A"}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Course Order in Stage
                </p>
                <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
                  {stage.selectedCourseIds.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">
                      Select courses to define order for this stage.
                    </p>
                  ) : (
                    stage.selectedCourseIds.map((courseId, courseIndex) => {
                      const course = courses.find(
                        (item) => item.id === courseId,
                      );
                      return (
                        <div
                          key={`${courseId}-${mode}-${stage.stageId}-order`}
                          className="p-2 rounded border border-slate-200 bg-white"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">
                              {courseIndex + 1}. {course?.title || courseId}
                            </p>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-slate-100"
                                onClick={() =>
                                  moveCourse(
                                    stageIndex,
                                    courseIndex,
                                    "up",
                                    mode,
                                  )
                                }
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-slate-100"
                                onClick={() =>
                                  moveCourse(
                                    stageIndex,
                                    courseIndex,
                                    "down",
                                    mode,
                                  )
                                }
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="md:col-span-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => addStage(mode)}
          >
            <Plus className="h-4 w-4" />
            Add Another Stage
          </Button>
        </div>
      </div>
    );
  };

  const renderCreateStageBuilder = () => (
    <div className="space-y-4 pt-2">
      {(() => {
        const liveFilteredCourses = filterCoursesByQuery(
          courses,
          createCourseSearch,
        );

        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-end gap-3 border-b border-slate-100 pb-5">
              <div className="flex-1">
                <Input
                  label="Draft Stage Name"
                  value={pathForm.draftStage.title}
                  onChange={(event) =>
                    updateStageTitle(
                      "create",
                      pathForm.stages.length,
                      event.target.value,
                    )
                  }
                  placeholder="e.g. Stage 1 - Foundations"
                  required
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => addStage("create")}
                className="h-[42px] bg-slate-800 text-white hover:bg-slate-900 shadow-sm"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Stage
              </Button>
            </div>

            <div className="pt-4">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Select Courses
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {createCourseSearch
                      ? `Filtered: ${liveFilteredCourses.length} of ${courses.length} courses`
                      : coursePagination
                        ? `Total Courses: ${coursePagination.totalRecords} | Page ${currentCoursePage} of ${coursePagination.totalPages}`
                        : `Showing ${courses.length} courses`}
                  </p>
                </div>
                <div className="w-full md:w-72">
                  <Input
                    id="create-course-search"
                    key="create-course-search"
                    placeholder="Search by course name or ID"
                    value={createCourseSearch}
                    onChange={(event) =>
                      setCreateCourseSearch(event.target.value)
                    }
                  />
                </div>
              </div>

              {!createCourseSearch && coursePagination && (
                <div className="mb-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCurrentCoursePage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={!coursePagination.hasPrevPage || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentCoursePage((prev) => prev + 1)}
                    disabled={!coursePagination.hasNextPage || loading}
                  >
                    Next
                  </Button>
                </div>
              )}

              <div className="max-h-[22rem] overflow-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-1">
                {loading ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-14 w-full rounded-md" />
                    <Skeleton className="h-14 w-full rounded-md" />
                    <Skeleton className="h-14 w-full rounded-md" />
                  </div>
                ) : liveFilteredCourses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <BookOpen className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-500">
                      No courses match "{createCourseSearch.trim()}"
                    </p>
                  </div>
                ) : (
                  liveFilteredCourses.map((course, courseIndex) => (
                    <label
                      key={getCourseRenderKey(
                        course,
                        courseIndex,
                        `create-${pathForm.draftStage.stageId}`,
                      )}
                      className={`flex cursor-pointer items-start gap-3 p-3 transition-colors border-l-4 ${
                        pathForm.draftStage.selectedCourseIds.includes(
                          course.id,
                        )
                          ? "border-l-primary-500 bg-primary-50/50"
                          : "border-l-transparent bg-white hover:bg-slate-100 hover:border-l-primary-300 shadow-sm"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                        checked={pathForm.draftStage.selectedCourseIds.includes(
                          course.id,
                        )}
                        onChange={() =>
                          toggleCourse(
                            pathForm.stages.length,
                            course.id,
                            "create",
                          )
                        }
                      />

                      <span className="text-sm">
                        <span className="block font-medium text-slate-900">
                          {course.title}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {course.code}
                        </span>
                        {course.description ? (
                          <span className="block text-xs text-slate-500">
                            {course.description}
                          </span>
                        ) : null}
                        {course.deliveryMode ? (
                          <span className="block text-xs text-slate-600">
                            {course.deliveryMode === "ONLINE"
                              ? `Online${course.videoUrl ? " | Video available" : ""}`
                              : `Physical${course.venue ? ` | ${course.venue}` : ""}`}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  const handleAssign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssignLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const response = await learningApi.createEnrollments(token, {
        learningPathId: assignForm.learningPathId,
        selectedLearners: learners.filter((learner) =>
          assignForm.selectedLearnerEmployeeNumbers.includes(
            learner.employeeNumber,
          ),
        ),
      });

      const assignedCount = (response.enrollments || []).length;
      const skipped = response.skipped || [];
      if (skipped.length > 0) {
        showToast(
          `${assignedCount} enrolled, ${skipped.length} skipped (already enrolled).`,
          "info",
        );
        console.info("Skipped enrollments:", skipped);
      } else {
        showToast("Enrollments assigned successfully.", "success");
      }
      setAssignForm(initialAssignForm);
      setLearners([]);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to assign enrollments.",
        "error",
      );
    } finally {
      setAssignLoading(false);
    }
  };

  useEffect(() => {
    // fetch existing enrollments for the selected learning path so we can prevent re-adding
    const fetchEnrolled = async () => {
      setAssignOptionsLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) {
          showToast("Session expired. Please login again.", "error");
          return;
        }
        if (!assignForm.learningPathId) {
          setEnrolledEmployeeNumbers(new Set());
          return;
        }

        const resp = await learningApi.getClassAssignmentOptions(
          token,
          assignForm.learningPathId,
        );
        const enrolled = new Set<string>();
        (resp.learners || []).forEach((l) => {
          if (l.employeeNumber) enrolled.add(String(l.employeeNumber));
        });
        setEnrolledEmployeeNumbers(enrolled);
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : "Failed to load enrolled learners.",
          "error",
        );
      } finally {
        setAssignOptionsLoading(false);
      }
    };

    fetchEnrolled();
  }, [assignForm.learningPathId, getAccessToken, showToast]);

  useEffect(() => {
    const employeeNo = assignEmployeeNoSearch.trim();
    const requestId = assignEmployeeNoValidationRequestId.current + 1;
    assignEmployeeNoValidationRequestId.current = requestId;

    if (
      section !== "assign" ||
      !employeeNo ||
      employeeNo.length < EMPLOYEE_NO_LENGTH
    ) {
      setAssignEmployeeNoChecking(false);
      return;
    }

    setAssignEmployeeNoChecking(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (
          !token ||
          assignEmployeeNoValidationRequestId.current !== requestId
        ) {
          return;
        }

        const response = await learningApi.searchAssignableEmployees(token, {
          employeeNo,
        });
        if (assignEmployeeNoValidationRequestId.current !== requestId) {
          return;
        }

        const hasExactEmployee = response.employees.some(
          (employee) =>
            String(employee.employeeNumber || "").trim() === employeeNo,
        );
        setAssignEmployeeNoError(
          hasExactEmployee ? "" : "Incorrect employee number.",
        );
      } catch {
        if (assignEmployeeNoValidationRequestId.current === requestId) {
          setAssignEmployeeNoError("Unable to validate employee number.");
        }
      } finally {
        if (assignEmployeeNoValidationRequestId.current === requestId) {
          setAssignEmployeeNoChecking(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [assignEmployeeNoSearch, getAccessToken, section]);

  useEffect(() => {
    const name = assignSurnameSearch.trim();
    const requestId = assignNameValidationRequestId.current + 1;
    assignNameValidationRequestId.current = requestId;

    if (section !== "assign" || !name) {
      setAssignNameChecking(false);
      return;
    }

    setAssignNameChecking(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (!token || assignNameValidationRequestId.current !== requestId) {
          return;
        }

        const response = await learningApi.searchAssignableEmployees(token, {
          surname: name,
        });
        if (assignNameValidationRequestId.current !== requestId) {
          return;
        }

        setAssignNameError(
          response.employees.length > 0 ? "" : "Incorrect employee name.",
        );
      } catch {
        if (assignNameValidationRequestId.current === requestId) {
          setAssignNameError("Unable to validate employee name.");
        }
      } finally {
        if (assignNameValidationRequestId.current === requestId) {
          setAssignNameChecking(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [assignSurnameSearch, getAccessToken, section]);

  const handleAssignReset = () => {
    setAssignEmployeeNoSearch("");
    setAssignEmployeeNoError("");
    setAssignSurnameSearch("");
    setAssignNameError("");
    setAssignDesignationFilter("");
    setAssignGradeFilter("");
    setAssignOrganizationFilter("");
    setAssignPayrollFilter("");
    setLearners([]);
  };

  const handleManageReset = () => {
    setQuery("");
    setCategoryFilter("");
    setStatusFilter("");
  };

  const handleAssignSearch = async () => {
    const employeeNo = assignEmployeeNoSearch.trim();
    const name = assignSurnameSearch.trim();
    if (employeeNo && employeeNo.length !== EMPLOYEE_NO_LENGTH) {
      setAssignEmployeeNoError(
        `Employee No must be ${EMPLOYEE_NO_LENGTH} digits.`,
      );
      setLearners([]);
      setAssignForm((prev) => ({
        ...prev,
        selectedLearnerEmployeeNumbers: [],
      }));
      return;
    }
    if (employeeNo && (assignEmployeeNoChecking || assignEmployeeNoError)) {
      return;
    }
    if (name && (assignNameChecking || assignNameError)) {
      return;
    }

    try {
      setAssignSearchLoading(true);
      setAssignEmployeeNoError("");
      setAssignNameError("");
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const response = await learningApi.searchAssignableEmployees(token, {
        employeeNo: assignEmployeeNoSearch,
        surname: assignSurnameSearch,
        designation: assignDesignationFilter,
        grade: assignGradeFilter,
        organizationName: assignOrganizationFilter,
        payrollType: assignPayrollFilter as "" | "EXECUTIVE" | "NON_EXECUTIVE",
      });

      setLearners(response.employees);
      setAssignForm((prev) => ({
        ...prev,
        selectedLearnerEmployeeNumbers: [],
      }));
      if (employeeNo && response.employees.length === 0) {
        setAssignEmployeeNoError("Incorrect employee number.");
      }
      if (name && response.employees.length === 0) {
        setAssignNameError("Incorrect employee name.");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to search ERP employees.",
        "error",
      );
    } finally {
      setAssignSearchLoading(false);
    }
  };

  const selectAllFilteredLearners = () => {
    const filteredIds = learners.map((learner) => learner.employeeNumber);
    setAssignForm((prev) => {
      const next = new Set(prev.selectedLearnerEmployeeNumbers);
      filteredIds.forEach((id) => next.add(id));
      return { ...prev, selectedLearnerEmployeeNumbers: Array.from(next) };
    });
  };

  const clearFilteredLearners = () => {
    const filteredIdSet = new Set(
      learners.map((learner) => learner.employeeNumber),
    );
    setAssignForm((prev) => ({
      ...prev,
      selectedLearnerEmployeeNumbers:
        prev.selectedLearnerEmployeeNumbers.filter(
          (id) => !filteredIdSet.has(id),
        ),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Subtle Background Pattern/Gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-50 to-white/50" />

        <div className="relative flex flex-col gap-4 px-5 py-6 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
              Learning Administration
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {sectionMeta[section].title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {sectionMeta[section].description}
            </p>
          </div>

          <div className="flex w-full flex-col gap-1 rounded-xl border border-primary-100 bg-primary-50/50 px-5 py-4 sm:w-auto sm:min-w-[280px]">
            <div className="flex items-center gap-2 text-sm font-bold text-primary-950">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <BookOpen className="h-3.5 w-3.5" />
              </div>
              Learning Paths
            </div>
            <p className="mt-1 text-xs font-medium text-primary-700">
              {loading
                ? "Loading paths..."
                : `${paths.length} active learning paths managed`}
            </p>
          </div>
        </div>
      </div>

      {section === "create" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-9">
          <Card
            title={
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <span>Create Learning Path</span>
              </div>
            }
            className="shadow-sm border-slate-200 xl:col-span-5"
          >
            <form className="space-y-6" onSubmit={handleCreatePath}>
              <div className="grid grid-cols-1 items-start gap-5 rounded-xl border border-slate-100 bg-slate-50 p-5 md:grid-cols-2">
                <Input
                  label="Title"
                  value={pathForm.title}
                  error={pathTitleError ?? undefined}
                  onChange={(event) => {
                    const sanitized = normalizeTitleInputSpacing(
                      event.target.value.replace(/[^A-Za-z\s]/g, ""),
                    );
                    setPathForm((prev) => ({ ...prev, title: sanitized }));
                    setPathTitleError(null);
                  }}
                  maxLength={50}
                  helperText={`${pathForm.title.length}/50 characters entered, ${50 - pathForm.title.length} remaining`}
                  required
                />
                {pathDuplicateWarning ? (
                  <div className="col-span-2 mt-1 text-sm text-amber-700">
                    <p className="font-medium">
                      {pathDuplicateWarning.message}
                    </p>
                    <ul className="list-inside list-disc">
                      {pathDuplicateWarning.existing.map((e) => (
                        <li key={e.id || e.title || "duplicate-path"}>
                          {e.title}{" "}
                          {e.overlappingCourses &&
                          e.overlappingCourses.length > 0
                            ? `- overlapping courses: ${e.overlappingCourses.map((c) => c.title || c.code).join(", ")}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Select
                  label="Category"
                  value={pathForm.category}
                  onChange={(event) =>
                    setPathForm((prev) => ({
                      ...prev,
                      category: event.target.value as Category,
                    }))
                  }
                  options={[
                    { value: "PUBLIC", label: "Public" },
                    { value: "RESTRICTED", label: "Restricted" },
                  ]}
                />
                {pathDuplicateWarning ? (
                  <div className="mt-1 text-sm text-amber-700 md:col-span-2">
                    <p className="font-medium">
                      {pathDuplicateWarning.message}
                    </p>
                    <ul className="list-inside list-disc">
                      {pathDuplicateWarning.existing.map((e) => (
                        <li key={e.id ?? String(e.title)}>
                          {e.title}{" "}
                          {e.overlappingCourses &&
                          e.overlappingCourses.length > 0
                            ? `— overlapping courses: ${e.overlappingCourses.map((c) => c.title || c.code).join(", ")}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Input
                  label="Description"
                  value={pathForm.description}
                  onChange={(event) =>
                    setPathForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              {renderCreateStageBuilder()}

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  isLoading={pathFormLoading}
                  className="bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-all hover:-translate-y-0.5"
                >
                  Create Path
                </Button>
              </div>
            </form>
          </Card>

          <Card
            title="Learning Path Preview"
            className="xl:col-span-4 shadow-sm border-slate-200 self-start sticky top-6"
            bodyClassName="p-0 overflow-hidden"
          >
            <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
              {/* Preview Header */}
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5">
                <p className="text-lg font-black text-slate-900 tracking-tight">
                  {pathForm.title.trim() || "Untitled Learning Path"}
                </p>
                <p className="mt-1.5 text-sm text-slate-600">
                  {pathForm.description.trim() ||
                    "Add a description to preview details."}
                </p>
                <div className="mt-3 inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700 ring-1 ring-inset ring-primary-600/20">
                  {pathForm.category.replace("_", " ")}
                </div>
              </div>

              {/* Stages List */}
              <div className="overflow-y-auto p-5 bg-slate-50/30 flex-1">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Stages & Course Order
                </p>
                <div className="space-y-4">
                  {pathForm.stages.length === 0 &&
                  pathForm.draftStage.selectedCourseIds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
                        <BookOpen className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-900 mb-1">
                        No stages added yet
                      </p>
                      <p className="text-xs text-slate-500 max-w-[200px]">
                        Select courses on the left and click "Add Stage" to
                        build your path.
                      </p>
                    </div>
                  ) : (
                    [...pathForm.stages, pathForm.draftStage].map(
                      (stage, stageIndex) => {
                        const isDraftStage =
                          stageIndex === pathForm.stages.length;
                        if (
                          isDraftStage &&
                          stage.selectedCourseIds.length === 0
                        ) {
                          return null;
                        }

                        return (
                          <div
                            key={`preview-${stage.stageId}`}
                            className={`overflow-hidden rounded-xl border shadow-sm ${
                              isDraftStage
                                ? "border-blue-200 bg-blue-50/30 ring-1 ring-blue-100"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div
                              className={`flex items-center justify-between border-b px-4 py-3 ${isDraftStage ? "border-blue-100 bg-blue-50/50" : "border-slate-100 bg-slate-50/80"}`}
                            >
                              <p className="font-bold text-slate-900">
                                {isDraftStage
                                  ? `Current Stage: ${stage.title || `Stage ${stageIndex + 1}`}`
                                  : `Stage ${stageIndex + 1}: ${stage.title || `Stage ${stageIndex + 1}`}`}
                              </p>
                              {isDraftStage ? (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                  Draft
                                </span>
                              ) : null}
                            </div>

                            <div className="p-2 space-y-1">
                              {stage.selectedCourseIds.length === 0 ? (
                                <p className="px-3 py-4 text-center text-xs text-slate-500">
                                  No courses selected.
                                </p>
                              ) : (
                                stage.selectedCourseIds.map(
                                  (courseId, courseIndex) => {
                                    const course = courses.find(
                                      (item) => item.id === courseId,
                                    );
                                    return (
                                      <div
                                        key={`preview-${stage.stageId}-${courseId}`}
                                        className="group flex items-center justify-between gap-3  border border-slate-100 bg-white p-3 text-sm transition-all hover:border-slate-200 hover:shadow-sm border-l-4 border-l-transparent hover:border-l-primary-400"
                                      >
                                        <div>
                                          <p className="font-bold text-slate-800">
                                            {courseIndex + 1}.{" "}
                                            {course?.title || courseId}
                                          </p>
                                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                                            {course?.code || courseId}
                                          </p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                          <button
                                            type="button"
                                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                            onClick={() =>
                                              moveCourse(
                                                stageIndex,
                                                courseIndex,
                                                "up",
                                                "create",
                                              )
                                            }
                                          >
                                            <ArrowUp className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                            onClick={() =>
                                              moveCourse(
                                                stageIndex,
                                                courseIndex,
                                                "down",
                                                "create",
                                              )
                                            }
                                          >
                                            <ArrowDown className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  },
                                )
                              )}
                            </div>
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {section === "assign" ? (
        <Card title="Assign Learning Path to Learners">
          <form className="space-y-3" onSubmit={handleAssign}>
            <div className="rounded-lg bg-gradient-to-r from-primary-50 to-blue-50/30 p-4 border border-primary-100 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary-800">
                <BookOpen size={18} className="text-primary-600" />
                <span className="text-sm font-semibold">
                  Select Learning Path to Assign
                </span>
              </div>
              <Select
                value={assignForm.learningPathId}
                onChange={(event) =>
                  setAssignForm((prev) => ({
                    ...prev,
                    learningPathId: event.target.value,
                  }))
                }
                options={[
                  { value: "", label: "Choose a learning path..." },
                  ...paths.map((path) => ({
                    value: path.id,
                    label: `${path.title} (${path.status})`,
                  })),
                ]}
                required
              />
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={16} className="text-slate-500" />
                <p className="text-sm font-medium text-slate-700">
                  Filter & Select Learners
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg bg-slate-50 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4 border-b border-slate-100 bg-white">
                  <Input
                    label="Search by Employee No"
                    value={assignEmployeeNoSearch}
                    onFocus={activateAssignEmployeeSearch}
                    onChange={(event) =>
                      handleAssignEmployeeNoChange(event.target.value)
                    }
                    placeholder={assignEmployeeNoPlaceholder}
                    error={assignEmployeeNoError}
                  />
                  <Input
                    label="Search by Name"
                    value={assignSurnameSearch}
                    onFocus={activateAssignNameSearch}
                    onChange={(event) =>
                      handleAssignNameSearchChange(event.target.value)
                    }
                    placeholder={assignNamePlaceholder}
                    error={assignNameError}
                  />
                  <Select
                    label="Filter by Designation"
                    value={assignDesignationFilter}
                    onFocus={activateAssignFilterSearch}
                    onChange={(event) =>
                      handleAssignDesignationChange(event.target.value)
                    }
                    options={[
                      { value: "", label: "All Designations" },
                      ...designationOptions.map((option) => ({
                        value: option,
                        label: option,
                      })),
                    ]}
                    isLoading={assignOptionsLoading}
                  />
                  <Select
                    label="Filter by Grade"
                    value={assignGradeFilter}
                    onFocus={activateAssignFilterSearch}
                    onChange={(event) =>
                      handleAssignGradeChange(event.target.value)
                    }
                    options={[
                      { value: "", label: "All Grades" },
                      ...gradeOptions.map((option) => ({
                        value: option,
                        label: option,
                      })),
                    ]}
                    isLoading={assignOptionsLoading}
                  />
                  <Select
                    label="Filter by Organization"
                    value={assignOrganizationFilter}
                    onFocus={activateAssignFilterSearch}
                    onChange={(event) =>
                      handleAssignOrganizationChange(event.target.value)
                    }
                    options={[
                      { value: "", label: "All Organizations" },
                      ...organizationOptions.map((option) => ({
                        value: option.organizationName,
                        label: option.parentOrganizationName
                          ? `${option.organizationName} (${option.parentOrganizationName})`
                          : option.organizationName,
                      })),
                    ]}
                    isLoading={assignOptionsLoading}
                  />
                  <Select
                    label="Executive / Non Executive"
                    value={assignPayrollFilter}
                    onFocus={activateAssignFilterSearch}
                    onChange={(event) =>
                      handleAssignPayrollChange(event.target.value)
                    }
                    options={[
                      { value: "", label: "All Payrolls" },
                      { value: "EXECUTIVE", label: "Executive" },
                      { value: "NON_EXECUTIVE", label: "Non Executive" },
                    ]}
                    isLoading={assignOptionsLoading}
                  />
                </div>

                <div className="flex justify-end gap-3 px-4 py-3 bg-slate-50">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAssignReset}
                    disabled={
                      !assignEmployeeNoSearch &&
                      !assignSurnameSearch &&
                      !assignDesignationFilter &&
                      !assignGradeFilter &&
                      !assignOrganizationFilter &&
                      !assignPayrollFilter &&
                      learners.length === 0
                    }
                  >
                    <RotateCcw size={16} />
                    Reset
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAssignSearch}
                    isLoading={assignSearchLoading}
                    disabled={isAssignLearnerSearchDisabled}
                  >
                    <Search size={16} />
                    Search
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600">
                      ERP results:{" "}
                      <span className="text-slate-900">{learners.length}</span>
                    </span>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <span
                      className={`text-sm font-medium px-2.5 py-0.5 rounded-full transition-colors ${
                        assignForm.selectedLearnerEmployeeNumbers.length > 0
                          ? "bg-primary-100 text-primary-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      Selected:{" "}
                      {assignForm.selectedLearnerEmployeeNumbers.length}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={selectAllFilteredLearners}
                      disabled={learners.length === 0}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearFilteredLearners}
                      disabled={learners.length === 0}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                <div className="max-h-[26rem] overflow-y-auto relative bg-white rounded-b-lg">
                  {learners.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 border border-slate-100">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-1">
                        No learners loaded
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Use the control panel above to search the ERP and select
                        learners to enroll.
                      </p>
                    </div>
                  ) : (
                    <div className="min-w-[980px]">
                      <div className="sticky top-0 z-10 grid grid-cols-[44px_1.4fr_0.9fr_1.1fr_0.9fr_1.3fr_1.4fr] gap-3 border-b border-slate-200 bg-slate-50/95 backdrop-blur px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
                        <span>Select</span>
                        <span>Name</span>
                        <span>Emp No</span>
                        <span>Designation</span>
                        <span>Grade</span>
                        <span>Organization</span>
                        <span>Email</span>
                      </div>

                      {learners.map((learner) => {
                        const empNo = String(learner.employeeNumber || "");
                        const already = enrolledEmployeeNumbers.has(empNo);
                        const isSelected =
                          assignForm.selectedLearnerEmployeeNumbers.includes(
                            empNo,
                          );

                        let rowClassName =
                          "grid grid-cols-[44px_1.4fr_0.9fr_1.1fr_0.9fr_1.3fr_1.4fr] items-center gap-3 border-b px-3 py-3 text-sm transition-all duration-200 ";

                        if (already) {
                          rowClassName +=
                            "border-slate-100 bg-slate-50/50 opacity-75 cursor-not-allowed text-slate-500 border-l-4 border-l-transparent";
                        } else if (isSelected) {
                          rowClassName +=
                            "border-primary-100 bg-primary-50 text-primary-900 border-l-4 border-l-primary-500 cursor-pointer";
                        } else {
                          rowClassName +=
                            "border-slate-100 text-slate-600 hover:bg-slate-50 hover:shadow-sm border-l-4 border-l-transparent cursor-pointer";
                        }

                        return (
                          <label
                            key={
                              empNo || Math.random().toString(36).slice(2, 8)
                            }
                            className={rowClassName}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLearnerSelection(empNo)}
                              className={`shrink-0 ${already ? "cursor-not-allowed" : "cursor-pointer"}`}
                              disabled={already}
                            />
                            <div>
                              <div
                                className={`font-medium ${isSelected ? "text-primary-900" : already ? "text-slate-500" : "text-slate-900"}`}
                              >
                                {learner.employeeName}
                              </div>
                              {already ? (
                                <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5 font-medium">
                                  <CheckCircle size={12} />
                                  <span>Already enrolled</span>
                                </div>
                              ) : null}
                            </div>
                            <span>{empNo}</span>
                            <span>{learner.designation || "-"}</span>
                            <span>{learner.gradeName || "-"}</span>
                            <span>{learner.organizationName || "-"}</span>
                            <span className="break-all">
                              {learner.email || "-"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={assignLoading}
              disabled={
                !assignForm.learningPathId ||
                assignForm.selectedLearnerEmployeeNumbers.length === 0
              }
              className="mt-4 w-full md:w-auto md:min-w-[220px] group transition-all shadow-sm hover:shadow"
            >
              <UserPlus
                size={18}
                className="group-hover:scale-110 transition-transform duration-200"
              />
              <span>
                Assign{" "}
                {assignForm.selectedLearnerEmployeeNumbers.length > 0
                  ? assignForm.selectedLearnerEmployeeNumbers.length
                  : ""}{" "}
                Enrollments
              </span>
            </Button>
          </form>
        </Card>
      ) : null}

      {section === "manage" ? (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search paths..."
                  className="pl-10"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center">
                <Select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value as Category | "")
                  }
                  options={[
                    { value: "", label: "All Categories" },
                    { value: "PUBLIC", label: "Public" },
                    { value: "RESTRICTED", label: "Restricted" },
                  ]}
                  className="min-w-[180px]"
                />
                <Select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as PathStatus | "")
                  }
                  options={[
                    { value: "", label: "All Statuses" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "DRAFT", label: "Draft" },
                    { value: "ARCHIVED", label: "Archived" },
                  ]}
                  className="min-w-[180px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleManageReset}
                  disabled={!query && !categoryFilter && !statusFilter}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">Path Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td className="px-6 py-4 text-slate-500" colSpan={4}>
                      Loading learning paths...
                    </td>
                  </tr>
                ) : filteredPaths.length === 0 ? (
                  <tr>
                    <td className="px-6 py-4 text-slate-500" colSpan={4}>
                      No learning paths found.
                    </td>
                  </tr>
                ) : (
                  paginatedPaths.data.map((path) => (
                    <tr
                      key={path.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {path.title}
                        </div>
                        <div className="text-slate-500 text-xs truncate max-w-xs">
                          {path.description}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            path.category === "RESTRICTED"
                              ? "danger"
                              : "success"
                          }
                        >
                          <span className="flex items-center gap-1.5">
                            {path.category === "RESTRICTED" ? (
                              <Lock className="h-3 w-3 text-black" />
                            ) : (
                              <Globe className="h-3 w-3 text-blue-500" />
                            )}
                            {path.category.replace("_", " ")}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            path.status === "ACTIVE"
                              ? "success"
                              : path.status === "DRAFT"
                                ? "warning"
                                : "default"
                          }
                        >
                          {path.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 w-[1%]">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                            onClick={() => startEdit(path)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                            onClick={() => setPendingDeletePath(path)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-600">
              <span className="font-medium">
                {paginatedPaths.totalRecords === 0
                  ? "No learning paths"
                  : `${(paginatedPaths.currentPage - 1) * paginatedPaths.pageSize + 1}–${Math.min(paginatedPaths.currentPage * paginatedPaths.pageSize, paginatedPaths.totalRecords)} of ${paginatedPaths.totalRecords}`}
              </span>
              {" | Page "}
              <span className="font-medium">{paginatedPaths.currentPage}</span>
              {" of "}
              <span className="font-medium">{paginatedPaths.totalPages}</span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setCurrentPathPage((prev) => Math.max(1, prev - 1))
                }
                disabled={!paginatedPaths.hasPrevPage || loading}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCurrentPathPage((prev) => prev + 1)}
                disabled={!paginatedPaths.hasNextPage || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {section === "manage" && pendingDeletePath ? (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Delete Learning Path
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                This action will permanently remove the learning path and
                related records.
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-900">
                  {pendingDeletePath.title}
                </span>
                ?
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingDeletePath(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => handleDeletePath(pendingDeletePath.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {section === "manage" && editPathId ? (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-7 py-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Edit Learning Path
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditPathId(null)}
              >
                Close
              </Button>
            </div>
            <div className="p-7">
              <form className="space-y-4" onSubmit={handleUpdatePath}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Title"
                    value={editForm.title}
                    error={editTitleError ?? undefined}
                    onChange={(event) => {
                      const sanitized = normalizeTitleInputSpacing(
                        event.target.value.replace(/[^A-Za-z\s]/g, ""),
                      );
                      setEditForm((prev) => ({ ...prev, title: sanitized }));
                      setEditTitleError(null);
                    }}
                    maxLength={50}
                    helperText={`${editForm.title.length}/50 characters entered, ${50 - editForm.title.length} remaining`}
                    required
                  />
                  <Select
                    label="Category"
                    value={editForm.category}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        category: event.target.value as Category,
                      }))
                    }
                    options={[
                      { value: "PUBLIC", label: "Public" },
                      { value: "RESTRICTED", label: "Restricted" },
                    ]}
                  />
                  <Select
                    label="Status"
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: event.target.value as PathStatus,
                      }))
                    }
                    options={[
                      { value: "ACTIVE", label: "Active" },
                      { value: "DRAFT", label: "Draft" },
                      { value: "ARCHIVED", label: "Archived" },
                    ]}
                  />
                  <Input
                    label="Description"
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                {renderCourseSelector(editForm.stages, "edit")}

                <div className="flex gap-2">
                  <Button type="submit" isLoading={editLoading}>
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditPathId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
