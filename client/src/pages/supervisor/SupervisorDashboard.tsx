import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { learnerApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type TeamMember = {
  employeeNumber: string;
  name: string;
  designation: string;
  gradeName: string;
};

type LearningPath = {
  id: string;
  title: string;
  description: string;
};

const getEmployeeDisplayName = (row: Record<string, unknown>) => {
  const employeeName = typeof row.employeeName === 'string' ? row.employeeName.trim() : '';
  if (employeeName) {
    return employeeName;
  }
  const initials = typeof row.employeeInitials === 'string' ? row.employeeInitials.trim() : '';
  const surname = typeof row.employeeSurname === 'string' ? row.employeeSurname.trim() : '';
  const merged = `${initials} ${surname}`.trim();
  return merged || 'Learner';
};

export function SupervisorDashboard() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [selectedLearningPathId, setSelectedLearningPathId] = useState('');
  const [selectedTeamNumbers, setSelectedTeamNumbers] = useState<string[]>([]);
  const [employeeNoSearch, setEmployeeNoSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState('ALL');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const [teamResponse, learningPathResponse] = await Promise.all([
        learnerApi.getTeam(token),
        learnerApi.getLearningPaths(token)
      ]);

      if (!teamResponse.isSupervisor) {
        const message = 'Supervisor access is not enabled for this account.';
        setError(message);
        showToast(message, 'error');
        setTeam([]);
        setLearningPaths([]);
        return;
      }

      setTeam(
        (teamResponse.team || []).map((row) => ({
          employeeNumber: String(row.employeeNumber || ''),
          name: getEmployeeDisplayName(row),
          designation: String(row.designation || '-'),
          gradeName: String(row.gradeName || '-')
        }))
      );
      setLearningPaths(learningPathResponse.learningPaths);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load supervisor dashboard.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    return {
      teamCount: team.length,
      availablePathCount: learningPaths.length
    };
  }, [team.length, learningPaths.length]);

  const designationOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        team
          .map((member) => member.designation.trim())
          .filter((value) => value.length > 0 && value !== '-')
      )
    ).sort((a, b) => a.localeCompare(b));
    return ['ALL', ...values];
  }, [team]);

  const filteredTeam = useMemo(() => {
    const employeeNoTerm = employeeNoSearch.trim().toLowerCase();
    const nameTerm = nameSearch.trim().toLowerCase();

    return team.filter((member) => {
      const byEmployeeNo = !employeeNoTerm || member.employeeNumber.toLowerCase().includes(employeeNoTerm);
      const byName = !nameTerm || member.name.toLowerCase().includes(nameTerm);
      const byDesignation = designationFilter === 'ALL' || member.designation === designationFilter;
      return byEmployeeNo && byName && byDesignation;
    });
  }, [designationFilter, employeeNoSearch, nameSearch, team]);

  const toggleTeamMember = (employeeNumber: string) => {
    setSelectedTeamNumbers((prev) =>
      prev.includes(employeeNumber)
        ? prev.filter((id) => id !== employeeNumber)
        : [...prev, employeeNumber]
    );
  };

  const selectAllFiltered = () => {
    const filteredNumbers = filteredTeam.map((member) => member.employeeNumber);
    setSelectedTeamNumbers((prev) => {
      const next = new Set(prev);
      filteredNumbers.forEach((employeeNumber) => next.add(employeeNumber));
      return Array.from(next);
    });
  };

  const clearAllFiltered = () => {
    const filteredSet = new Set(filteredTeam.map((member) => member.employeeNumber));
    setSelectedTeamNumbers((prev) => prev.filter((employeeNumber) => !filteredSet.has(employeeNumber)));
  };

  const handleAssign = async () => {
    if (!selectedLearningPathId || selectedTeamNumbers.length === 0) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const result = await learnerApi.enrollTeam(token, {
        employeeNumbers: selectedTeamNumbers,
        learningPathIds: [selectedLearningPathId]
      });
      showToast(`Assigned learning path to ${result.assignedCount} learner(s).`, 'success');
      setSelectedTeamNumbers([]);
      setSelectedLearningPathId('');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign learning paths to learners.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supervisor Dashboard</h1>
        <p className="text-slate-500">Assign learning paths to team learners under your supervision.</p>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Team Learners</p>
          <p className="text-2xl font-bold text-slate-900">{loading ? '...' : stats.teamCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Available Learning Paths</p>
          <p className="text-2xl font-bold text-slate-900">{loading ? '...' : stats.availablePathCount}</p>
        </Card>
      </div>

      <Card title="Assign Learning Paths">
        <div className="space-y-4">
          <Select
            label="Learning Path"
            value={selectedLearningPathId}
            onChange={(event) => setSelectedLearningPathId(event.target.value)}
            options={[
              { value: '', label: 'Select a learning path' },
              ...learningPaths.map((path) => ({ value: path.id, label: path.title }))
            ]}
          />

          <div className="max-h-80 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-2 border-b border-slate-200 mb-2">
              <Input
                label="Search by Employee No"
                value={employeeNoSearch}
                onChange={(event) => setEmployeeNoSearch(event.target.value)}
                placeholder="e.g. 011338"
              />
              <Input
                label="Search by Name"
                value={nameSearch}
                onChange={(event) => setNameSearch(event.target.value)}
                placeholder="e.g. Tennakoon"
              />
              <Select
                label="Filter by Designation"
                value={designationFilter}
                onChange={(event) => setDesignationFilter(event.target.value)}
                options={designationOptions.map((option) => ({ value: option, label: option }))}
              />
            </div>

            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-xs text-slate-500">
                Filtered learners: {filteredTeam.length} | Selected: {selectedTeamNumbers.length}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selectAllFiltered} disabled={filteredTeam.length === 0}>
                  Select All Filtered
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={clearAllFiltered} disabled={filteredTeam.length === 0}>
                  Clear Filtered
                </Button>
              </div>
            </div>

            {team.length === 0 ? (
              <p className="text-sm text-slate-500 p-2">No learners found under this supervisor.</p>
            ) : filteredTeam.length === 0 ? (
              <p className="text-sm text-slate-500 p-2">No learners match current filters.</p>
            ) : (
              filteredTeam.map((member) => (
                <label
                  key={member.employeeNumber}
                  className="flex items-start gap-3 p-2 rounded hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedTeamNumbers.includes(member.employeeNumber)}
                    onChange={() => toggleTeamMember(member.employeeNumber)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      {member.name} ({member.employeeNumber})
                    </span>
                    <span className="block text-xs text-slate-500">
                      {member.designation} | {member.gradeName}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>

          <Button
            onClick={handleAssign}
            isLoading={saving}
            disabled={!selectedLearningPathId || selectedTeamNumbers.length === 0}
          >
            Assign Learning Path to Selected Learners
          </Button>
        </div>
      </Card>
    </div>
  );
}