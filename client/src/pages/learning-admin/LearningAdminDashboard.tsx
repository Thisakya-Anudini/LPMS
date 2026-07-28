import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, Globe2, ShieldCheck } from 'lucide-react';
import { learningApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
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

type ChartDatum = {
  label: string;
  value: number;
  color: string;
};

type LearningSummary = {
  totalPaths: number;
  activePaths: number;
  totalEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  totalCertificates: number;
};

const SELECT_LEARNING_PATH_VALUE = '';

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

const clampPercentage = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

function DonutChart({
  value,
  label,
  caption,
  color = '#0ea5e9'
}: {
  value: number;
  label: string;
  caption: string;
  color?: string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const percentage = clampPercentage(value);
  const dashOffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="group relative h-44 w-44 cursor-pointer">
        <div className="absolute inset-3 rounded-full bg-primary-100/70 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
        <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140" role="img" aria-label={`${label}: ${percentage}%`}>
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="14" />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth="14"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="drop-shadow-sm transition-all duration-700 ease-out group-hover:[stroke-width:18]"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-secondary-900 transition-transform duration-300 group-hover:scale-110">{percentage}%</span>
          <span className="mt-1 text-xs font-semibold uppercase text-secondary-500">{label}</span>
        </div>
      </div>
      <p className="max-w-xs text-center text-sm text-secondary-600">{caption}</p>
    </div>
  );
}

function DistributionDonut({ data }: { data: ChartDatum[] }) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;
  const selectedItem = data.find((item) => item.label === selectedLabel) ?? null;

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
      <div className="relative mx-auto h-44 w-44">
        <div className="absolute inset-4 rounded-full bg-primary-100/70 opacity-0 blur-xl transition-opacity duration-300 hover:opacity-100" />
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label="Learning path category distribution">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" strokeWidth="6" />
          {total > 0
            ? data.map((item) => {
                const segment = (item.value / total) * 100;
                const strokeOffset = offset;
                offset -= segment;
                return (
                  <circle
                    key={item.label}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="6"
                    strokeDasharray={`${segment} ${100 - segment}`}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    className={`cursor-pointer transition-all duration-300 hover:opacity-80 hover:[stroke-width:7.5] ${
                      selectedLabel === item.label ? '[stroke-width:7.5] drop-shadow-md' : ''
                    }`}
                    onClick={() => setSelectedLabel(selectedLabel === item.label ? null : item.label)}
                  />
                );
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold text-secondary-900">{formatNumber(selectedItem?.value ?? total)}</span>
          <span className="text-xs font-semibold uppercase text-secondary-500">{selectedItem?.label ?? 'Paths'}</span>
        </div>
      </div>
      <div className="space-y-4">
        {data.map((item) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;

          return (
            <button
              key={item.label}
              type="button"
              className={`w-full space-y-2 rounded-lg p-2 text-left transition-all duration-200 hover:bg-secondary-50 ${
                selectedLabel === item.label ? 'bg-secondary-50 ring-1 ring-secondary-200' : ''
              }`}
              onClick={() => setSelectedLabel(selectedLabel === item.label ? null : item.label)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-secondary-700">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-secondary-900">
                  {formatNumber(item.value)} - {percentage}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary-100">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${percentage}%`, backgroundColor: item.color }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompletionPreview() {
  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
      <div className="relative mx-auto h-48 w-48">
        <div className="absolute inset-4 animate-pulse rounded-full bg-primary-100/70 blur-xl" />
        <svg viewBox="0 0 140 140" className="relative h-full w-full" role="img" aria-label="Learning path completion preview">
          <circle cx="70" cy="70" r="60" fill="none" stroke="#e2e8f0" strokeWidth="12" />
          {/* three equal arcs with small gaps, animated rotation */}
          <g className="origin-center animate-spin [animation-duration:6s]">
            {(() => {
              const radius = 60;
              const circumference = 2 * Math.PI * radius;
              const gap = 6; // small blank between arcs
              const segment = (circumference - 3 * gap) / 3;
              const offsetUnit = segment + gap;

              return (
                <>
                  <circle
                    cx="70"
                    cy="70"
                    r="60"
                    fill="none"
                    stroke="#0ea5e9"
                    strokeLinecap="round"
                    strokeWidth="12"
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    strokeDashoffset={0}
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="60"
                    fill="none"
                    stroke="#f59e0b"
                    strokeLinecap="round"
                    strokeWidth="12"
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    strokeDashoffset={-offsetUnit}
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="60"
                    fill="none"
                    stroke="#22c55e"
                    strokeLinecap="round"
                    strokeWidth="12"
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    strokeDashoffset={-offsetUnit * 2}
                  />
                </>
              );
            })()}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <div className="flex h-18 w-18 items-center justify-center rounded-full bg-sky-100/95 shadow-lg ring-1 ring-sky-200">
            <img src="/assets/ShortLogo2.png" alt="LPMS emblem" className="h-10 w-10 object-contain" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-500">Select A LP</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total assignments', tone: 'bg-primary-50 text-primary-700' },
          { label: 'Completed', tone: 'bg-success-50 text-success-700' },
          { label: 'Certificates', tone: 'bg-warning-50 text-warning-700' }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-secondary-200 bg-secondary-50/60 p-4">
            <div className={`mb-4 h-10 w-10 animate-pulse rounded-lg ${item.tone}`} />
            <p className="text-sm font-medium text-secondary-600">{item.label}</p>
            <div className="mt-3 h-8 w-16 animate-pulse rounded-md bg-secondary-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LearningAdminDashboard() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [completionSummary, setCompletionSummary] = useState<LearningSummary | null>(null);
  const [selectedLearningPathId, setSelectedLearningPathId] = useState(SELECT_LEARNING_PATH_VALUE);
  const [completionLoading, setCompletionLoading] = useState(false);
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

  useEffect(() => {
    if (loading) {
      return;
    }

    if (selectedLearningPathId === SELECT_LEARNING_PATH_VALUE) {
      setCompletionLoading(false);
      setCompletionSummary(null);
      return;
    }

    let isMounted = true;

    const loadPathSummary = async () => {
      try {
        setCompletionLoading(true);
        const token = await getAccessToken();
        if (!token) {
          showToast('Session expired. Please login again.', 'error');
          return;
        }

        const response = await learningApi.getSummaryReport(token, selectedLearningPathId);
        if (isMounted) {
          setCompletionSummary(response.summary);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load learning path summary.';
        showToast(message, 'error');
      } finally {
        if (isMounted) {
          setCompletionLoading(false);
        }
      }
    };

    loadPathSummary();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loading, selectedLearningPathId, showToast]);

  const stats = useMemo(() => {
    const publicCount = paths.filter((path) => path.category === 'PUBLIC').length;
    const restricted = paths.filter((path) => path.category === 'RESTRICTED').length;
    return {
      total: paths.length,
      publicCount,
      restricted
    };
  }, [paths]);

  const completionRate = clampPercentage(completionSummary?.completionRate ?? 0);
  const totalEnrollments = completionSummary?.totalEnrollments ?? 0;
  const completedEnrollments = completionSummary?.completedEnrollments ?? 0;
  const hasSelectedLearningPath = selectedLearningPathId !== SELECT_LEARNING_PATH_VALUE;
  const selectedCompletionLabel = paths.find((path) => path.id === selectedLearningPathId)?.title ?? 'Selected learning path';

  const learningPathOptions = [
    { value: SELECT_LEARNING_PATH_VALUE, label: 'Select A LP' },
    ...paths.map((path) => ({ value: path.id, label: path.title }))
  ];

  const categoryData: ChartDatum[] = [
    { label: 'Public', value: stats.publicCount, color: '#0ea5e9' },
    { label: 'Restricted', value: stats.restricted, color: '#22c55e' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Learning Administration</h1>
        <p className="text-secondary-600 mt-2">Manage learning paths and enrollment readiness.</p>
      </div>

      {error ? <Card className="text-error-600 border-error-200 bg-error-50">{error}</Card> : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {statSkeletons.map((index) => {
          const icons = [BookOpen, Globe2, ShieldCheck];
          const bgClasses = ['bg-primary-100', 'bg-success-100', 'bg-secondary-100'];
          const iconClasses = ['text-primary-600', 'text-success-600', 'text-secondary-600'];
          const labels = ['Total LPs', 'Public LPs', 'Restricted LPs'];
          const Icon = icons[index];

          return (
            <Card
              key={`admin-stat-${labels[index]}`}
              className="p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-medium"
            >
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1fr]">
        <Card
          title="Completion Intelligence"
          description="Learning path assignment completion rate and certificate output."
          className="transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-medium"
          bodyClassName="space-y-6"
          action={
            <div className="w-64">
              <Select
                aria-label="Select learning path completion scope"
                options={learningPathOptions}
                value={selectedLearningPathId}
                onChange={(event) => setSelectedLearningPathId(event.target.value)}
                disabled={loading}
                menuPlacement="bottom"
              />
            </div>
          }
        >
          {loading || completionLoading ? (
            <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
              <Skeleton className="mx-auto h-40 w-40 rounded-full" />
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ) : !hasSelectedLearningPath ? (
            <CompletionPreview />
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-primary-100 bg-primary-50/60 px-4 py-3">
                <p className="text-sm font-semibold text-primary-800">{selectedCompletionLabel}</p>
                <p className="mt-1 text-xs text-secondary-600">Assignment completion and certificates for this view.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
                <DonutChart
                  value={completionRate}
                  label="Completed"
                  caption={`${formatNumber(completedEnrollments)} of ${formatNumber(totalEnrollments)} learning path assignments completed`}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Total assignments', value: totalEnrollments, icon: BookOpen, tone: 'bg-primary-50 text-primary-700' },
                  { label: 'Completed', value: completedEnrollments, icon: CheckCircle2, tone: 'bg-success-50 text-success-700' },
                  { label: 'Certificates', value: completionSummary?.totalCertificates ?? 0, icon: Award, tone: 'bg-warning-50 text-warning-700' }
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="group rounded-lg border border-secondary-200 bg-secondary-50/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:bg-white hover:shadow-soft"
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${item.tone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-secondary-600">{item.label}</p>
                      <p className="mt-1 text-2xl font-bold text-secondary-900">
                        {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
                      </p>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Path Mix"
          description="Public and restricted learning path distribution."
          className="transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-medium"
        >
          {loading ? <Skeleton className="h-52 w-full" /> : <DistributionDonut data={categoryData} />}
        </Card>
      </div>
    </div>
  );
}
