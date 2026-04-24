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
        <h1 className="text-2xl font-bold text-slate-900">Learning Administration</h1>
        <p className="text-slate-500">Manage learning paths and enrollment readiness.</p>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Total LPs</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : summary?.totalPaths ?? stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Globe2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Public LPs</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : stats.publicCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm text-slate-500">Semi-restricted LPs</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : stats.semiRestricted}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm text-slate-500">Restricted LPs</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? '...' : stats.restricted}</p>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}
