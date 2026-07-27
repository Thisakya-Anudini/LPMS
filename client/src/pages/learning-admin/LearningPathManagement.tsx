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
        courseApi.getAllCourses(token),
      ]);

      setPaths(pathsResponse.learningPaths as LearningPathRow[]);
      setCourses(coursesResponse.courses);

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
  }, [getAccessToken, section, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
                {mode === "edit" ? (
                  <p className="mb-2 text-xs text-slate-500">
                    Showing {visibleCourses.length} of {courses.length} courses
                  </p>
                ) : null}
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
    <div className="space-y-4">
      {(() => {
        const liveFilteredCourses = filterCoursesByQuery(
          courses,
          createCourseSearch,
        );

        return (
          <div className="border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex items-end gap-2">
              <Input
                label="Stage Name"
                value={pathForm.draftStage.title}
                onChange={(event) =>
                  updateStageTitle(
                    "create",
                    pathForm.stages.length,
                    event.target.value,
                  )
                }
                required
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => addStage("create")}
                className="h-11"
              >
                <Plus className="h-5 w-5" />
                Add Stage
              </Button>
            </div>

            <div>
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Select Courses
                </p>
                <div className="w-full md:w-80">
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
              <p className="text-xs text-slate-500">
                Showing {liveFilteredCourses.length} of {courses.length} courses
              </p>
              <div className="max-h-[30rem] overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : liveFilteredCourses.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">
                    No courses match "{createCourseSearch.trim()}".
                  </p>
                ) : (
                  liveFilteredCourses.map((course, courseIndex) => (
                    <label
                      key={getCourseRenderKey(
                        course,
                        courseIndex,
                        `create-${pathForm.draftStage.stageId}`,
                      )}
                      className="flex items-start gap-3 p-2 rounded hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {sectionMeta[section].title}
        </h1>
        <p className="text-slate-500">{sectionMeta[section].description}</p>
      </div>

      {section === "create" ? (
        <div className="grid grid-cols-1 xl:grid-cols-9 gap-6">
          <Card title="Create Learning Path" className="xl:col-span-5">
            <form className="space-y-4" onSubmit={handleCreatePath}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
                    <ul className="list-disc list-inside">
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
                  <div className="md:col-span-2 mt-1 text-sm text-amber-700">
                    <p className="font-medium">
                      {pathDuplicateWarning.message}
                    </p>
                    <ul className="list-disc list-inside">
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

              <Button type="submit" isLoading={pathFormLoading}>
                Create Path
              </Button>
            </form>
          </Card>

          <Card title="Learning Path Preview" className="xl:col-span-4">
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <p className="font-semibold text-slate-900">
                  {pathForm.title.trim() || "Untitled Learning Path"}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {pathForm.description.trim() ||
                    "Add a description to preview details."}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {pathForm.category.replace("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">
                  Stages & Courses
                </p>
                <div className="space-y-2">
                  {pathForm.stages.length === 0 &&
                  pathForm.draftStage.selectedCourseIds.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No stages added yet.
                    </p>
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
                            className="p-3 rounded border border-slate-200 bg-white text-sm text-slate-800"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">
                                {isDraftStage
                                  ? `Current Stage: ${stage.title || `Stage ${stageIndex + 1}`}`
                                  : `Stage ${stageIndex + 1}: ${stage.title || `Stage ${stageIndex + 1}`}`}
                              </p>
                              {isDraftStage ? (
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-700">
                                  Draft
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 space-y-2">
                              {stage.selectedCourseIds.length === 0 ? (
                                <p className="text-xs text-slate-500">
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
                                        className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-2"
                                      >
                                        <div>
                                          <p className="text-slate-800">
                                            {courseIndex + 1}.{" "}
                                            {course?.title || courseId}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {course?.code || courseId}
                                          </p>
                                        </div>
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            className="rounded p-1 hover:bg-slate-200"
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
                                            className="rounded p-1 hover:bg-slate-200"
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
            <Select
              label="Learning Path"
              value={assignForm.learningPathId}
              onChange={(event) =>
                setAssignForm((prev) => ({
                  ...prev,
                  learningPathId: event.target.value,
                }))
              }
              options={[
                { value: "", label: "Select a path" },
                ...paths.map((path) => ({
                  value: path.id,
                  label: `${path.title} (${path.status})`,
                })),
              ]}
              required
            />

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Select Learners
              </p>
              <div className="border border-slate-200 rounded-md bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 border-b border-slate-200">
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

                <div className="flex justify-end gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50/70">
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
                    Reset
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAssignSearch}
                    isLoading={assignSearchLoading}
                    disabled={isAssignLearnerSearchDisabled}
                  >
                    Search
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200">
                  <p className="text-xs text-slate-500">
                    ERP results: {learners.length} | Selected:{" "}
                    {assignForm.selectedLearnerEmployeeNumbers.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={selectAllFilteredLearners}
                      disabled={learners.length === 0}
                    >
                      Select All Results
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearFilteredLearners}
                      disabled={learners.length === 0}
                    >
                      Clear Results
                    </Button>
                  </div>
                </div>

                <div className="max-h-[26rem] overflow-y-auto">
                  {learners.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">
                      Search ERP to load learners.
                    </p>
                  ) : (
                    <div className="min-w-[980px]">
                      <div className="grid grid-cols-[44px_1.4fr_0.9fr_1.1fr_0.9fr_1.3fr_1.4fr] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                        return (
                          <label
                            key={
                              empNo || Math.random().toString(36).slice(2, 8)
                            }
                            className="grid grid-cols-[44px_1.4fr_0.9fr_1.1fr_0.9fr_1.3fr_1.4fr] items-center gap-3 border-b border-slate-100 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={assignForm.selectedLearnerEmployeeNumbers.includes(
                                empNo,
                              )}
                              onChange={() => toggleLearnerSelection(empNo)}
                              className="shrink-0"
                              disabled={already}
                            />
                            <div>
                              <div className="font-medium text-slate-900">
                                {learner.employeeName}
                              </div>
                              {already ? (
                                <div className="text-xs text-amber-700">
                                  Already enrolled
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
            >
              Assign Enrollments
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
              <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
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
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
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
                  filteredPaths.map((path) => (
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
