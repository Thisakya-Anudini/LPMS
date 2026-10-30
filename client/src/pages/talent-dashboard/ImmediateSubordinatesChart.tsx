import { useEffect, useState, useMemo } from "react";
import {
  Users,
  AlertCircle,
  Search,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  Target,
  Sparkles,
} from "lucide-react";
import { useTalentDashboardScope } from "../../contexts/TalentDashboardScopeContext";
import { useAuth } from "../../contexts/useAuth";
import { talentDashboardApi } from "../../api/talentDashboardApi";
import { SubordinateProgress } from "../../types";
import { Skeleton } from "../../components/ui/Skeleton";
import immediateSubordinatesMock from "../../mocks/immediateSubordinatesMock.json";

type SortOption = "HOURS_DESC" | "HOURS_ASC" | "NAME_ASC";

export function ImmediateSubordinatesChart() {
  const { filters, viewAsUser, refreshKey, drillDown } =
    useTalentDashboardScope();
  const { getAccessToken } = useAuth();

  const [subordinates, setSubordinates] = useState<SubordinateProgress[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("HOURS_DESC");

  // Pagination for subordinates (max 10 per page)
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset to page 1 whenever search query or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    let isMounted = true;

    async function fetchSubordinates() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        let apiData: SubordinateProgress[] | null = null;

        if (token) {
          try {
            const data = await talentDashboardApi.getImmediateSubordinates(
              token,
              {
                ...filters,
                viewAsId: viewAsUser?.principalId,
              }
            );
            if (Array.isArray(data)) {
              apiData = data;
            }
          } catch (apiErr) {
            console.warn(
              "Immediate subordinates API warning, falling back to mock:",
              apiErr
            );
            apiData = null;
          }
        }

        if (!isMounted) return;

        if (apiData !== null) {
          setSubordinates(apiData);
          setIsUsingFallback(false);
        } else {
          // Graceful fallback to mock data
          setSubordinates(immediateSubordinatesMock as SubordinateProgress[]);
          setIsUsingFallback(true);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load immediate subordinates"
          );
          setSubordinates(immediateSubordinatesMock as SubordinateProgress[]);
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchSubordinates();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, filters, viewAsUser, refreshKey]);

  // Target standard (fixed 18.0 hours)
  const TARGET_HOURS = 18.0;

  // Filtered and sorted list
  const filteredSubordinates = useMemo(() => {
    let list = [...subordinates];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (sub) =>
          sub.fullName.toLowerCase().includes(q) ||
          sub.employeeNumber.toLowerCase().includes(q) ||
          sub.designation.toLowerCase().includes(q) ||
          sub.department.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "HOURS_DESC":
        list.sort((a, b) => b.completedHours - a.completedHours);
        break;
      case "HOURS_ASC":
        list.sort((a, b) => a.completedHours - b.completedHours);
        break;
      case "NAME_ASC":
        list.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
    }

    return list;
  }, [subordinates, searchQuery, sortBy]);

  // Pagination calculations (max 10 items per page)
  const totalSubordinates = filteredSubordinates.length;
  const totalPages = Math.max(1, Math.ceil(totalSubordinates / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedSubordinates = useMemo(() => {
    return filteredSubordinates.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredSubordinates, startIndex]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = subordinates.length;
    if (total === 0) {
      return { total: 0, metTarget: 0, averageHours: 0, completionRate: 0 };
    }
    const metTarget = subordinates.filter(
      (s) => s.completedHours >= TARGET_HOURS
    ).length;
    const totalHours = subordinates.reduce(
      (acc, s) => acc + s.completedHours,
      0
    );
    const averageHours = Math.round((totalHours / total) * 10) / 10;
    const completionRate = Math.round((metTarget / total) * 100);

    return { total, metTarget, averageHours, completionRate };
  }, [subordinates]);

  // Max scale calculation for bars (minimum 24h to give space beyond 18h target)
  const maxBarValue = useMemo(() => {
    const maxHours = Math.max(
      TARGET_HOURS,
      ...subordinates.map((s) => s.completedHours || 0)
    );
    return Math.max(24, Math.ceil(maxHours * 1.15));
  }, [subordinates]);

  const targetPercentagePosition = Math.min(
    100,
    (TARGET_HOURS / maxBarValue) * 100
  );

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleDrillDownToSubordinate = (sub: SubordinateProgress) => {
    drillDown({
      principalId: sub.employeeNumber,
      employeeNumber: sub.employeeNumber,
      name: sub.fullName,
      designation: sub.designation,
      department: sub.department,
    });
  };

  return (
    <div className="rounded-xl border border-secondary-200 bg-white shadow-soft overflow-hidden transition-all duration-200">
      {/* Widget Header */}
      <div className="border-b border-secondary-100 bg-gradient-to-r from-secondary-50/70 via-white to-secondary-50/40 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-secondary-900 tracking-tight">
                  Immediate Subordinates Progress
                </h3>
                <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                  Depth = 1
                </span>
                {/* Scroll Count Badge when more than 3 subordinates */}
                {filteredSubordinates.length > 3 && (
                  <span className="inline-flex items-center rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-600">
                    Showing 3 of {filteredSubordinates.length} (scroll for more)
                  </span>
                )}
                {isUsingFallback && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                    <Sparkles className="h-3 w-3" /> Demo Data
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-secondary-500">
                Direct reports tracked against the {TARGET_HOURS.toFixed(1)}h
                annual organizational target
              </p>
            </div>
          </div>

          {/* Quick controls: Sort and Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary-400" />
              <input
                type="text"
                placeholder="Search direct report..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-44 rounded-lg border border-secondary-200 bg-white pl-8 pr-2.5 text-xs text-secondary-800 placeholder-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-secondary-200 bg-white p-0.5">
              <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-secondary-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort direct reports"
                className="h-7 border-0 bg-transparent pr-2 text-xs font-medium text-secondary-700 focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="HOURS_DESC">Hours (Highest)</option>
                <option value="HOURS_ASC">Hours (Lowest)</option>
                <option value="NAME_ASC">Name (A–Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Aggregate Stats Summary Bar */}
        {!isLoading && subordinates.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-3 border-t border-secondary-100/80">
            <div className="flex items-center gap-2.5 rounded-lg bg-secondary-50/60 p-2.5 border border-secondary-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-secondary-500 uppercase tracking-wider">
                  Direct Reports
                </p>
                <p className="text-sm font-bold text-secondary-900">
                  {stats.total}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50/60 p-2.5 border border-emerald-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider">
                  Target Met (≥18h)
                </p>
                <p className="text-sm font-bold text-emerald-900">
                  {stats.metTarget}{" "}
                  <span className="text-xs font-normal text-emerald-700">
                    ({stats.completionRate}%)
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-lg bg-indigo-50/60 p-2.5 border border-indigo-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-indigo-800 uppercase tracking-wider">
                  Team Avg Hours
                </p>
                <p className="text-sm font-bold text-indigo-900">
                  {stats.averageHours}h
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-lg bg-amber-50/60 p-2.5 border border-amber-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-amber-800 uppercase tracking-wider">
                  Benchmark Goal
                </p>
                <p className="text-sm font-bold text-amber-900">
                  {TARGET_HOURS.toFixed(1)}h / staff
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2 rounded-lg border border-secondary-100 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && subordinates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-secondary-900">
              Failed to load immediate subordinates
            </h4>
            <p className="mt-1 text-xs text-secondary-500 max-w-sm">{error}</p>
          </div>
        )}

        {/* Empty State: No Subordinates for Current Target */}
        {!isLoading && !error && subordinates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl bg-secondary-50/50 border border-dashed border-secondary-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-100 text-secondary-500 mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-secondary-800">
              No Direct Reports Found
            </h4>
            <p className="mt-1 text-xs text-secondary-500 max-w-md">
              There are no direct subordinates (depth = 1) reporting to this
              position. If you are viewing an individual employee or leaf node,
              they may not have any direct reports.
            </p>
            <p className="mt-2 text-xs font-medium text-primary-600">
              Tip: Click on a supervisor or manager in the Organizational
              Structure tree on the left to inspect their team.
            </p>
          </div>
        )}

        {/* Empty Search State */}
        {!isLoading &&
          subordinates.length > 0 &&
          filteredSubordinates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-xs text-secondary-500">
                No direct reports match your search query:{" "}
                <span className="font-semibold text-secondary-700">
                  "{searchQuery}"
                </span>
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs font-semibold text-primary-600 hover:text-primary-700 underline"
              >
                Clear Search
              </button>
            </div>
          )}

        {/* List of Subordinates with Horizontal Progress Bars */}
        {!isLoading && filteredSubordinates.length > 0 && (
          <div>
            {/* Visual Guide Header with Target Reference Line (Fixed above scroll container) */}
            <div className="hidden sm:flex items-center justify-between text-[11px] font-semibold text-secondary-400 px-2 pb-2 mb-2 border-b border-secondary-100">
              <span>SUBORDINATE & ROLE</span>
              <div className="relative w-1/2 flex justify-between pr-8">
                <span>0h</span>
                <span className="text-primary-600 font-bold flex items-center gap-1">
                  <Target className="h-3 w-3" /> {TARGET_HOURS.toFixed(1)}h Target
                </span>
                <span>{maxBarValue}h</span>
              </div>
            </div>

            {/* Constrained Scroll Container: exactly 3 visible items (~320px max height) */}
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1.5 focus:outline-none scrollbar-thin scrollbar-thumb-secondary-300 scrollbar-track-secondary-100">
              {paginatedSubordinates.map((sub) => {
                const completed = sub.completedHours || 0;
                const hasMetTarget = completed >= TARGET_HOURS;
                const percentOfMax = Math.min(100, (completed / maxBarValue) * 100);
                const percentOfTarget = Math.round(
                  (completed / TARGET_HOURS) * 100
                );

                // Color gradient & status badges
                let barColorClass =
                  "bg-gradient-to-r from-emerald-500 to-emerald-600";
                let badgeColorClass =
                  "bg-emerald-50 text-emerald-700 border-emerald-200";
                let statusLabel = `${percentOfTarget}% Target Met`;

                if (!hasMetTarget && completed >= 10) {
                  barColorClass = "bg-gradient-to-r from-indigo-500 to-indigo-600";
                  badgeColorClass =
                    "bg-indigo-50 text-indigo-700 border-indigo-200";
                  statusLabel = `${completed.toFixed(1)} / 18h`;
                } else if (!hasMetTarget) {
                  barColorClass = "bg-gradient-to-r from-amber-500 to-amber-600";
                  badgeColorClass =
                    "bg-amber-50 text-amber-700 border-amber-200";
                  statusLabel = `${completed.toFixed(1)} / 18h`;
                }

                return (
                  <div
                    key={sub.employeeNumber}
                    className="group relative rounded-xl border border-secondary-200 bg-white p-3.5 transition-all duration-200 hover:border-primary-300 hover:shadow-sm"
                  >
                    {/* Top line: Avatar, Name, Employee No, Designation & Stats Badge */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2.5">
                      <div className="flex items-center gap-3">
                        {/* Avatar initials */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 text-xs font-bold text-white shadow-sm">
                          {getInitials(sub.fullName)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-secondary-900 truncate">
                              {sub.fullName}
                            </p>
                            <span className="text-xs font-mono font-medium text-secondary-500 bg-secondary-100 px-1.5 py-0.5 rounded">
                              {sub.employeeNumber}
                            </span>
                          </div>
                          <p className="text-xs text-secondary-500 truncate">
                            {sub.designation}
                            {sub.department && sub.department !== "General" ? (
                              <>
                                {" "}
                                •{" "}
                                <span className="text-secondary-600 font-medium">
                                  {sub.department}
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      {/* Hours Badge & Action Button */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${badgeColorClass}`}
                        >
                          {hasMetTarget ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          <span>{completed.toFixed(1)} hrs</span>
                          <span className="text-[10px] font-normal opacity-80">
                            ({statusLabel})
                          </span>
                        </span>

                        {/* Drill down button */}
                        <button
                          type="button"
                          onClick={() => handleDrillDownToSubordinate(sub)}
                          title={`Inspect ${sub.fullName}'s downward team & training records`}
                          className="inline-flex items-center gap-1 rounded-lg border border-secondary-200 bg-secondary-50 px-2.5 py-1 text-xs font-medium text-secondary-700 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer"
                        >
                          <span>Drill Down</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Horizontal Bar Visual with Target Line */}
                    <div className="relative pt-1">
                      {/* Track */}
                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary-100">
                        {/* Filled Progress Bar */}
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${barColorClass}`}
                          style={{ width: `${percentOfMax}%` }}
                        />
                      </div>

                      {/* Fixed 18.0h Target Benchmark Marker */}
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none flex flex-col items-center"
                        style={{ left: `${targetPercentagePosition}%` }}
                      >
                        <div className="w-0.5 h-full bg-primary-600/70" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls when subordinates exceed 10 */}
            {totalSubordinates > PAGE_SIZE && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-secondary-100 text-xs text-secondary-500">
                <div>
                  Showing{" "}
                  <span className="font-semibold text-secondary-800">
                    {startIndex + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-secondary-800">
                    {Math.min(startIndex + PAGE_SIZE, totalSubordinates)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-secondary-800">
                    {totalSubordinates}
                  </span>{" "}
                  subordinates
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-secondary-200 bg-white text-secondary-700 hover:bg-secondary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>

                  <span className="px-2 font-medium text-secondary-600">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-secondary-200 bg-white text-secondary-700 hover:bg-secondary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
