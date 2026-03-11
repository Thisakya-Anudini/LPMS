import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
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
};

export function AdminLearnersPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
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

  const openLearnerDetails = (learner: LearnerRow) => {
    navigate(`/admin/learners/${learner.principal_id}`);
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">Loading learners...</td>
                </tr>
              ) : filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">No learners match current filters.</td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
