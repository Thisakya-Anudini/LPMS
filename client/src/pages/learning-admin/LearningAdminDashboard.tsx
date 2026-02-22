import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle, Layers } from 'lucide-react';
import { integrationApi, learningApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/useAuth';

type LearningPathRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  total_duration: string;
  status: string;
};

type ErpEmployee = {
  employeeNumber: string;
  employeeTitle?: string | null;
  employeeFirstName?: string | null;
  employeeInitials?: string | null;
  employeeSurname?: string | null;
  designation?: string | null;
  employeeName?: string | null;
  gradeName?: string | null;
  email?: string | null;
};

type ErpResponseShape = {
  success?: boolean;
  message?: string;
  data?: ErpEmployee[];
};

const toDisplayName = (employee: ErpEmployee) => {
  if (employee.employeeName && employee.employeeName.trim()) {
    return employee.employeeName.trim();
  }
  const initials = employee.employeeInitials?.trim() || '';
  const surname = employee.employeeSurname?.trim() || '';
  const merged = `${initials} ${surname}`.trim();
  return merged || employee.employeeNumber;
};

export function LearningAdminDashboard() {
  const { getAccessToken } = useAuth();
  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [summary, setSummary] = useState<{
    totalPaths: number;
    activePaths: number;
    totalEnrollments: number;
    completedEnrollments: number;
    completionRate: number;
    totalCertificates: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeNo, setEmployeeNo] = useState('');
  const [erpLoading, setErpLoading] = useState(false);
  const [erpError, setErpError] = useState<string | null>(null);
  const [erpMessage, setErpMessage] = useState<string | null>(null);
  const [erpData, setErpData] = useState<ErpResponseShape | null>(null);

  const [selectedEmployeeNumbers, setSelectedEmployeeNumbers] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const token = await getAccessToken();
        if (!token) {
          setError('Session expired. Please login again.');
          return;
        }

        const [pathsResponse, summaryResponse] = await Promise.all([
          learningApi.getLearningPaths(token),
          learningApi.getSummaryReport(token)
        ]);
        setPaths(pathsResponse.learningPaths);
        setSummary(summaryResponse.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load learning paths.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [getAccessToken]);

  const stats = useMemo(() => {
    const active = paths.filter((path) => path.status === 'ACTIVE').length;
    const restricted = paths.filter((path) => path.category === 'RESTRICTED').length;
    return {
      total: paths.length,
      active,
      restricted
    };
  }, [paths]);

  const erpEmployees = useMemo(() => {
    if (!erpData?.data || !Array.isArray(erpData.data)) {
      return [];
    }
    return erpData.data;
  }, [erpData]);

  const selectedEmployees = useMemo(
    () => erpEmployees.filter((employee) => selectedEmployeeNumbers.includes(employee.employeeNumber)),
    [erpEmployees, selectedEmployeeNumbers]
  );

  const handleLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErpLoading(true);
    setErpError(null);
    setErpMessage(null);
    setImportResult(null);
    setErpData(null);
    setSelectedEmployeeNumbers([]);

    try {
      const token = await getAccessToken();
      if (!token) {
        setErpError('Session expired. Please login again.');
        return;
      }

      const response = await integrationApi.getErpSubordinates(token, employeeNo.trim());
      const normalized = (response.data || null) as ErpResponseShape | null;
      setErpData(normalized);
      setErpMessage(normalized?.message || 'ERP data fetched successfully.');
    } catch (err) {
      setErpError(err instanceof Error ? err.message : 'Failed to fetch ERP subordinate details.');
    } finally {
      setErpLoading(false);
    }
  };

  const toggleEmployee = (employeeNumber: string) => {
    setSelectedEmployeeNumbers((prev) =>
      prev.includes(employeeNumber)
        ? prev.filter((number) => number !== employeeNumber)
        : [...prev, employeeNumber]
    );
  };

  const toggleAll = () => {
    if (selectedEmployeeNumbers.length === erpEmployees.length) {
      setSelectedEmployeeNumbers([]);
      return;
    }
    setSelectedEmployeeNumbers(erpEmployees.map((employee) => employee.employeeNumber));
  };

  const handleImport = async () => {
    setImportLoading(true);
    setErpError(null);
    setImportResult(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErpError('Session expired. Please login again.');
        return;
      }

      const response = await integrationApi.importErpEmployees(token, {
        employees: selectedEmployees
      });

      setImportResult(
        `Import complete: ${response.importedCount} imported, ${response.skippedCount} skipped.`
      );
    } catch (err) {
      setErpError(err instanceof Error ? err.message : 'Failed to import ERP employees.');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Learning Administration</h1>
        <p className="text-slate-500">Manage learning paths and enrollment readiness.</p>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Total Learning Paths</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : summary?.totalPaths ?? stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Active Paths</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : summary?.activePaths ?? stats.active}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm text-slate-500">Restricted Paths</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : stats.restricted}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm text-slate-500">Completion Rate</p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '...' : `${summary?.completionRate ?? 0}%`}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Recent Learning Paths">
        <div className="space-y-3">
          {paths.slice(0, 8).map((path) => (
            <div key={path.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="font-medium text-slate-900">{path.title}</p>
              <p className="text-xs text-slate-500 mt-1">{path.description}</p>
              <p className="text-xs text-slate-600 mt-2">
                {path.category.replace('_', ' ')} | {path.total_duration} | {path.status}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="ERP Subordinates Lookup">
        <form className="space-y-4" onSubmit={handleLookup}>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              name="employeeNo"
              label="Employee No"
              placeholder="e.g. 011338"
              value={employeeNo}
              onChange={(event) => setEmployeeNo(event.target.value)}
              required
            />
            <div className="sm:pt-6">
              <Button type="submit" isLoading={erpLoading} disabled={!employeeNo.trim()}>
                Fetch from ERP
              </Button>
            </div>
          </div>
        </form>

        {erpError ? <p className="text-sm text-red-600 mt-4">{erpError}</p> : null}
        {erpMessage ? <p className="text-sm text-green-700 mt-4">{erpMessage}</p> : null}
        {importResult ? <p className="text-sm text-green-700 mt-2">{importResult}</p> : null}

        {erpEmployees.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                {erpEmployees.length} subordinates returned
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={toggleAll}>
                  {selectedEmployeeNumbers.length === erpEmployees.length ? 'Unselect All' : 'Select All'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isLoading={importLoading}
                  onClick={handleImport}
                  disabled={selectedEmployeeNumbers.length === 0}
                >
                  Import Selected ({selectedEmployeeNumbers.length})
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Employee No</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Designation</th>
                    <th className="px-3 py-2">Grade</th>
                    <th className="px-3 py-2">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {erpEmployees.map((employee) => (
                    <tr key={employee.employeeNumber} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedEmployeeNumbers.includes(employee.employeeNumber)}
                          onChange={() => toggleEmployee(employee.employeeNumber)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{employee.employeeNumber}</td>
                      <td className="px-3 py-2 text-slate-700">{toDisplayName(employee)}</td>
                      <td className="px-3 py-2 text-slate-600">{employee.designation || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{employee.gradeName || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{employee.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
