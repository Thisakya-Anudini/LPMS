import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Download,
  Eye,
  Share2,
  Search,
  Calendar,
  Clock,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Trophy,
  LayoutGrid,
  List,
  ArrowUpDown,
  RefreshCw,
  Printer,
  BookOpen,
  ArrowRight,
  Filter,
  X,
  Medal,
  GraduationCap
} from 'lucide-react';
import { learnerApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type CertificateRow = {
  id: string;
  scope: 'STAGE' | 'FULL';
  issued_at: string;
  learning_path_id: string;
  learning_path_title: string;
  learning_path_description: string;
  learning_path_duration: string;
  learner_name: string;
  learner_email: string;
  completed_at: string | null;
};

type ViewMode = 'grid' | 'list';
type ScopeFilter = 'ALL' | 'FULL' | 'STAGE';
type SortOption = 'newest' | 'oldest' | 'title' | 'duration';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

// Helper to parse numeric hours from duration strings like "86.1 hours", "10h", "45 mins"
const parseHours = (durationStr?: string): number => {
  if (!durationStr) return 0;
  const str = durationStr.toLowerCase().trim();
  const match = str.match(/([\d.]+)/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  if (isNaN(val)) return 0;
  if (str.includes('min')) {
    return val / 60;
  }
  return val;
};

export function LearnerCertificatesPage() {
  const { getAccessToken, user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  
  // Filtering, Searching & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Preview Modal State
  const [previewState, setPreviewState] = useState<{
    certificate: CertificateRow;
    url: string | null;
    error: string | null;
  } | null>(null);

  // Share / Credential Modal State
  const [shareModalCert, setShareModalCert] = useState<CertificateRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedShareText, setCopiedShareText] = useState(false);

  const previewUrlRef = useRef<string | null>(null);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      window.URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learnerApi.getCertificates(token);
      setCertificates(response.certificates || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load certificates.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => revokePreviewUrl(), [revokePreviewUrl]);

  // Handle Certificate Download
  const handleDownload = async (certificate: CertificateRow) => {
    try {
      setDownloadingId(certificate.id);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const blob = await learnerApi.downloadCertificate(token, certificate.id);
      const safeTitle = certificate.learning_path_title.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      downloadBlob(blob, `certificate_${safeTitle}_${certificate.id}.pdf`);
      showToast('Certificate downloaded successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download certificate.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Certificate Preview
  const handlePreview = async (certificate: CertificateRow) => {
    try {
      setPreviewingId(certificate.id);
      revokePreviewUrl();
      setPreviewState({
        certificate,
        url: null,
        error: null
      });

      const token = await getAccessToken();
      if (!token) {
        setPreviewState({
          certificate,
          url: null,
          error: 'Session expired. Please login again.'
        });
        return;
      }

      const blob = await learnerApi.downloadCertificate(token, certificate.id);
      const previewUrl = window.URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;
      setPreviewState({
        certificate,
        url: previewUrl,
        error: null
      });
    } catch (err) {
      setPreviewState({
        certificate,
        url: null,
        error: err instanceof Error ? err.message : 'Failed to load certificate preview.'
      });
    } finally {
      setPreviewingId(null);
    }
  };

  const closePreview = () => {
    revokePreviewUrl();
    setPreviewState(null);
  };

  const handlePrint = () => {
    if (previewUrlRef.current) {
      const printWindow = window.open(previewUrlRef.current);
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
    }
  };

  const handleOpenInNewTab = () => {
    if (previewUrlRef.current) {
      window.open(previewUrlRef.current, '_blank');
    }
  };

  // Copy ID to clipboard
  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast('Credential ID copied to clipboard.', 'success');
    setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current));
    }, 2000);
  };

  // Copy LinkedIn / Share text
  const handleCopyShareText = (cert: CertificateRow) => {
    const text = `🎓 I'm proud to share that I have earned the "${cert.learning_path_title}" certificate from the SLT Learning Portal!\n\nCredential ID: ${cert.id}\nIssued: ${new Date(cert.issued_at).toLocaleDateString()}\nScope: ${cert.scope === 'FULL' ? 'Full Learning Path' : 'Stage Milestone'}`;
    navigator.clipboard.writeText(text);
    setCopiedShareText(true);
    showToast('Achievement summary copied to clipboard! Ready to paste into LinkedIn or resume.', 'success');
    setTimeout(() => setCopiedShareText(false), 2500);
  };

  // Analytics & Summary Metrics
  const stats = useMemo(() => {
    const total = certificates.length;
    const fullPaths = certificates.filter((c) => c.scope === 'FULL').length;
    const stages = certificates.filter((c) => c.scope === 'STAGE').length;
    const totalHours = certificates.reduce((acc, c) => acc + parseHours(c.learning_path_duration), 0);
    const latestCert = certificates.length > 0 
      ? [...certificates].sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime())[0]
      : null;

    return {
      total,
      fullPaths,
      stages,
      totalHours: Math.round(totalHours * 10) / 10,
      latestCert
    };
  }, [certificates]);

  // Filtered & Sorted Certificates
  const filteredCertificates = useMemo(() => {
    return certificates
      .filter((cert) => {
        // Scope filter
        if (scopeFilter === 'FULL' && cert.scope !== 'FULL') return false;
        if (scopeFilter === 'STAGE' && cert.scope !== 'STAGE') return false;

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = cert.learning_path_title?.toLowerCase().includes(q);
          const matchId = cert.id?.toLowerCase().includes(q);
          const matchLearner = cert.learner_name?.toLowerCase().includes(q) || cert.learner_email?.toLowerCase().includes(q);
          const matchDesc = cert.learning_path_description?.toLowerCase().includes(q);
          return matchTitle || matchId || matchLearner || matchDesc;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime();
        }
        if (sortBy === 'title') {
          return a.learning_path_title.localeCompare(b.learning_path_title);
        }
        if (sortBy === 'duration') {
          return parseHours(b.learning_path_duration) - parseHours(a.learning_path_duration);
        }
        return 0;
      });
  }, [certificates, scopeFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Hero Banner & Overview */}
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(90deg,#034c96_0%,#0563bb_25%,#3faa45_98%,#3faa45_100%)] p-4 sm:p-5 text-white shadow-md border border-white/20">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
              <span>SLT Official Digital Credentials</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              My Certificates & Achievements
              <Sparkles className="h-5 w-5 text-amber-300 hidden sm:inline-block" />
            </h1>
            <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
              Verifiable credentials awarded upon completing 100% of your learning paths. Download, preview, or share your accredited professional achievements.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              to="/learner/my-progress"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-100 active:scale-[0.98]"
            >
              <BookOpen className="h-3.5 w-3.5 text-slate-900" />
              <span>My Learning</span>
            </Link>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-3 transition-all hover:bg-white/15">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/80">Total Certificates</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-amber-300">
                <Trophy className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold text-white">{loading ? '...' : stats.total}</p>
            <p className="mt-0.5 text-[10px] text-white/75 flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-300" />
              Accredited credentials
            </p>
          </div>

          <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-3 transition-all hover:bg-white/15">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/80">Certified Hours</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-amber-200">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold text-white">{loading ? '...' : `${stats.totalHours}h`}</p>
            <p className="mt-0.5 text-[10px] text-white/75">Dedicated learning time</p>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sorters & View Switcher */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-soft">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, description, learner, or certificate ID..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-9 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
          <button
            onClick={() => setScopeFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
              scopeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({certificates.length})
          </button>
          <button
            onClick={() => setScopeFilter('FULL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              scopeFilter === 'FULL'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Full Path ({stats.fullPaths})
          </button>
          <button
            onClick={() => setScopeFilter('STAGE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              scopeFilter === 'STAGE'
                ? 'bg-primary-700 text-white shadow-sm'
                : 'bg-primary-50 text-primary-800 hover:bg-primary-100 border border-primary-200/60'
            }`}
          >
            <Medal className="h-3.5 w-3.5" />
            Stage Milestone ({stats.stages})
          </button>
        </div>

        {/* Sorting & View Mode Switcher */}
        <div className="flex items-center gap-3 self-end lg:self-auto">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title (A-Z)</option>
              <option value="duration">Duration (High-Low)</option>
            </select>
          </div>

          <div className="h-5 w-px bg-slate-200" />

          {/* Grid vs List View Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 transition-all ${
                viewMode === 'grid' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md p-1.5 transition-all ${
                viewMode === 'list' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {[1, 2, 3].map((index) => (
            <div
              key={`certificate-skeleton-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"
            >
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <div className="space-y-2 mb-6">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 flex-1 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : certificates.length === 0 ? (
        /* Empty State: No certificates yet */
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/60 p-8 sm:p-12 text-center shadow-soft">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary-600 shadow-inner">
            <Trophy className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">No Certificates Earned Yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
            Your official certificates are issued automatically as soon as your learning path completion reaches 100%. Complete your enrolled courses to unlock credentials!
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 mb-2">1</span>
              <p className="text-sm font-semibold text-slate-900">Enroll in a Path</p>
              <p className="text-xs text-slate-500 mt-1">Select from public or company assigned training paths.</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 mb-2">2</span>
              <p className="text-sm font-semibold text-slate-900">Complete 100%</p>
              <p className="text-xs text-slate-500 mt-1">Finish every module, quiz, and course material.</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 mb-2">3</span>
              <p className="text-sm font-semibold text-slate-900">Get Certified</p>
              <p className="text-xs text-slate-500 mt-1">Download and share your accredited PDF certificate.</p>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Link to="/learner/my-progress">
              <Button className="bg-primary-700 hover:bg-primary-800 text-white shadow-md">
                Resume My Learning
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      ) : filteredCertificates.length === 0 ? (
        /* Empty State: Search / Filter query returned 0 */
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">No Certificates Found</h3>
          <p className="mt-1 text-xs text-slate-500">
            No credentials match your search "{searchQuery}" or selected scope filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setScopeFilter('ALL');
            }}
            className="mt-4"
          >
            Clear All Filters
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= GRID VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCertificates.map((certificate) => {
            const isFull = certificate.scope === 'FULL';
            const issueDateStr = new Date(certificate.issued_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
            const completedDateStr = certificate.completed_at
              ? new Date(certificate.completed_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })
              : issueDateStr;

            return (
              <div
                key={certificate.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-0 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-large overflow-hidden"
              >
                {/* Top Certificate Header Banner with Accent */}
                <div
                  className={`px-5 py-4 flex items-center justify-between text-white relative overflow-hidden ${
                    isFull
                      ? 'bg-gradient-to-r from-emerald-800 via-teal-800 to-cyan-900'
                      : 'bg-gradient-to-r from-slate-900 via-primary-950 to-indigo-950'
                  }`}
                >
                  <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none">
                    <Award className="h-28 w-28 text-white" />
                  </div>

                  <div className="flex items-center gap-2 z-10">
                    <div className={`p-1.5 rounded-lg backdrop-blur-md ${isFull ? 'bg-emerald-500/30' : 'bg-primary-500/30'}`}>
                      <Award className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-200">
                        {isFull ? 'Mastery Credential' : 'Milestone Credential'}
                      </span>
                      <p className="text-xs font-bold text-white leading-none">SLT Learning Portal</p>
                    </div>
                  </div>

                  <span
                    className={`z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border backdrop-blur-md ${
                      isFull
                        ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40'
                        : 'bg-primary-400/20 text-primary-200 border-primary-300/40'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {isFull ? 'Full Path' : 'Stage'}
                  </span>
                </div>

                {/* Certificate Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Path Title */}
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-primary-700 transition-colors line-clamp-2">
                      {certificate.learning_path_title}
                    </h3>
                    {certificate.learning_path_description ? (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {certificate.learning_path_description}
                      </p>
                    ) : null}

                    {/* Learner Info Pill */}
                    <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 uppercase shrink-0">
                        {certificate.learner_name.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{certificate.learner_name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{certificate.learner_email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Meta Details Grid */}
                  <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Completed Date:
                      </span>
                      <span className="font-medium text-slate-700">{completedDateStr}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Course Duration:
                      </span>
                      <span className="font-medium text-slate-700">{certificate.learning_path_duration || 'Self-paced'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Credential ID:</span>
                      <button
                        onClick={(e) => handleCopyId(certificate.id, e)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 hover:text-primary-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                        title="Click to copy Credential ID"
                      >
                        {certificate.id.slice(0, 8)}...
                        {copiedId === certificate.id ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="p-4 pt-0 border-t border-slate-100 mt-2 bg-slate-50/50 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-primary-700"
                    onClick={() => handlePreview(certificate)}
                    isLoading={previewingId === certificate.id}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    className={`flex-1 text-xs ${
                      isFull ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-primary-700 hover:bg-primary-800'
                    }`}
                    onClick={() => handleDownload(certificate)}
                    isLoading={downloadingId === certificate.id}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download
                  </Button>

                  <button
                    onClick={() => setShareModalCert(certificate)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                    title="Share Credential"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= LIST VIEW ================= */
        <div className="space-y-3">
          {filteredCertificates.map((certificate) => {
            const isFull = certificate.scope === 'FULL';
            const issueDateStr = new Date(certificate.issued_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            return (
              <div
                key={certificate.id}
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-soft transition-all duration-200 hover:border-primary-300 hover:shadow-medium flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                      isFull
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-primary-100 text-primary-700 border border-primary-200'
                    }`}
                  >
                    <Award className="h-6 w-6" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-base">{certificate.learning_path_title}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                          isFull
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {isFull ? 'Full Path Credential' : 'Stage Milestone'}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Learner: <strong className="text-slate-700">{certificate.learner_name}</strong></span>
                      <span>•</span>
                      <span>Issued: <strong className="text-slate-700">{issueDateStr}</strong></span>
                      <span>•</span>
                      <span>Duration: <strong className="text-slate-700">{certificate.learning_path_duration || 'Self-paced'}</strong></span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">ID:</span>
                      <code className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {certificate.id}
                      </code>
                      <button
                        onClick={(e) => handleCopyId(certificate.id, e)}
                        className="text-slate-400 hover:text-primary-600"
                        title="Copy ID"
                      >
                        {copiedId === certificate.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(certificate)}
                    isLoading={previewingId === certificate.id}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className={isFull ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-primary-700 hover:bg-primary-800'}
                    onClick={() => handleDownload(certificate)}
                    isLoading={downloadingId === certificate.id}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download PDF
                  </Button>
                  <button
                    onClick={() => setShareModalCert(certificate)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                    title="Share Credential"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: CERTIFICATE PREVIEW ================= */}
      {previewState ? (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col border border-slate-200">
            {/* Modal Header Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {previewState.certificate.learning_path_title}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      <ShieldCheck className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Issued to {previewState.certificate.learner_name} on{' '}
                    {new Date(previewState.certificate.issued_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons in Modal Toolbar */}
              <div className="flex items-center gap-2">
                {previewState.url ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrint}
                      className="hidden sm:inline-flex"
                      title="Print Certificate"
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      Print
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenInNewTab}
                      className="hidden sm:inline-flex"
                      title="Open in new window"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleDownload(previewState.certificate)}
                      isLoading={downloadingId === previewState.certificate.id}
                      className="bg-primary-700 hover:bg-primary-800 text-white"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download PDF
                    </Button>
                  </>
                ) : null}
                <button
                  onClick={closePreview}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer */}
            <div className="flex-1 bg-slate-900/5 p-4 sm:p-6 overflow-y-auto">
              {previewState.error ? (
                <div className="flex h-[65vh] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                  <p className="text-sm font-semibold text-red-700">{previewState.error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(previewState.certificate)}
                    className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Retry Preview
                  </Button>
                </div>
              ) : previewState.url ? (
                <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-large">
                  <iframe
                    src={previewState.url}
                    title={`Certificate preview for ${previewState.certificate.learning_path_title}`}
                    className="h-[68vh] w-full border-0"
                  />
                </div>
              ) : (
                <div className="flex h-[65vh] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-3" />
                  <p className="text-sm font-medium text-slate-700">Generating certificate preview...</p>
                  <p className="text-xs text-slate-400 mt-1">Fetching high-resolution rendered document</p>
                </div>
              )}
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {/* ================= MODAL: SHARE & CREDENTIAL VERIFICATION ================= */}
      {shareModalCert ? (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-primary-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary-400" />
                <h3 className="font-bold text-base text-white">Share Credential</h3>
              </div>
              <button
                onClick={() => setShareModalCert(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Certificate Snapshot Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                    {shareModalCert.scope === 'FULL' ? 'Full Path Credential' : 'Stage Milestone'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(shareModalCert.issued_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-sm">{shareModalCert.learning_path_title}</p>
                <p className="text-xs text-slate-600">Issued to {shareModalCert.learner_name}</p>
              </div>

              {/* Credential ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Credential ID</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareModalCert.id}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 select-all"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyId(shareModalCert.id)}
                    className="shrink-0"
                  >
                    {copiedId === shareModalCert.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copy ID
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Social / LinkedIn Sharing Copy */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Formatted Post / Resume Text
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1 font-sans">
                  <p>🎓 I'm proud to share that I have completed the <strong>"{shareModalCert.learning_path_title}"</strong> program on the SLT Learning Portal.</p>
                  <p className="text-[11px] text-slate-500 pt-1 font-mono">Credential ID: {shareModalCert.id}</p>
                </div>
                <Button
                  className="mt-3 w-full bg-primary-700 hover:bg-primary-800 text-white"
                  onClick={() => handleCopyShareText(shareModalCert)}
                >
                  {copiedShareText ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5 text-emerald-300" />
                      Summary Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1.5" />
                      Copy Shareable Summary
                    </>
                  )}
                </Button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShareModalCert(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
