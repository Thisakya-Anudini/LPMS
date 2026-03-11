import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { superAdminApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type LearnerRow = {
  principal_id: string;
  name: string;
  email: string;
  is_active: boolean;
  employee_number: string;
  designation: string;
  grade_name: string;
  total_learning_paths: number;
  completed_learning_paths: number;
  average_progress: string;
};

type LearnerPath = {
  enrollment_id: string;
  status: string;
  progress: number;
  enrolled_at: string;
  completed_at?: string;
  learning_path_id: string;
  title: string;
  description: string;
  category: string;
  total_duration: string;
};

export function AdminLearnersPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<{ id: string; name: string; email: string } | null>(null);
  const [selectedLearnerPaths, setSelectedLearnerPaths] = useState<LearnerPath[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [employeeNoSearch, setEmployeeNoSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('ALL');

  const loadLearners = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await superAdminApi.getLearners(token);
      setLearners(response.learners);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learners.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadLearners();
  }, [loadLearners]);

  const openLearnerDetails = async (learner: LearnerRow) => {
    try {
      setDetailLoading(true);
      setIsPopupOpen(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await superAdminApi.getLearnerLearningPaths(token, learner.principal_id);
      setSelectedLearner({
        id: response.learner.id,
        name: response.learner.name,
        email: response.learner.email
      });
      setSelectedLearnerPaths(response.learningPaths);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learner learning paths.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const closePopup = () => {
    setIsPopupOpen(false);
    setSelectedLearner(null);
    setSelectedLearnerPaths([]);
  };

  const designationOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        learners
          .map((learner) => (learner.designation || '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));
    return ['ALL', ...values];
  }, [learners]);

  const filteredLearners = useMemo(() => {
    const employeeNoTerm = employeeNoSearch.trim().toLowerCase();
    const nameTerm = nameSearch.trim().toLowerCase();

    return learners.filter((learner) => {
      const byEmployeeNo =
        !employeeNoTerm || learner.employee_number.toLowerCase().includes(employeeNoTerm);
      const byName = !nameTerm || learner.name.toLowerCase().includes(nameTerm);
      const byDesignation =
        designationFilter === 'ALL' || learner.designation === designationFilter;

      return byEmployeeNo && byName && byDesignation;
    });
  }, [designationFilter, employeeNoSearch, learners, nameSearch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Learners</h1>
        <p className="text-slate-500">View all learners and inspect assigned learning path progress.</p>
      </div>

      <Card title="All Learners">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Search by Employee No</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. 011338"
              value={employeeNoSearch}
              onChange={(event) => setEmployeeNoSearch(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Search by Name</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Tennakoon"
              value={nameSearch}
              onChange={(event) => setNameSearch(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Filter by Designation</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              value={designationFilter}
              onChange={(event) => setDesignationFilter(event.target.value)}
            >
              {designationOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-3 py-2">Learner</th>
                <th className="px-3 py-2">Employee No</th>
                <th className="px-3 py-2">Designation</th>
                <th className="px-3 py-2">Assigned LPs</th>
                <th className="px-3 py-2">Avg Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">Loading learners...</td>
                </tr>
              ) : filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">No learners match current filters.</td>
                </tr>
              ) : (
                filteredLearners.map((learner) => (
                  <tr
                    key={learner.principal_id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => openLearnerDetails(learner)}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{learner.name}</p>
                      <p className="text-xs text-slate-500">{learner.email}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{learner.employee_number}</td>
                    <td className="px-3 py-2 text-slate-700">{learner.designation}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {learner.completed_learning_paths}/{learner.total_learning_paths}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{Math.round(Number(learner.average_progress || 0))}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isPopupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedLearner ? `${selectedLearner.name} - Learning Paths` : 'Learner Learning Paths'}
              </h2>
              <button
                type="button"
                onClick={closePopup}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              {detailLoading ? (
                <p className="text-sm text-slate-500">Loading learner details...</p>
              ) : !selectedLearner ? (
                <p className="text-sm text-slate-500">Select a learner to view assigned learning paths.</p>
              ) : selectedLearnerPaths.length === 0 ? (
                <p className="text-sm text-slate-500">No learning paths assigned to this learner.</p>
              ) : (
                <div className="space-y-4">
                  {selectedLearnerPaths.map((path) => (
                    <div key={path.enrollment_id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-slate-900">{path.title}</p>
                        <span className="text-xs text-slate-500">{path.status.replace('_', ' ')}</span>
                      </div>
                      <ProgressBar progress={Number(path.progress || 0)} showLabel size="sm" />
                      <p className="text-xs text-slate-500 mt-2">
                        {path.category.replace('_', ' ')} | {path.total_duration}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-4 py-3 flex justify-end">
              <Button type="button" variant="outline" onClick={closePopup}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
