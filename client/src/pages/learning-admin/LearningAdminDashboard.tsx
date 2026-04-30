import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Globe2, Layers, ShieldCheck } from 'lucide-react';
import { learningApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type LearningPathRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  total_duration: string;
  status: string;
};

export function LearningAdminDashboard() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
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

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const token = await getAccessToken();
        if (!token) {
          showToast('Session expired. Please login again.', 'error');
          return;
        }

        const [pathsResponse, summaryResponse] = await Promise.all([
          learningApi.getLearningPaths(token),
          learningApi.getSummaryReport(token)
        ]);
        setPaths(pathsResponse.learningPaths);
        setSummary(summaryResponse.summary);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load learning paths.';
        setError(message);
        showToast(message, 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [getAccessToken, showToast]);

  const stats = useMemo(() => {
    const active = paths.filter((path) => path.status === 'ACTIVE').length;
    const publicCount = paths.filter((path) => path.category === 'PUBLIC').length;
    const semiRestricted = paths.filter((path) => path.category === 'SEMI_RESTRICTED').length;
    const restricted = paths.filter((path) => path.category === 'RESTRICTED').length;
    return {
      total: paths.length,
      active,
      publicCount,
      semiRestricted,
      restricted
    };
  }, [paths]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Learning Administration</h1>
        <p className="text-secondary-600 mt-2">Manage learning paths and enrollment readiness.</p>
      </div>

      {error ? <Card className="text-error-600 border-error-200 bg-error-50">{error}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
              <BookOpen className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-600">Total LPs</p>
              <p className="text-3xl font-bold text-secondary-900">{loading ? '...' : summary?.totalPaths ?? stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-100">
              <Globe2 className="h-6 w-6 text-success-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-600">Public LPs</p>
              <p className="text-3xl font-bold text-secondary-900">{loading ? '...' : stats.publicCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning-100">
              <Layers className="h-6 w-6 text-warning-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-600">Semi-restricted LPs</p>
              <p className="text-3xl font-bold text-secondary-900">{loading ? '...' : stats.semiRestricted}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-100">
              <ShieldCheck className="h-6 w-6 text-secondary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-600">Restricted LPs</p>
              <p className="text-3xl font-bold text-secondary-900">{loading ? '...' : stats.restricted}</p>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}
