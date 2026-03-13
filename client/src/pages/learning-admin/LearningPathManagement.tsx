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
  id: string;
  name: string;
  email: string;
  employee_number: string;
  designation: string;
  grade_name: string;
};

type CourseItem = {
  id: string;
  title: string;
  description: string;
  durationHours: number;
  deliveryMode: 'ONLINE' | 'PHYSICAL';
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
  selectedLearnerIds: [] as string[]
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
  const [assignEmployeeNoSearch, setAssignEmployeeNoSearch] = useState('');
  const [assignNameSearch, setAssignNameSearch] = useState('');
  const [assignDesignationFilter, setAssignDesignationFilter] = useState('ALL');
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);
  const [assignNotifyAll, setAssignNotifyAll] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const [pathsResponse, learnersResponse, coursesResponse] = await Promise.all([
        learningApi.getLearningPaths(token),
        learningApi.getAssignableEmployees(token),
        courseApi.getAllCourses(token)
      ]);

      setPaths(pathsResponse.learningPaths as LearningPathRow[]);
      setLearners(learnersResponse.employees);
      setCourses(coursesResponse.courses);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

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

  const learnerDesignationOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        learners
          .map((learner) => learner.designation.trim())
          .filter((value) => value.length > 0 && value !== '-')
      )
    ).sort((a, b) => a.localeCompare(b));
    return ['ALL', ...values];
  }, [learners]);

  const filteredAssignableLearners = useMemo(() => {
    const employeeNoTerm = assignEmployeeNoSearch.trim().toLowerCase();
    const nameTerm = assignNameSearch.trim().toLowerCase();

    return learners.filter((learner) => {
      const byEmployeeNo = !employeeNoTerm || learner.employee_number.toLowerCase().includes(employeeNoTerm);
      const byName = !nameTerm || learner.name.toLowerCase().includes(nameTerm);
      const byDesignation =
        assignDesignationFilter === 'ALL' || learner.designation === assignDesignationFilter;
      return byEmployeeNo && byName && byDesignation;
    });
  }, [assignDesignationFilter, assignEmployeeNoSearch, assignNameSearch, learners]);

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

  const toggleLearnerSelection = (learnerId: string) => {
    setAssignForm((prev) => {
      const exists = prev.selectedLearnerIds.includes(learnerId);
      return {
        ...prev,
        selectedLearnerIds: exists
          ? prev.selectedLearnerIds.filter((id) => id !== learnerId)
          : [...prev.selectedLearnerIds, learnerId]
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
        draftStage: {
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
        ? pathForm.draftStage.selectedCourseIds || []
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
        draftStage: { ...prev.draftStage, title }
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
      setPathForm((prev) => ({
        ...prev,
        draftStage: createStageForm(prev.stages.length)
      }));
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
                {courses.map((course) => (
                  <label key={`${course.id}-${mode}-${stage.stageId}`} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={stage.selectedCourseIds.includes(course.id)}
                      onChange={() => toggleCourse(stageIndex, course.id, mode)}
                    />
                    <span className="text-sm">
                      <span className="block font-medium text-slate-900">{course.title}</span>
                      <span className="block text-xs text-slate-500">{course.description}</span>
                      <span className="block text-xs text-slate-600">
                        {course.deliveryMode === 'ONLINE'
                          ? `Online${course.videoUrl ? ' | Video available' : ''}`
                          : `Physical${course.venue ? ` | ${course.venue}` : ''}`}
                      </span>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 border border-slate-200 rounded-lg p-3 space-y-3">
        <div className="flex items-end gap-2">
          <Input
            label="Stage Name"
            value={pathForm.draftStage.title}
            onChange={(event) => updateStageTitle('create', 0, event.target.value)}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Select Courses</p>
            <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
              {courses.map((course) => (
                <label
                  key={`${course.id}-create-${pathForm.draftStage.stageId}`}
                  className="flex items-start gap-3 p-2 rounded hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={pathForm.draftStage.selectedCourseIds.includes(course.id)}
                    onChange={() => toggleCourse(0, course.id, 'create')}
                  />
                  <span className="text-sm">
                    <span className="block font-medium text-slate-900">{course.title}</span>
                    <span className="block text-xs text-slate-500">{course.description}</span>
                    <span className="block text-xs text-slate-600">
                      {course.deliveryMode === 'ONLINE'
                        ? `Online${course.videoUrl ? ' | Video available' : ''}`
                        : `Physical${course.venue ? ` | ${course.venue}` : ''}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Course Order in Stage</p>
            <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
              {pathForm.draftStage.selectedCourseIds.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">Select courses to define order for this stage.</p>
              ) : (
                pathForm.draftStage.selectedCourseIds.map((courseId, courseIndex) => {
                  const course = courses.find((item) => item.id === courseId);
                  return (
                    <div
                      key={`${courseId}-create-${pathForm.draftStage.stageId}-order`}
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
                            onClick={() => moveCourse(0, courseIndex, 'up', 'create')}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-slate-100"
                            onClick={() => moveCourse(0, courseIndex, 'down', 'create')}
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
    </div>
  );

  const handleAssignRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignForm.learningPathId || assignForm.selectedLearnerIds.length === 0) {
      return;
    }
    setAssignConfirmOpen(true);
  };

  const handleAssignConfirm = async () => {
    setAssignLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      await learningApi.createEnrollments(token, {
        learningPathId: assignForm.learningPathId,
        employeePrincipalIds: assignForm.selectedLearnerIds,
        notifyAll: assignNotifyAll
      });

      showToast('Enrollments assigned successfully.', 'success');
      setAssignForm(initialAssignForm);
      setAssignNotifyAll(false);
      setAssignConfirmOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign enrollments.', 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  const selectAllFilteredLearners = () => {
    const filteredIds = filteredAssignableLearners.map((learner) => learner.id);
    setAssignForm((prev) => {
      const next = new Set(prev.selectedLearnerIds);
      filteredIds.forEach((id) => next.add(id));
      return { ...prev, selectedLearnerIds: Array.from(next) };
    });
  };

  const clearFilteredLearners = () => {
    const filteredIdSet = new Set(filteredAssignableLearners.map((learner) => learner.id));
    setAssignForm((prev) => ({
      ...prev,
      selectedLearnerIds: prev.selectedLearnerIds.filter((id) => !filteredIdSet.has(id))
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{sectionMeta[section].title}</h1>
        <p className="text-slate-500">{sectionMeta[section].description}</p>
      </div>

      {section === 'create' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="Learning Path Preview">
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
                  {pathForm.stages.length === 0 ? (
                    <p className="text-sm text-slate-500">No stages added yet.</p>
                  ) : (
                    pathForm.stages.map((stage, stageIndex) => (
                      <div
                        key={`preview-${stage.stageId}`}
                        className="p-2 rounded border border-slate-200 bg-white text-sm text-slate-800"
                      >
                        <p className="font-semibold text-slate-900">
                          Stage {stageIndex + 1}: {stage.title || `Stage ${stageIndex + 1}`}
                        </p>
                        <div className="mt-1 space-y-1">
                          {stage.selectedCourseIds.length === 0 ? (
                            <p className="text-xs text-slate-500">No courses selected.</p>
                          ) : (
                            stage.selectedCourseIds.map((courseId, courseIndex) => {
                              const course = courses.find((item) => item.id === courseId);
                              return (
                                <p key={`preview-${stage.stageId}-${courseId}`} className="text-slate-700">
                                  {courseIndex + 1}. {course?.title || courseId}
                                </p>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Create Learning Path">
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
        </div>
      ) : null}

      {section === 'assign' ? (
        <Card title="Assign Learning Path to Learners">
          <form className="space-y-4" onSubmit={handleAssignRequest}>
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
              <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-2 border-b border-slate-200 mb-2">
                  <Input
                    label="Search by Employee No"
                    value={assignEmployeeNoSearch}
                    onChange={(event) => setAssignEmployeeNoSearch(event.target.value)}
                    placeholder="e.g. 011338"
                  />
                  <Input
                    label="Search by Name"
                    value={assignNameSearch}
                    onChange={(event) => setAssignNameSearch(event.target.value)}
                    placeholder="e.g. Tennakoon"
                  />
                  <Select
                    label="Filter by Designation"
                    value={assignDesignationFilter}
                    onChange={(event) => setAssignDesignationFilter(event.target.value)}
                    options={learnerDesignationOptions.map((option) => ({ value: option, label: option }))}
                  />
                </div>

                <div className="flex items-center justify-between px-2 pb-2">
                  <p className="text-xs text-slate-500">
                    Filtered learners: {filteredAssignableLearners.length} | Selected: {assignForm.selectedLearnerIds.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={selectAllFilteredLearners}
                      disabled={filteredAssignableLearners.length === 0}
                    >
                      Select All Filtered
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearFilteredLearners}
                      disabled={filteredAssignableLearners.length === 0}
                    >
                      Clear Filtered
                    </Button>
                  </div>
                </div>

                {learners.length === 0 ? (
                  <p className="text-sm text-slate-500 p-2">No learners available.</p>
                ) : filteredAssignableLearners.length === 0 ? (
                  <p className="text-sm text-slate-500 p-2">No learners match current filters.</p>
                ) : (
                  filteredAssignableLearners.map((learner) => (
                    <label key={learner.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={assignForm.selectedLearnerIds.includes(learner.id)}
                        onChange={() => toggleLearnerSelection(learner.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{learner.name}</span>
                        <span className="block text-xs text-slate-500">
                          {learner.email} | {learner.employee_number} | {learner.designation}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <Button
              type="submit"
              isLoading={assignLoading}
              disabled={!assignForm.learningPathId || assignForm.selectedLearnerIds.length === 0}
            >
              Assign Enrollments
            </Button>
          </form>
        </Card>
      ) : null}
      {section === 'assign' && assignConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">Confirm Assignment</h2>
              <p className="text-sm text-slate-500">
                You are about to assign{' '}
                <span className="font-semibold text-slate-700">
                  {assignForm.selectedLearnerIds.length} learner(s)
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-700">
                  {paths.find((path) => path.id === assignForm.learningPathId)?.title || 'selected learning path'}
                </span>
                .
              </p>
            </div>
            <div className="px-4 py-4 space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={assignNotifyAll}
                  onChange={(event) => setAssignNotifyAll(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Notify all assigned learners by email</span>
                  <span className="block text-xs text-slate-500">
                    Sends an email from your configured account to each newly assigned learner.
                  </span>
                </span>
              </label>
            </div>
            <div className="border-t border-slate-200 px-4 py-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignConfirmOpen(false)}
                disabled={assignLoading}
              >
                Cancel
              </Button>
              <Button type="button" isLoading={assignLoading} onClick={handleAssignConfirm}>
                Assign
              </Button>
            </div>
          </div>
        </div>
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
