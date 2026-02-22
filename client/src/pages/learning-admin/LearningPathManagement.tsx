import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { learningApi } from '../../api/lpmsApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { useAuth } from '../../contexts/useAuth';

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

type AssignableEmployee = {
  id: string;
  name: string;
  email: string;
  employee_number: string;
  designation: string;
  grade_name: string;
};

const initialPathForm = {
  title: '',
  description: '',
  category: 'PUBLIC' as Category,
  totalDuration: ''
};

const initialAssignForm = {
  learningPathId: '',
  selectedEmployeeIds: [] as string[]
};

export function LearningPathManagement() {
  const { getAccessToken } = useAuth();

  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [pathForm, setPathForm] = useState(initialPathForm);
  const [pathFormLoading, setPathFormLoading] = useState(false);

  const [editPathId, setEditPathId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'PUBLIC' as Category,
    totalDuration: '',
    status: 'ACTIVE' as PathStatus
  });
  const [editLoading, setEditLoading] = useState(false);

  const [assignForm, setAssignForm] = useState(initialAssignForm);
  const [assignLoading, setAssignLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPageError('Session expired. Please login again.');
        return;
      }

      const [pathsResponse, employeesResponse] = await Promise.all([
        learningApi.getLearningPaths(token),
        learningApi.getAssignableEmployees(token)
      ]);

      setPaths(pathsResponse.learningPaths as LearningPathRow[]);
      setEmployees(employeesResponse.employees);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPaths = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return paths;
    }
    return paths.filter((path) =>
      path.title.toLowerCase().includes(normalized) ||
      path.description.toLowerCase().includes(normalized)
    );
  }, [paths, query]);

  const handleCreatePath = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPathFormLoading(true);
    setPageError(null);
    setPageMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPageError('Session expired. Please login again.');
        return;
      }

      await learningApi.createLearningPath(token, pathForm);
      setPathForm(initialPathForm);
      setPageMessage('Learning path created successfully.');
      await loadData();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to create learning path.');
    } finally {
      setPathFormLoading(false);
    }
  };

  const startEdit = (path: LearningPathRow) => {
    setEditPathId(path.id);
    setEditForm({
      title: path.title,
      description: path.description,
      category: path.category,
      totalDuration: path.total_duration,
      status: path.status
    });
  };

  const handleUpdatePath = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editPathId) {
      return;
    }
    setEditLoading(true);
    setPageError(null);
    setPageMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPageError('Session expired. Please login again.');
        return;
      }

      await learningApi.updateLearningPath(token, editPathId, editForm);
      setPageMessage('Learning path updated successfully.');
      setEditPathId(null);
      await loadData();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to update learning path.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePath = async (id: string) => {
    const confirmed = window.confirm('Delete this learning path?');
    if (!confirmed) {
      return;
    }
    setPageError(null);
    setPageMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPageError('Session expired. Please login again.');
        return;
      }
      await learningApi.deleteLearningPath(token, id);
      setPageMessage('Learning path deleted successfully.');
      await loadData();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to delete learning path.');
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setAssignForm((prev) => {
      const exists = prev.selectedEmployeeIds.includes(employeeId);
      return {
        ...prev,
        selectedEmployeeIds: exists
          ? prev.selectedEmployeeIds.filter((id) => id !== employeeId)
          : [...prev.selectedEmployeeIds, employeeId]
      };
    });
  };

  const handleAssign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssignLoading(true);
    setPageError(null);
    setPageMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPageError('Session expired. Please login again.');
        return;
      }

      await learningApi.createEnrollments(token, {
        learningPathId: assignForm.learningPathId,
        employeePrincipalIds: assignForm.selectedEmployeeIds
      });

      setPageMessage('Enrollments assigned successfully.');
      setAssignForm(initialAssignForm);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to assign enrollments.');
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

      {pageError ? <Card className="text-red-600">{pageError}</Card> : null}
      {pageMessage ? <Card className="text-green-700">{pageMessage}</Card> : null}

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
              <Card title="Assign Learning Path to Employees">
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
                    <p className="text-sm font-medium text-slate-700 mb-2">Select Employees</p>
                    <div className="max-h-64 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
                      {employees.length === 0 ? (
                        <p className="text-sm text-slate-500 p-2">No employees available.</p>
                      ) : (
                        employees.map((employee) => (
                          <label key={employee.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={assignForm.selectedEmployeeIds.includes(employee.id)}
                              onChange={() => toggleEmployeeSelection(employee.id)}
                              className="mt-1"
                            />
                            <span>
                              <span className="block text-sm font-medium text-slate-900">{employee.name}</span>
                              <span className="block text-xs text-slate-500">
                                {employee.email} | {employee.employee_number} | {employee.designation}
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
                    disabled={!assignForm.learningPathId || assignForm.selectedEmployeeIds.length === 0}
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
