import React, { useCallback, useMemo, useState } from "react";
import {
  Award,
  BookCheck,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock,
  Compass,
  Copy,
  GraduationCap,
  Mail,
  Network,
  Search,
  Sparkles,
  Tag,
  Trophy,
  UserCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  EmployeeHierarchyPanel,
  type SelectedHierarchyEmployee,
} from "../../components/admin/EmployeeHierarchyPanel";
import { superAdminApi } from "../../api/lpmsApi";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

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

type EnrollmentCourse = {
  courseId: string;
  title: string;
  stageTitle: string;
  progress: number;
  isCompleted: boolean;
};

const getCategoryBadge = (category: string) => {
  const normalized = (category || "").toUpperCase();
  if (normalized.includes("LEADER") || normalized.includes("MANAG")) {
    return {
      label: category.replace("_", " "),
      className: "bg-purple-50 text-purple-700 border-purple-200",
    };
  }
  if (normalized.includes("TECH") || normalized.includes("DEV") || normalized.includes("ENG")) {
    return {
      label: category.replace("_", " "),
      className: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (normalized.includes("SAFE") || normalized.includes("SEC")) {
    return {
      label: category.replace("_", " "),
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }
  if (normalized.includes("COMPLIAN") || normalized.includes("GOV")) {
    return {
      label: category.replace("_", " "),
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: category ? category.replace("_", " ") : "General",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  };
};

const getPathStatus = (path: LearnerPath) => {
  const progress = Math.min(100, Math.max(0, Number(path.progress || 0)));
  if (progress === 100 || path.status.toUpperCase() === "COMPLETED")
    return {
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 border-emerald-200",
      variant: "success" as const,
      color: "#10b981",
    };
  if (progress > 0)
    return {
      label: "In progress",
      className: "bg-amber-50 text-amber-700 ring-amber-600/20 border-amber-200",
      variant: "warning" as const,
      color: "#f59e0b",
    };
  return {
    label: "Not started",
    className: "bg-slate-100 text-slate-600 ring-slate-500/20 border-slate-200",
    variant: "default" as const,
    color: "#64748b",
  };
};

const getInitials = (name: string) => {
  if (!name) return "LP";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function PathCoursesList({ enrollmentId }: { enrollmentId: string }) {
  const { getAccessToken } = useAuth();
  const [courses, setCourses] = useState<EnrollmentCourse[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let isMounted = true;
    getAccessToken().then((token) => {
      if (!token) return;
      superAdminApi
        .getEnrollmentCourses(token, enrollmentId)
        .then((res) => {
          if (isMounted) {
            setCourses(res.courses);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
    });
    return () => {
      isMounted = false;
    };
  }, [enrollmentId, getAccessToken]);

  if (loading)
    return (
      <div className="mt-4 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2 w-full" />
      </div>
    );

  if (courses.length === 0)
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5 text-center text-xs text-slate-500">
        No module courses found in this path.
      </div>
    );

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Curriculum Breakdown ({courses.length} modules)
        </span>
      </div>
      <div className="space-y-2.5">
        {courses.map((course, idx) => {
          const isDone = course.isCompleted || Number(course.progress) >= 100;
          return (
            <div
              key={course.courseId}
              className="flex flex-col gap-1.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                      isDone
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isDone ? "✓" : idx + 1}
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-800">
                    {course.title}
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  {course.stageTitle}
                </span>
              </div>
              <ProgressBar
                progress={Number(course.progress || 0)}
                showLabel={false}
                size="sm"
                variant={isDone ? "success" : "default"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminEmployeeHierarchyPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [selectedEmployee, setSelectedEmployee] =
    useState<SelectedHierarchyEmployee | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [learner, setLearner] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearnerPath[]>([]);
  const [expandedPathId, setExpandedPathId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "IN_PROGRESS" | "COMPLETED" | "NOT_STARTED"
  >("ALL");
  const [pathSearch, setPathSearch] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  const loadLearnerDetails = useCallback(
    async (employee: SelectedHierarchyEmployee) => {
      setSelectedEmployee(employee);
      setLoadingDetails(true);
      setDetailsError(null);
      setExpandedPathId(null);
      setStatusFilter("ALL");
      setPathSearch("");

      setLearner({
        id: employee.employeeNumber,
        name: employee.name,
        email: "",
      });
      setLearningPaths([]);

      try {
        const token = await getAccessToken();
        if (!token) {
          showToast("Session expired. Please login again.", "error");
          return;
        }

        const response =
          await superAdminApi.getLearnerLearningPathsByEmployeeNo(
            token,
            employee.employeeNumber,
          );
        setLearner({
          ...response.learner,
          id: employee.employeeNumber,
        });
        setLearningPaths(response.learningPaths);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "";

        if (errorMessage.toLowerCase().includes("not found")) {
          setLearningPaths([]);
        } else {
          setDetailsError(
            err instanceof Error
              ? err.message
              : "Failed to load learner details for the selected employee.",
          );
        }
      } finally {
        setLoadingDetails(false);
      }
    },
    [getAccessToken, showToast],
  );

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    showToast(`Copied employee ID #${id}`, "info");
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = learningPaths.length;
    const completed = learningPaths.filter(
      (p) =>
        Number(p.progress) >= 100 || p.status.toUpperCase() === "COMPLETED",
    ).length;
    const inProgress = learningPaths.filter(
      (p) =>
        Number(p.progress) > 0 &&
        Number(p.progress) < 100 &&
        p.status.toUpperCase() !== "COMPLETED",
    ).length;
    const notStarted = total - completed - inProgress;

    const avgProgress =
      total > 0
        ? Math.round(
            learningPaths.reduce((acc, p) => acc + Number(p.progress || 0), 0) /
              total,
          )
        : 0;

    return { total, completed, inProgress, notStarted, avgProgress };
  }, [learningPaths]);

  // Filtered paths
  const filteredPaths = useMemo(() => {
    return learningPaths.filter((path) => {
      const pStatus = getPathStatus(path).label;
      if (statusFilter === "COMPLETED" && pStatus !== "Completed") return false;
      if (statusFilter === "IN_PROGRESS" && pStatus !== "In progress")
        return false;
      if (statusFilter === "NOT_STARTED" && pStatus !== "Not started")
        return false;

      if (pathSearch.trim()) {
        const q = pathSearch.toLowerCase();
        return (
          path.title.toLowerCase().includes(q) ||
          path.description?.toLowerCase().includes(q) ||
          path.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [learningPaths, statusFilter, pathSearch]);

  const initials = learner ? getInitials(learner.name) : "EP";

  return (
    <div className="space-y-6 pb-8">
      {/* Administration Box Banner (Matching System Accounts style with smooth hover effect) */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5">
        {/* Subtle Background Pattern/Gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-50 via-sky-50/20 to-white/50 opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="relative flex flex-col gap-4 px-5 py-6 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
              <Network className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
              <span>Administration</span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Employee Hierarchy
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Explore reporting lines and review learner progress in one place.
            </p>
          </div>

          <div className="flex w-full flex-col gap-1 rounded-xl border border-primary-100 bg-primary-50/50 px-5 py-4 sm:w-auto sm:min-w-[280px] transition-all duration-200 hover:border-primary-200 hover:bg-primary-50/90 hover:shadow-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-primary-950">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-100 text-primary-700 transition-transform duration-200 group-hover:scale-105">
                <UsersRound className="h-3.5 w-3.5" />
              </div>
              Interactive Hierarchy
            </div>
            <p className="mt-1 text-xs font-medium text-primary-700">
              Select View to inspect a learner
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Tree & Right Learner Inspection */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(440px,0.92fr)_minmax(0,1.08fr)]">
        {/* Left Side: Employee Hierarchy Panel */}
        <aside className="min-w-0 self-stretch">
          <EmployeeHierarchyPanel
            selectedEmployeeNumber={selectedEmployee?.employeeNumber}
            onViewDetails={loadLearnerDetails}
            onRefresh={() => setSelectedEmployee(null)}
          />
        </aside>

        {/* Right Side: Learner Details & Paths Panel */}
        <section className="min-w-0 self-stretch">
          <Card
            className="flex h-full min-h-[540px] flex-col border border-slate-200/90 shadow-md backdrop-blur-sm transition-all duration-300 xl:h-[calc(100vh-170px)]"
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
          >
            {/* Header */}
            <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        Learner Inspection Hub
                      </h2>
                      {selectedEmployee && (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          Active Profile
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {selectedEmployee
                        ? `Inspecting Employee #${selectedEmployee.employeeNumber}`
                        : "Select an employee from the hierarchy tree to inspect details."}
                    </p>
                  </div>
                </div>

                {selectedEmployee && (
                  <button
                    type="button"
                    onClick={() => handleCopyId(selectedEmployee.employeeNumber)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-xs hover:border-slate-300 hover:bg-slate-50"
                    title="Copy employee ID"
                  >
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    <span>{copiedId ? "Copied!" : `#${selectedEmployee.employeeNumber}`}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-6">
              {!selectedEmployee ? (
                /* Empty state */
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/50 to-white p-8 text-center">
                  <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-xl shadow-sky-500/20">
                    <UserRound className="h-9 w-9" />
                    <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-amber-950 font-bold text-xs shadow-md">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    No Team Member Selected
                  </h3>
                  <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Explore the hierarchy tree on the left and click the{" "}
                    <span className="font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded-md border border-primary-200">
                      View
                    </span>{" "}
                    button next to any employee to inspect their assigned learning
                    paths, course completion milestones, and skills breakdown.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-2xs">
                      <Compass className="h-3.5 w-3.5 text-primary-600" />
                      <span>Explore reporting lines</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-2xs">
                      <Award className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Check completion badges</span>
                    </div>
                  </div>
                </div>
              ) : loadingDetails ? (
                /* Skeleton Loading */
                <div className="space-y-5">
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <Skeleton className="h-16 w-16 rounded-2xl" />
                    <div className="flex-1 space-y-2.5">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3.5 w-64" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                  </div>
                </div>
              ) : detailsError ? (
                /* Error State */
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-sm font-medium text-rose-800">
                  {detailsError}
                </div>
              ) : learner ? (
                /* Populated Learner Profile */
                <div className="space-y-6">
                  {/* Learner Profile Banner Card */}
                  <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/90 via-indigo-50/40 to-white p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Avatar Initials */}
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 font-black text-xl text-white shadow-md shadow-sky-500/20 ring-4 ring-white">
                        {initials}
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                          <UserCheck className="h-3 w-3 text-white" />
                        </span>
                      </div>

                      {/* Info & Badges */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-extrabold text-slate-900">
                            {learner.name}
                          </h3>
                          <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 shadow-2xs">
                            #{selectedEmployee.employeeNumber}
                          </span>
                        </div>

                        <p className="mt-0.5 text-sm font-semibold text-primary-700">
                          {selectedEmployee.designation}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          {selectedEmployee.orgName && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/80 border border-slate-200/80 px-2 py-1 font-medium shadow-2xs">
                              <Tag className="h-3 w-3 text-slate-400" />
                              {selectedEmployee.orgName}
                            </span>
                          )}
                          {learner.email ? (
                            <a
                              href={`mailto:${learner.email}`}
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-primary-700 hover:underline"
                            >
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              <span>{learner.email}</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Progress Metrics Strip */}
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-sky-100/80">
                      <div className="rounded-2xl border border-white bg-white/80 p-3 shadow-2xs">
                        <p className="text-[11px] font-semibold text-slate-500">
                          Total Paths
                        </p>
                        <p className="text-lg font-black text-slate-900">
                          {metrics.total}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-emerald-700">
                            Completed
                          </p>
                          <Trophy className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <p className="text-lg font-black text-emerald-800">
                          {metrics.completed}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-amber-700">
                            In Progress
                          </p>
                          <CircleDot className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <p className="text-lg font-black text-amber-800">
                          {metrics.inProgress}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-sky-700">
                            Avg Progress
                          </p>
                          <BookCheck className="h-3.5 w-3.5 text-sky-600" />
                        </div>
                        <p className="text-lg font-black text-sky-800">
                          {metrics.avgProgress}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Learning Paths Section Header & Controls */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary-600" />
                        <h4 className="text-sm font-bold text-slate-900">
                          Assigned Learning Paths ({learningPaths.length})
                        </h4>
                      </div>

                      {/* Filter Tabs */}
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setStatusFilter("ALL")}
                          className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                            statusFilter === "ALL"
                              ? "bg-white text-slate-900 shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          All ({learningPaths.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("IN_PROGRESS")}
                          className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                            statusFilter === "IN_PROGRESS"
                              ? "bg-amber-100 text-amber-900 shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          In Progress ({metrics.inProgress})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("COMPLETED")}
                          className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                            statusFilter === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-900 shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Completed ({metrics.completed})
                        </button>
                      </div>
                    </div>

                    {/* Search inside paths */}
                    {learningPaths.length > 3 && (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={pathSearch}
                          onChange={(e) => setPathSearch(e.target.value)}
                          placeholder="Filter assigned paths..."
                          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8.5 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 transition focus:border-primary-400 focus:outline-hidden"
                        />
                      </div>
                    )}
                  </div>

                  {/* Learning Paths List */}
                  {learningPaths.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                      <GraduationCap className="h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        No Learning Paths Assigned
                      </p>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        This employee currently does not have any active learning
                        paths or training programs assigned.
                      </p>
                    </div>
                  ) : filteredPaths.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
                      No learning paths match the selected filter.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {filteredPaths.map((path) => {
                        const pathStatus = getPathStatus(path);
                        const categoryInfo = getCategoryBadge(path.category);
                        const isExpanded = expandedPathId === path.enrollment_id;

                        return (
                          <div
                            key={path.enrollment_id}
                            className={`group relative overflow-hidden rounded-2xl border bg-white p-4.5 transition-all duration-200 ${
                              isExpanded
                                ? "border-primary-400 shadow-md ring-2 ring-primary-100"
                                : "border-slate-200/90 shadow-2xs hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5"
                            }`}
                          >
                            {/* Card Header & Title */}
                            <div
                              className="cursor-pointer"
                              onClick={() =>
                                setExpandedPathId(
                                  isExpanded ? null : path.enrollment_id,
                                )
                              }
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${categoryInfo.className}`}
                                    >
                                      {categoryInfo.label}
                                    </span>
                                    {path.total_duration && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                        <Clock className="h-3 w-3 text-slate-400" />
                                        {path.total_duration}
                                      </span>
                                    )}
                                  </div>
                                  <h5 className="mt-1.5 text-sm font-bold text-slate-900 group-hover:text-primary-800 transition-colors">
                                    {path.title}
                                  </h5>
                                  {path.description && (
                                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                      {path.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${pathStatus.className}`}
                                  >
                                    {pathStatus.label === "Completed" ? (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                      <CircleDot className="h-3.5 w-3.5" />
                                    )}
                                    {pathStatus.label}
                                  </span>
                                  <button
                                    type="button"
                                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                    title="Toggle details"
                                  >
                                    <ChevronDown
                                      className={`h-4 w-4 transition-transform duration-200 ${
                                        isExpanded ? "rotate-180 text-primary-600" : ""
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>

                              {/* Progress Bar & Details */}
                              <div className="mt-3.5">
                                <ProgressBar
                                  progress={Number(path.progress || 0)}
                                  showLabel
                                  size="sm"
                                  variant={pathStatus.variant}
                                />
                              </div>
                            </div>

                            {/* Expandable Course Modules */}
                            {isExpanded && (
                              <PathCoursesList
                                enrollmentId={path.enrollment_id}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
