import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Search, Trash2 } from 'lucide-react';
import { courseApi, learningApi } from '../../api/lpmsApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type Category = 'RESTRICTED' | 'SEMI_RESTRICTED' | 'PUBLIC';
type PathStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

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
  deliveryMode: 'ONLINE' | 'PHYSICAL' | null;
  venue: string | null;
  videoUrl: string | null;
};

type StageForm = {
  stageId: string;
  title: string;
  selectedCourseIds: string[];
};

const createStageForm = (index: number): StageForm => ({
  stageId: `stage-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  title: `Stage ${index + 1}`,
  selectedCourseIds: []
});

const normalizeSearchText = (value: string | null | undefined) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getCourseRenderKey = (course: CourseItem, index: number, scope: string) =>
  `${scope}-${course.id || 'no-id'}-${course.code || 'no-code'}-${course.title || 'no-title'}-${index}`;

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
      normalizeSearchText(course.description)
    ]
      .filter(Boolean)
      .join(' ');

    return queryTokens.every((token) => searchHaystack.includes(token));
  });
};

const initialPathForm = {
  title: '',
  description: '',
  category: 'PUBLIC' as Category,
  totalDuration: '',
  stages: [] as StageForm[],
  draftStage: createStageForm(0) as StageForm
};

const initialAssignForm = {
  learningPathId: '',
  selectedLearnerEmployeeNumbers: [] as string[]
};

type LearningPathManagementSection = 'create' | 'assign' | 'manage';

const sectionMeta: Record<LearningPathManagementSection, { title: string; description: string }> = {
  create: {
    title: 'Create Learning Path',
    description: 'Create new learning paths and define course order.'
  },
  assign: {
    title: 'Assign Enrollments',
    description: 'Assign learning paths to learners.'
  },
  manage: {
    title: 'Manage Learning Paths',
    description: 'Search, edit, and delete existing learning paths.'
  }
};

export function LearningPathManagement({ section }: { section: LearningPathManagementSection }) {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();

  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [learners, setLearners] = useState<AssignableLearner[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [pathForm, setPathForm] = useState(initialPathForm);
  const [pathFormLoading, setPathFormLoading] = useState(false);
  const [createCourseSearch, setCreateCourseSearch] = useState('');

  const [editPathId, setEditPathId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'PUBLIC' as Category,
    totalDuration: '',
    status: 'ACTIVE' as PathStatus,
    stages: [] as StageForm[]
  });
  const [editLoading, setEditLoading] = useState(false);

  const [assignForm, setAssignForm] = useState(initialAssignForm);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSearchLoading, setAssignSearchLoading] = useState(false);
  const [assignEmployeeNoSearch, setAssignEmployeeNoSearch] = useState('');
  const [assignSurnameSearch, setAssignSurnameSearch] = useState('');
  const [assignDesignationFilter, setAssignDesignationFilter] = useState('');
  const [assignGradeFilter, setAssignGradeFilter] = useState('');
  const [assignOrganizationFilter, setAssignOrganizationFilter] = useState('');
  const [assignPayrollFilter, setAssignPayrollFilter] = useState('');
  const [designationOptions, setDesignationOptions] = useState<string[]>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([]);
  const [organizationOptions, setOrganizationOptions] = useState<
    Array<{ organizationId: string; organizationName: string; parentOrganizationName: string }>
  >([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const [pathsResponse, coursesResponse] = await Promise.all([
        learningApi.getLearningPaths(token),
        courseApi.getAllCourses(token)
      ]);

      setPaths(pathsResponse.learningPaths as LearningPathRow[]);
      setCourses(coursesResponse.courses);

      if (section === 'assign') {
        const optionsResponse = await learningApi.getAssignableEmployeeSearchOptions(token);
        setDesignationOptions(optionsResponse.designations);
        setGradeOptions(optionsResponse.grades);
        setOrganizationOptions(
          optionsResponse.organizations.map((organization) => ({
            organizationId: organization.organizationId,
            organizationName: organization.organizationName,
            parentOrganizationName: organization.parentOrganizationName
          }))
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, section, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPaths = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return paths;
    }
    return paths.filter(
      (path) =>
        path.title.toLowerCase().includes(normalized) ||
        path.description.toLowerCase().includes(normalized)
    );
  }, [paths, query]);

  const toStages = (stages: StageForm[]) =>
    stages
      .filter((stage) => stage.selectedCourseIds.length > 0)
      .map((stage, stageIndex) => ({
        title: stage.title,
        order: stageIndex + 1,
        courses: stage.selectedCourseIds.map((courseId, courseIndex) => ({
          courseId,
          order: courseIndex + 1
        }))
      }));

  const getCreateStagesPayload = () => {
    const combined = [...pathForm.stages];
    if (pathForm.draftStage.selectedCourseIds.length > 0) {
      combined.push(pathForm.draftStage);
    }
    return toStages(combined);
  };

  const handleCreatePath = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPathFormLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      await learningApi.createLearningPath(token, {
        title: pathForm.title,
        description: pathForm.description,
        category: pathForm.category,
        totalDuration: pathForm.totalDuration,
        stages: getCreateStagesPayload()
      });
      setPathForm(initialPathForm);
      showToast('Learning path created successfully.', 'success');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create learning path.', 'error');
    } finally {
      setPathFormLoading(false);
    }
  };

  const startEdit = async (path: LearningPathRow) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const detailResponse = await learningApi.getLearningPathById(token, path.id);
      const stagesFromApi = detailResponse.learningPath.stages || [];

      const mappedStages: StageForm[] = stagesFromApi
        .sort((a, b) => a.stage_order - b.stage_order)
        .map((stage, stageIndex) => ({
          stageId: stage.id || createStageForm(stageIndex).stageId,
          title: stage.title,
          selectedCourseIds: (stage.courses || [])
            .sort((a, b) => a.course_order - b.course_order)
            .map((course) => courses.find((catalogCourse) => catalogCourse.title === course.title)?.id)
            .filter((value): value is string => Boolean(value))
        }));

      setEditPathId(path.id);
      setEditForm({
        title: path.title,
        description: path.description,
        category: path.category,
        totalDuration: path.total_duration,
        status: path.status,
        stages: mappedStages.length > 0 ? mappedStages : [createStageForm(0)]
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learning path details.', 'error');
    }
  };

  const handleUpdatePath = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editPathId) {
      return;
    }
    setEditLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      await learningApi.updateLearningPath(token, editPathId, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        totalDuration: editForm.totalDuration,
        status: editForm.status,
        stages: toStages(editForm.stages)
      });
      showToast('Learning path updated successfully.', 'success');
      setEditPathId(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update learning path.', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePath = async (id: string) => {
    const confirmed = window.confirm('Delete this learning path?');
    if (!confirmed) {
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      await learningApi.deleteLearningPath(token, id);
      showToast('Learning path deleted successfully.', 'success');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete learning path.', 'error');
    }
  };

  const toggleLearnerSelection = (employeeNumber: string) => {
    setAssignForm((prev) => {
      const exists = prev.selectedLearnerEmployeeNumbers.includes(employeeNumber);
      return {
        ...prev,
        selectedLearnerEmployeeNumbers: exists
          ? prev.selectedLearnerEmployeeNumbers.filter((value) => value !== employeeNumber)
          : [...prev.selectedLearnerEmployeeNumbers, employeeNumber]
      };
    });
  };

  const updateStageCourses = (
    mode: 'create' | 'edit',
    stageIndex: number,
    updater: (selectedCourseIds: string[]) => string[]
  ) => {
    if (mode === 'create') {
      setPathForm((prev) => ({
        ...prev,
        stages:
          stageIndex < prev.stages.length
            ? prev.stages.map((stage, index) =>
              index === stageIndex
                ? { ...stage, selectedCourseIds: updater(stage.selectedCourseIds) }
                : stage
            )
            : prev.stages,
        draftStage:
          stageIndex < prev.stages.length
            ? prev.draftStage
            : {
              ...prev.draftStage,
              selectedCourseIds: updater(prev.draftStage.selectedCourseIds)
            }
      }));
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, index) =>
        index === stageIndex ? { ...stage, selectedCourseIds: updater(stage.selectedCourseIds) } : stage
      )
    }));
  };

  const toggleCourse = (stageIndex: number, courseId: string, mode: 'create' | 'edit') => {
    updateStageCourses(mode, stageIndex, (selectedCourseIds) =>
      selectedCourseIds.includes(courseId)
        ? selectedCourseIds.filter((id) => id !== courseId)
        : [...selectedCourseIds, courseId]
    );
  };

  const moveCourse = (
    stageIndex: number,
    index: number,
    direction: 'up' | 'down',
    mode: 'create' | 'edit'
  ) => {
    const selectedCourseIds =
      mode === 'create'
        ? (stageIndex < pathForm.stages.length
          ? pathForm.stages[stageIndex]?.selectedCourseIds
          : pathForm.draftStage.selectedCourseIds) || []
        : editForm.stages[stageIndex]?.selectedCourseIds || [];
    const next = [...selectedCourseIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) {
      return;
    }
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    updateStageCourses(mode, stageIndex, () => next);
  };

  const updateStageTitle = (mode: 'create' | 'edit', stageIndex: number, title: string) => {
    if (mode === 'create') {
      setPathForm((prev) => ({
        ...prev,
        stages:
          stageIndex < prev.stages.length
            ? prev.stages.map((stage, index) => (index === stageIndex ? { ...stage, title } : stage))
            : prev.stages,
        draftStage:
          stageIndex < prev.stages.length ? prev.draftStage : { ...prev.draftStage, title }
      }));
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, index) => (index === stageIndex ? { ...stage, title } : stage))
    }));
  };

  const addStage = (mode: 'create' | 'edit') => {
    if (mode === 'create') {
      setPathForm((prev) => {
        if (prev.draftStage.selectedCourseIds.length === 0) {
          showToast('Select at least one course before adding a stage.', 'error');
          return prev;
        }
        const nextStages = [...prev.stages, prev.draftStage];
        return {
          ...prev,
          stages: nextStages,
          draftStage: createStageForm(nextStages.length)
        };
      });
      return;
    }
    setEditForm((prev) => ({ ...prev, stages: [...prev.stages, createStageForm(prev.stages.length)] }));
  };

  const removeStage = (mode: 'create' | 'edit', stageIndex: number) => {
    if (mode === 'create') {
      setPathForm((prev) => {
        if (stageIndex < prev.stages.length) {
          const nextStages = prev.stages.filter((_, index) => index !== stageIndex);
          return {
            ...prev,
            stages: nextStages
          };
        }
        return {
          ...prev,
          draftStage: createStageForm(prev.stages.length)
        };
      });
      return;
    }
    setEditForm((prev) => {
      const next = prev.stages.filter((_, index) => index !== stageIndex);
      return { ...prev, stages: next.length > 0 ? next : [createStageForm(0)] };
    });
  };

  const renderCourseSelector = (stages: StageForm[], mode: 'create' | 'edit') => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {stages.map((stage, stageIndex) => (
        <div key={`${mode}-${stage.stageId}`} className="md:col-span-2 border border-slate-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              label={`Stage ${stageIndex + 1} Name`}
              value={stage.title}
              onChange={(event) => updateStageTitle(mode, stageIndex, event.target.value)}
              required
            />
            <Button type="button" variant="outline" size="sm" onClick={() => removeStage(mode, stageIndex)}>
              Remove Stage
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Select Courses</p>
              <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
              {courses.map((course, courseIndex) => (
                <label
                  key={getCourseRenderKey(course, courseIndex, `${mode}-${stage.stageId}`)}
                  className="flex items-start gap-3 p-2 rounded hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={stage.selectedCourseIds.includes(course.id)}
                      onChange={() => toggleCourse(stageIndex, course.id, mode)}
                    />
                    <span className="text-sm">
                      <span className="block font-medium text-slate-900">{course.title}</span>
                      <span className="block text-xs text-slate-500">{course.code}</span>
                      {course.description ? (
                        <span className="block text-xs text-slate-500">{course.description}</span>
                      ) : null}
                      {course.deliveryMode ? (
                        <span className="block text-xs text-slate-600">
                          {course.deliveryMode === 'ONLINE'
                            ? `Online${course.videoUrl ? ' | Video available' : ''}`
                            : `Physical${course.venue ? ` | ${course.venue}` : ''}`}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Course Order in Stage</p>
              <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
                {stage.selectedCourseIds.length === 0 ? (
                  <p className="text-sm text-slate-500 p-2">Select courses to define order for this stage.</p>
                ) : (
                  stage.selectedCourseIds.map((courseId, courseIndex) => {
                    const course = courses.find((item) => item.id === courseId);
                    return (
                      <div key={`${courseId}-${mode}-${stage.stageId}-order`} className="p-2 rounded border border-slate-200 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {courseIndex + 1}. {course?.title || courseId}
                          </p>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-slate-100"
                              onClick={() => moveCourse(stageIndex, courseIndex, 'up', mode)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-slate-100"
                              onClick={() => moveCourse(stageIndex, courseIndex, 'down', mode)}
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
      <div className="md:col-span-2">
        <Button type="button" variant="outline" onClick={() => addStage(mode)}>
          Add Stage
        </Button>
      </div>
    </div>
  );

  const renderCreateStageBuilder = () => (
    <div className="space-y-4">
      {(() => {
        const liveFilteredCourses = filterCoursesByQuery(courses, createCourseSearch);

        return (
      <div className="border border-slate-200 rounded-lg p-3 space-y-3">
        <div className="flex items-end gap-2">
          <Input
            label="Stage Name"
            value={pathForm.draftStage.title}
            onChange={(event) => updateStageTitle('create', pathForm.stages.length, event.target.value)}
            required
          />
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => addStage('create')}
            className="self-end border-slate-400 text-slate-900 hover:bg-slate-200"
          >
            Add Stage
          </Button>
        </div>

        <div>
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <p className="text-sm font-medium text-slate-700">Select Courses</p>
            <div className="w-full md:w-80">
              <Input
                id="create-course-search"
                key="create-course-search"
                label="Search Courses"
                placeholder="Search by course name or ID"
                value={createCourseSearch}
                onChange={(event) => setCreateCourseSearch(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Showing {liveFilteredCourses.length} of {courses.length} courses
          </p>
          <div className="max-h-[30rem] overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
            {liveFilteredCourses.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">
                No courses match "{createCourseSearch.trim()}".
              </p>
            ) : (
              liveFilteredCourses.map((course, courseIndex) => (
                <label
                  key={getCourseRenderKey(course, courseIndex, `create-${pathForm.draftStage.stageId}`)}
                  className="flex items-start gap-3 p-2 rounded hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={pathForm.draftStage.selectedCourseIds.includes(course.id)}
                    onChange={() => toggleCourse(pathForm.stages.length, course.id, 'create')}
                  />
                  <span className="text-sm">
                    <span className="block font-medium text-slate-900">{course.title}</span>
                    <span className="block text-xs text-slate-500">{course.code}</span>
                    {course.description ? (
                      <span className="block text-xs text-slate-500">{course.description}</span>
                    ) : null}
                    {course.deliveryMode ? (
                      <span className="block text-xs text-slate-600">
                        {course.deliveryMode === 'ONLINE'
                          ? `Online${course.videoUrl ? ' | Video available' : ''}`
                          : `Physical${course.venue ? ` | ${course.venue}` : ''}`}
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
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      await learningApi.createEnrollments(token, {
        learningPathId: assignForm.learningPathId,
        selectedLearners: learners.filter((learner) =>
          assignForm.selectedLearnerEmployeeNumbers.includes(learner.employeeNumber)
        )
      });

      showToast('Enrollments assigned successfully.', 'success');
      setAssignForm(initialAssignForm);
      setLearners([]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign enrollments.', 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignSearch = async () => {
    try {
      setAssignSearchLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learningApi.searchAssignableEmployees(token, {
        employeeNo: assignEmployeeNoSearch,
        surname: assignSurnameSearch,
        designation: assignDesignationFilter,
        grade: assignGradeFilter,
        organizationId: assignOrganizationFilter,
        payrollType: assignPayrollFilter as '' | 'EXECUTIVE' | 'NON_EXECUTIVE'
      });

      setLearners(response.employees);
      setAssignForm((prev) => ({ ...prev, selectedLearnerEmployeeNumbers: [] }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to search ERP employees.', 'error');
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
    const filteredIdSet = new Set(learners.map((learner) => learner.employeeNumber));
    setAssignForm((prev) => ({
      ...prev,
      selectedLearnerEmployeeNumbers: prev.selectedLearnerEmployeeNumbers.filter((id) => !filteredIdSet.has(id))
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{sectionMeta[section].title}</h1>
        <p className="text-slate-500">{sectionMeta[section].description}</p>
      </div>

      {section === 'create' ? (
        <div className="grid grid-cols-1 xl:grid-cols-9 gap-6">
          <Card title="Create Learning Path" className="xl:col-span-5">
            <form className="space-y-4" onSubmit={handleCreatePath}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Title"
                  value={pathForm.title}
                  onChange={(event) => setPathForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
                <Select
                  label="Category"
                  value={pathForm.category}
                  onChange={(event) =>
                    setPathForm((prev) => ({ ...prev, category: event.target.value as Category }))
                  }
                  options={[
                    { value: 'PUBLIC', label: 'Public' },
                    { value: 'SEMI_RESTRICTED', label: 'Semi Restricted' },
                    { value: 'RESTRICTED', label: 'Restricted' }
                  ]}
                />
                <Input
                  label="Total Duration"
                  value={pathForm.totalDuration}
                  onChange={(event) =>
                    setPathForm((prev) => ({ ...prev, totalDuration: event.target.value }))
                  }
                  placeholder="e.g. 4yr"
                  required
                />
                <Input
                  label="Description"
                  value={pathForm.description}
                  onChange={(event) =>
                    setPathForm((prev) => ({ ...prev, description: event.target.value }))
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
                  {pathForm.title.trim() || 'Untitled Learning Path'}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {pathForm.description.trim() || 'Add a description to preview details.'}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {pathForm.category.replace('_', ' ')} | {pathForm.totalDuration || 'Duration not set'}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Stages & Courses</p>
                <div className="space-y-2">
                  {pathForm.stages.length === 0 && pathForm.draftStage.selectedCourseIds.length === 0 ? (
                    <p className="text-sm text-slate-500">No stages added yet.</p>
                  ) : (
                    [...pathForm.stages, pathForm.draftStage].map((stage, stageIndex) => {
                      const isDraftStage = stageIndex === pathForm.stages.length;
                      if (isDraftStage && stage.selectedCourseIds.length === 0) {
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
                              <p className="text-xs text-slate-500">No courses selected.</p>
                            ) : (
                              stage.selectedCourseIds.map((courseId, courseIndex) => {
                                const course = courses.find((item) => item.id === courseId);
                                return (
                                  <div
                                    key={`preview-${stage.stageId}-${courseId}`}
                                    className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-2"
                                  >
                                    <div>
                                      <p className="text-slate-800">
                                        {courseIndex + 1}. {course?.title || courseId}
                                      </p>
                                      <p className="text-xs text-slate-500">{course?.code || courseId}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        className="rounded p-1 hover:bg-slate-200"
                                        onClick={() => moveCourse(stageIndex, courseIndex, 'up', 'create')}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded p-1 hover:bg-slate-200"
                                        onClick={() => moveCourse(stageIndex, courseIndex, 'down', 'create')}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {section === 'assign' ? (
        <Card title="Assign Learning Path to Learners">
          <form className="space-y-3" onSubmit={handleAssign}>
            <Select
              label="Learning Path"
              value={assignForm.learningPathId}
              onChange={(event) =>
                setAssignForm((prev) => ({ ...prev, learningPathId: event.target.value }))
              }
              options={[
                { value: '', label: 'Select a path' },
                ...paths.map((path) => ({ value: path.id, label: `${path.title} (${path.status})` }))
              ]}
              required
              />

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Select Learners</p>
              <div className="border border-slate-200 rounded-md bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3 border-b border-slate-200">
                  <Input
                    label="Search by Employee No"
                    value={assignEmployeeNoSearch}
                    onChange={(event) => setAssignEmployeeNoSearch(event.target.value)}
                    placeholder="e.g. 011338"
                  />
                  <Input
                    label="Search by Surname"
                    value={assignSurnameSearch}
                    onChange={(event) => setAssignSurnameSearch(event.target.value)}
                    placeholder="e.g. Mohamed"
                  />
                  <Select
                    label="Filter by Designation"
                    value={assignDesignationFilter}
                    onChange={(event) => setAssignDesignationFilter(event.target.value)}
                    options={[
                      { value: '', label: 'All Designations' },
                      ...designationOptions.map((option) => ({ value: option, label: option }))
                    ]}
                  />
                  <Select
                    label="Filter by Grade"
                    value={assignGradeFilter}
                    onChange={(event) => setAssignGradeFilter(event.target.value)}
                    options={[
                      { value: '', label: 'All Grades' },
                      ...gradeOptions.map((option) => ({ value: option, label: option }))
                    ]}
                  />
                  <Select
                    label="Filter by Organization"
                    value={assignOrganizationFilter}
                    onChange={(event) => setAssignOrganizationFilter(event.target.value)}
                    options={[
                      { value: '', label: 'All Organizations' },
                      ...organizationOptions.map((option) => ({
                        value: option.organizationId,
                        label: option.parentOrganizationName
                          ? `${option.organizationName} (${option.parentOrganizationName})`
                          : option.organizationName
                      }))
                    ]}
                  />
                  <Select
                    label="Executive / Non Executive"
                    value={assignPayrollFilter}
                    onChange={(event) => setAssignPayrollFilter(event.target.value)}
                    options={[
                      { value: '', label: 'All Payrolls' },
                      { value: 'EXECUTIVE', label: 'Executive' },
                      { value: 'NON_EXECUTIVE', label: 'Non Executive' }
                    ]}
                  />
                </div>

                <div className="flex justify-end px-3 py-2 border-b border-slate-200 bg-slate-50/70">
                  <Button
                    type="button"
                    onClick={handleAssignSearch}
                    isLoading={assignSearchLoading}
                    disabled={
                      !assignEmployeeNoSearch.trim() &&
                      !assignSurnameSearch.trim() &&
                      !assignDesignationFilter &&
                      !assignGradeFilter &&
                      !assignOrganizationFilter &&
                      !assignPayrollFilter
                    }
                  >
                    Search
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200">
                  <p className="text-xs text-slate-500">
                    ERP results: {learners.length} | Selected: {assignForm.selectedLearnerEmployeeNumbers.length}
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

                <div className="max-h-[26rem] overflow-y-auto p-2">
                  {learners.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">Search ERP to load learners.</p>
                  ) : (
                    learners.map((learner) => (
                      <label
                        key={learner.employeeNumber}
                        className="flex items-start gap-3 p-2 rounded-md hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={assignForm.selectedLearnerEmployeeNumbers.includes(learner.employeeNumber)}
                          onChange={() => toggleLearnerSelection(learner.employeeNumber)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-900">
                            {learner.employeeName} ({learner.employeeNumber})
                          </span>
                          <span className="block text-xs text-slate-500">
                            {learner.employeeSurname || '-'} | {learner.designation || '-'} | {learner.gradeName || '-'}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {learner.organizationName || '-'} | {learner.email || '-'}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={assignLoading}
              disabled={!assignForm.learningPathId || assignForm.selectedLearnerEmployeeNumbers.length === 0}
            >
              Assign Enrollments
            </Button>
          </form>
        </Card>
      ) : null}

      {section === 'manage' ? (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search paths..."
                className="pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Path Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td className="px-6 py-4 text-slate-500" colSpan={5}>
                      Loading learning paths...
                    </td>
                  </tr>
                ) : filteredPaths.length === 0 ? (
                  <tr>
                    <td className="px-6 py-4 text-slate-500" colSpan={5}>
                      No learning paths found.
                    </td>
                  </tr>
                ) : (
                  filteredPaths.map((path) => (
                    <tr key={path.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{path.title}</div>
                        <div className="text-slate-500 text-xs truncate max-w-xs">{path.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            path.category === 'RESTRICTED'
                              ? 'danger'
                              : path.category === 'SEMI_RESTRICTED'
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {path.category.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{path.total_duration}</td>
                      <td className="px-6 py-4 text-slate-600">{path.status}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="p-1 text-slate-500 hover:text-blue-600"
                            onClick={() => startEdit(path)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-slate-500 hover:text-red-600"
                            onClick={() => handleDeletePath(path.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {section === 'manage' && editPathId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">Edit Learning Path</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditPathId(null)}>
                Close
              </Button>
            </div>
            <div className="p-4">
              <form className="space-y-4" onSubmit={handleUpdatePath}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Title"
                    value={editForm.title}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                    required
                  />
                  <Select
                    label="Category"
                    value={editForm.category}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, category: event.target.value as Category }))
                    }
                    options={[
                      { value: 'PUBLIC', label: 'Public' },
                      { value: 'SEMI_RESTRICTED', label: 'Semi Restricted' },
                      { value: 'RESTRICTED', label: 'Restricted' }
                    ]}
                  />
                  <Input
                    label="Total Duration"
                    value={editForm.totalDuration}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, totalDuration: event.target.value }))
                    }
                    required
                  />
                  <Select
                    label="Status"
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, status: event.target.value as PathStatus }))
                    }
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'DRAFT', label: 'Draft' },
                      { value: 'ARCHIVED', label: 'Archived' }
                    ]}
                  />
                  <Input
                    label="Description"
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    required
                  />
                </div>

                {renderCourseSelector(editForm.stages, 'edit')}

                <div className="flex gap-2">
                  <Button type="submit" isLoading={editLoading}>
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditPathId(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
