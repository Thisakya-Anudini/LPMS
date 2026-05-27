import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Globe2, ShieldCheck } from 'lucide-react';
import { learningApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
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
  const statSkeletons = Array.from({ length: 3 }, (_, index) => index);

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
    const restricted = paths.filter((path) => path.category === 'RESTRICTED').length;
    return {
      total: paths.length,
      active,
      publicCount,
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statSkeletons.map((index) => {
          const icons = [BookOpen, Globe2, ShieldCheck];
          const bgClasses = ['bg-primary-100', 'bg-success-100', 'bg-secondary-100'];
          const iconClasses = ['text-primary-600', 'text-success-600', 'text-secondary-600'];
          const labels = ['Total LPs', 'Public LPs', 'Restricted LPs'];
          const Icon = icons[index];

          return (
            <Card key={`admin-stat-${labels[index]}`} className="p-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgClasses[index]}`}>
                  <Icon className={`h-6 w-6 ${iconClasses[index]}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-secondary-600">{labels[index]}</p>
                  {loading ? (
                    <Skeleton className="mt-2 h-9 w-20" />
                  ) : (
                    <p className="text-3xl font-bold text-secondary-900">
                      {index === 0
                        ? summary?.totalPaths ?? stats.total
                        : index === 1
                          ? stats.publicCount
                          : stats.restricted}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
