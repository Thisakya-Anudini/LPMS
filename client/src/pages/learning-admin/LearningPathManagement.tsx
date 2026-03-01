import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Search, Trash2 } from 'lucide-react';
import { courseApi, learningApi } from '../../api/lpmsApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
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
};

const initialPathForm = {
  title: '',
  description: '',
  category: 'PUBLIC' as Category,
  totalDuration: '',
  selectedCourseIds: [] as string[]
};

const initialAssignForm = {
  learningPathId: '',
  selectedLearnerIds: [] as string[]
};

export function LearningPathManagement() {
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
    selectedCourseIds: [] as string[]
  });
  const [editLoading, setEditLoading] = useState(false);

  const [assignForm, setAssignForm] = useState(initialAssignForm);
  const [assignLoading, setAssignLoading] = useState(false);

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

  const toStages = (selectedCourseIds: string[]) =>
    selectedCourseIds.map((courseId, index) => {
      const course = courses.find((item) => item.id === courseId);
      return {
        title: course?.title || courseId,
        order: index + 1
      };
    });

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
        stages: toStages(pathForm.selectedCourseIds)
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
      const stageTitles =
        detailResponse.learningPath.stages
          ?.sort((a, b) => a.stage_order - b.stage_order)
          .map((stage) => stage.title) || [];

      const selectedCourseIds = stageTitles
        .map((title) => courses.find((course) => course.title === title)?.id)
        .filter((value): value is string => Boolean(value));

      setEditPathId(path.id);
      setEditForm({
        title: path.title,
        description: path.description,
        category: path.category,
        totalDuration: path.total_duration,
        status: path.status,
        selectedCourseIds
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
        stages: toStages(editForm.selectedCourseIds)
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

  const toggleCourse = (
    selectedCourseIds: string[],
    courseId: string,
    mode: 'create' | 'edit'
  ) => {
    const exists = selectedCourseIds.includes(courseId);
    if (mode === 'create') {
      setPathForm((prev) => ({
        ...prev,
        selectedCourseIds: exists
          ? prev.selectedCourseIds.filter((id) => id !== courseId)
          : [...prev.selectedCourseIds, courseId]
      }));
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      selectedCourseIds: exists
        ? prev.selectedCourseIds.filter((id) => id !== courseId)
        : [...prev.selectedCourseIds, courseId]
    }));
  };

  const moveCourse = (
    selectedCourseIds: string[],
    index: number,
    direction: 'up' | 'down',
    mode: 'create' | 'edit'
  ) => {
    const next = [...selectedCourseIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) {
      return;
    }
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

    if (mode === 'create') {
      setPathForm((prev) => ({ ...prev, selectedCourseIds: next }));
      return;
    }
    setEditForm((prev) => ({ ...prev, selectedCourseIds: next }));
  };

  const renderCourseSelector = (
    selectedCourseIds: string[],
    mode: 'create' | 'edit'
  ) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Select Courses</p>
        <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
          {courses.map((course) => (
            <label key={`${course.id}-${mode}`} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedCourseIds.includes(course.id)}
                onChange={() => toggleCourse(selectedCourseIds, course.id, mode)}
              />
              <span className="text-sm">
                <span className="block font-medium text-slate-900">{course.title}</span>
                <span className="block text-xs text-slate-500">{course.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Course Order</p>
        <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
          {selectedCourseIds.length === 0 ? (
            <p className="text-sm text-slate-500 p-2">Select courses to define order.</p>
          ) : (
            selectedCourseIds.map((courseId, index) => {
              const course = courses.find((item) => item.id === courseId);
              return (
                <div key={`${courseId}-${mode}-order`} className="p-2 rounded border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {index + 1}. {course?.title || courseId}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-slate-100"
                        onClick={() => moveCourse(selectedCourseIds, index, 'up', mode)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-slate-100"
                        onClick={() => moveCourse(selectedCourseIds, index, 'down', mode)}
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
        employeePrincipalIds: assignForm.selectedLearnerIds
      });

      showToast('Enrollments assigned successfully.', 'success');
      setAssignForm(initialAssignForm);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign enrollments.', 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Learning Path Management</h1>
        <p className="text-slate-500">Create, update, and assign learning paths.</p>
      </div>

      <Tabs
        defaultTab="paths"
        tabs={[
          {
            id: 'paths',
            label: 'Manage Paths',
            content: (
              <div className="space-y-6">
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
                        placeholder="e.g. 4h"
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

                    {renderCourseSelector(pathForm.selectedCourseIds, 'create')}

                    <Button type="submit" isLoading={pathFormLoading}>
                      Create Path
                    </Button>
                  </form>
                </Card>

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

                {editPathId ? (
                  <Card title="Edit Learning Path">
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

                      {renderCourseSelector(editForm.selectedCourseIds, 'edit')}

                      <div className="flex gap-2">
                        <Button type="submit" isLoading={editLoading}>
                          Save Changes
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEditPathId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Card>
                ) : null}
              </div>
            )
          },
          {
            id: 'enrollments',
            label: 'Assign Enrollments',
            content: (
              <Card title="Assign Learning Path to Learners">
                <form className="space-y-4" onSubmit={handleAssign}>
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
                      {learners.length === 0 ? (
                        <p className="text-sm text-slate-500 p-2">No learners available.</p>
                      ) : (
                        learners.map((learner) => (
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
            )
          }
        ]}
      />
    </div>
  );
}
