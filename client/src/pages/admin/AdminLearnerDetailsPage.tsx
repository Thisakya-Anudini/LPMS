import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Clock3, Mail, PlayCircle, UserRound } from 'lucide-react';
import { superAdminApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

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

const formatLabel = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());

const getPathStatus = (path: LearnerPath) => {
  const progress = Math.min(100, Math.max(0, Number(path.progress || 0)));
  if (progress === 100 || path.status.toUpperCase() === 'COMPLETED') {
    return { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10', progressVariant: 'success' as const };
  }
  if (progress > 0) {
    return { label: 'In progress', className: 'bg-amber-50 text-amber-700 ring-amber-600/10', progressVariant: 'warning' as const };
  }
  return { label: 'Not started', className: 'bg-slate-100 text-slate-600 ring-slate-500/10', progressVariant: 'default' as const };
};

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : null;

export function AdminLearnerDetailsPage() {
  const { principalId } = useParams();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [learner, setLearner] = useState<{ id: string; name: string; email: string } | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearnerPath[]>([]);

  const loadDetails = useCallback(async () => {
    if (!principalId) {
      return;
    }
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await superAdminApi.getLearnerLearningPaths(token, principalId);
      setLearner({
        id: response.learner.id,
        name: response.learner.name,
        email: response.learner.email
      });
      setLearningPaths(response.learningPaths);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load learner learning paths.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, principalId, showToast]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const completedPaths = learningPaths.filter((path) => Number(path.progress || 0) >= 100 || path.status.toUpperCase() === 'COMPLETED').length;
  const averageProgress = learningPaths.length ? Math.round(learningPaths.reduce((total, path) => total + Number(path.progress || 0), 0) / learningPaths.length) : 0;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary-700"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100"><BookOpen className="h-4 w-4" /></span>Learner directory</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Learner Details</h1>
          <p className="mt-1 text-slate-500">Review assigned learning paths and completion progress.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/learners')}>
          <ArrowLeft className="h-4 w-4" /> Back to Learners
        </Button>
      </div>

      <Card className="overflow-visible border-primary-100 shadow-sm" bodyClassName="p-0">
        {loading ? (
          <div className="flex items-center gap-4 p-6"><Skeleton className="h-16 w-16 rounded-full" /><div><Skeleton className="h-6 w-44" /><Skeleton className="mt-2 h-4 w-60" /></div></div>
        ) : !learner ? (
          <div className="p-8 text-center"><UserRound className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium text-slate-700">Learner not found</p><p className="mt-1 text-sm text-slate-500">This learner may no longer be available.</p></div>
        ) : (
          <div className="grid lg:grid-cols-[1.25fr_1fr]">
            <div className="flex items-center gap-4 p-6 lg:border-r lg:border-slate-100">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-8 ring-sky-50/60"><UserRound className="h-8 w-8" strokeWidth={1.65} /></div>
              <div className="min-w-0"><p className="text-xl font-bold text-slate-900">{learner.name}</p><p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-500"><Mail className="h-4 w-4 shrink-0" />{learner.email}</p></div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 lg:border-t-0">
              {[['Assigned', learningPaths.length, 'text-primary-700'], ['Completed', completedPaths, 'text-emerald-600']].map(([label, value, className]) => <div key={label as string} className="px-3 py-5 text-center"><p className={`text-2xl font-bold ${className}`}>{value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p></div>)}
            </div>
          </div>
        )}
      </Card>

      <Card className="shadow-sm" bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Assigned Learning Paths</h2><p className="mt-1 text-sm text-slate-500">Learning plans currently assigned to this learner.</p></div>{!loading && learningPaths.length > 0 && <div className="rounded-xl bg-primary-50 px-4 py-2 text-right"><p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Average progress</p><p className="text-xl font-bold text-primary-900">{averageProgress}%</p></div>}</div>
        {loading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }, (_, index) => <div key={index} className="rounded-xl border border-slate-100 p-5"><Skeleton className="h-5 w-56" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-3 h-4 w-40" /></div>)}</div>
        ) : learningPaths.length === 0 ? (
          <div className="p-12 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><BookOpen className="h-6 w-6" /></div><p className="font-medium text-slate-700">No learning paths assigned</p><p className="mt-1 text-sm text-slate-500">This learner has not been assigned a learning path yet.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {learningPaths.map((path) => {
              const pathStatus = getPathStatus(path);
              const enrolledOn = formatDate(path.enrolled_at);
              const completedOn = formatDate(path.completed_at);
              return <div key={path.enrollment_id} className="p-5 transition-colors hover:bg-slate-50/70 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold text-slate-900">{path.title}</p><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${pathStatus.className}`}>{pathStatus.label === 'Completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}{pathStatus.label}</span></div>{path.description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{path.description}</p>}</div>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{formatLabel(path.category)}</span>
                </div>
                <div className="mt-5 max-w-3xl"><ProgressBar progress={Number(path.progress || 0)} showLabel size="sm" variant={pathStatus.progressVariant} /></div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-slate-400" />{path.total_duration || 'Duration not set'}</span>{enrolledOn && <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-400" />Assigned {enrolledOn}</span>}{completedOn && <span className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Completed {completedOn}</span>}</div>
              </div>;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
