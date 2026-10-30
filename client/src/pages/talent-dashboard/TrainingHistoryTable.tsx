import { useEffect, useState, useMemo } from "react";
import {
  FileText,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Calendar,
  AlertCircle,
  RotateCw,
  X,
  Filter,
  User,
  Users,
  Briefcase,
  Building2,
  IdCard,
} from "lucide-react";
import { useTalentDashboardScope } from "../../contexts/TalentDashboardScopeContext";
import { useAuth } from "../../contexts/useAuth";
import { talentDashboardApi } from "../../api/talentDashboardApi";
import {
  TrainingHistoryRecord,
  PaginatedHistoryResponse,
} from "../../types";
import { Skeleton } from "../../components/ui/Skeleton";
import trainingHistoryMock from "../../mocks/trainingHistoryMock.json";

type SortField =
  | "startDate"
  | "endDate"
  | "durationHours"
  | "programName"
  | "fullName"
  | "employeeNumber"
  | "designation"
  | "trainingType"
  | "status";

type SortOrder = "ASC" | "DESC";

export function TrainingHistoryTable() {
  const { filters, viewAsUser, refreshKey, resetFilters, resetToSelf } =
    useTalentDashboardScope();
  const { getAccessToken } = useAuth();

  // Data & Pagination State
  const [records, setRecords] = useState<TrainingHistoryRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Sorting & Search State
  const [sortBy, setSortBy] = useState<SortField>("startDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("DESC");
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");

  // Loading & Export States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setActiveSearch(searchInput.trim());
      setCurrentPage(1); // Reset to page 1 on new search
    }, 350);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset to page 1 and clear search input when global filters or drill-down changes
  useEffect(() => {
    setCurrentPage(1);
    if (viewAsUser) {
      setSearchInput("");
      setActiveSearch("");
    }
  }, [filters, viewAsUser]);

  // Fetch paginated history from API with fallback
  useEffect(() => {
    let isMounted = true;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        let apiData: PaginatedHistoryResponse | null = null;

        if (token) {
          try {
            const data = await talentDashboardApi.getTrainingHistory(
              token,
              {
                ...filters,
                viewAsId: viewAsUser?.principalId,
                search: viewAsUser ? "" : activeSearch,
              },
              currentPage,
              pageSize,
              sortBy,
              sortOrder
            );
            if (data && Array.isArray(data.records)) {
              apiData = data;
            }
          } catch (apiErr) {
            console.warn(
              "Training history API warning, falling back to mock:",
              apiErr
            );
            apiData = null;
          }
        }

        if (!isMounted) return;

        // Individual learner filter: ensure only selected employee's records are shown without mixing in other team members
        const isRecordForLearner = (r: TrainingHistoryRecord) => {
          if (!viewAsUser) return true;
          const targetEmpNo = (viewAsUser.employeeNumber || "").trim().toLowerCase();
          const targetName = (viewAsUser.name || "").trim().toLowerCase();
          const rEmpNo = (r.employeeNumber || "").trim().toLowerCase();
          const rName = (r.fullName || "").trim().toLowerCase();
          return (
            (targetEmpNo && rEmpNo === targetEmpNo) ||
            (targetName && rName === targetName)
          );
        };

        if (apiData !== null) {
          let recs = apiData.records;
          let total = apiData.total;
          let pages = apiData.totalPages || 1;

          if (viewAsUser) {
            recs = recs.filter(isRecordForLearner);
            if (recs.length !== apiData.records.length) {
              total = recs.length;
              pages = Math.max(1, Math.ceil(total / pageSize));
            }
          }

          setRecords(recs);
          setTotalRecords(total);
          setTotalPages(pages);
          setIsUsingFallback(false);
        } else {
          // Client-side pagination & filter fallback using mock
          const mock = trainingHistoryMock as PaginatedHistoryResponse;
          let filtered = [...mock.records];

          if (viewAsUser) {
            // Strictly filter to the selected employee only, without mixing other team members
            filtered = filtered.filter(isRecordForLearner);
          } else {
            if (activeSearch) {
              const q = activeSearch.toLowerCase();
              filtered = filtered.filter(
                (r) =>
                  r.programName.toLowerCase().includes(q) ||
                  r.fullName.toLowerCase().includes(q) ||
                  r.employeeNumber.toLowerCase().includes(q) ||
                  r.designation.toLowerCase().includes(q)
              );
            }

            if (filters.trainingType && filters.trainingType !== "ALL") {
              filtered = filtered.filter(
                (r) => r.trainingType === filters.trainingType
              );
            }
          }

          // Sort mock records
          filtered.sort((a, b) => {
            let valA: string | number = a[sortBy] ?? "";
            let valB: string | number = b[sortBy] ?? "";
            if (typeof valA === "string") valA = valA.toLowerCase();
            if (typeof valB === "string") valB = valB.toLowerCase();
            if (valA < valB) return sortOrder === "ASC" ? -1 : 1;
            if (valA > valB) return sortOrder === "ASC" ? 1 : -1;
            return 0;
          });

          const total = filtered.length;
          const pages = Math.max(1, Math.ceil(total / pageSize));
          const startIdx = (currentPage - 1) * pageSize;
          const paginated = filtered.slice(startIdx, startIdx + pageSize);

          setRecords(paginated);
          setTotalRecords(total);
          setTotalPages(pages);
          setIsUsingFallback(true);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load training history records"
          );
          setRecords([]);
          setTotalRecords(0);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [
    getAccessToken,
    filters,
    viewAsUser,
    refreshKey,
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
    activeSearch,
  ]);

  // Handle Column Header Sort Click
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(field);
      setSortOrder(field === "startDate" || field === "durationHours" ? "DESC" : "ASC");
    }
    setCurrentPage(1);
  };

  // Trigger CSV Export & Browser Download
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Session expired. Please log in again.");
      }

      const blob = await talentDashboardApi.exportTrainingHistory(
        token,
        {
          ...filters,
          viewAsId: viewAsUser?.principalId,
          search: viewAsUser ? "" : activeSearch,
        },
        sortBy,
        sortOrder
      );

      // Create download trigger in browser
      const dateStamp = new Date().toISOString().slice(0, 10);
      const suffix = viewAsUser?.employeeNumber ? `_${viewAsUser.employeeNumber}` : "";
      const filename = `talent_training_history${suffix}_${dateStamp}.csv`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert(
        err instanceof Error
          ? `Export failed: ${err.message}`
          : "Failed to export training history records."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Render sort icon helper
  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return (
        <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-secondary-400 group-hover:text-secondary-600 transition-colors" />
      );
    }
    return sortOrder === "ASC" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary-600 font-bold" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary-600 font-bold" />
    );
  };

  // Training type badge styles
  const getTrainingTypeBadge = (type: string) => {
    switch (type?.toUpperCase()) {
      case "ONLINE":
        return "bg-violet-50 text-violet-700 border-violet-200";
      case "CLASSROOM":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "HYBRID":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "EXTERNAL":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-secondary-50 text-secondary-700 border-secondary-200";
    }
  };

  // Status badge styles
  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "IN_PROGRESS":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "EXPIRED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-secondary-50 text-secondary-700 border-secondary-200";
    }
  };

  // Pagination calculation
  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  // Generate pagination page numbers with smart ellipsis
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  }, [totalPages, currentPage]);

  return (
    <div className="rounded-xl border border-secondary-200 bg-white shadow-soft overflow-hidden transition-all duration-200">
      {/* Table Header Section */}
      <div className="border-b border-secondary-100 bg-gradient-to-r from-secondary-50/70 via-white to-secondary-50/40 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {viewAsUser ? (
            /* Individual Learner Drill-Down Header */
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 border border-primary-200 shadow-sm">
                <User className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 border border-primary-200 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
                    Individual Learner View
                  </span>
                  <h3 className="text-lg font-bold text-secondary-900 tracking-tight">
                    {viewAsUser.name}
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-semibold text-secondary-700">
                    {totalRecords} {totalRecords === 1 ? "Record" : "Records"}
                  </span>
                  {isUsingFallback && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                      <Sparkles className="h-3 w-3" /> Demo Data
                    </span>
                  )}
                </div>

                {/* Meta Row: Employee ID, Designation, Department */}
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary-600">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <IdCard className="h-3.5 w-3.5 text-secondary-400" />
                    <span>Employee ID:</span>
                    <span className="font-mono font-semibold text-secondary-900 bg-secondary-100 border border-secondary-200 px-1.5 py-0.5 rounded text-[11px]">
                      {viewAsUser.employeeNumber}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Briefcase className="h-3.5 w-3.5 text-secondary-400" />
                    <span>Designation:</span>
                    <span className="font-semibold text-secondary-800">
                      {viewAsUser.designation || "Employee"}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Building2 className="h-3.5 w-3.5 text-secondary-400" />
                    <span>Department:</span>
                    <span className="font-semibold text-secondary-800">
                      {viewAsUser.department || "General"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Team-Level View Header */
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-secondary-900 tracking-tight">
                    Training History & Completed Records
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-semibold text-secondary-700">
                    {totalRecords} {totalRecords === 1 ? "Record" : "Records"}
                  </span>
                  {isUsingFallback && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                      <Sparkles className="h-3 w-3" /> Demo Data
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-secondary-500">
                  Detailed training activities, participant completion hours, and
                  delivery modes scoped to your organization
                </p>
              </div>
            </div>
          )}

          {/* Action Row: Conditional Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* When in Individual Learner View: "View All Team Records" button is shown, search & filter options are HIDDEN */}
            {viewAsUser ? (
              <button
                type="button"
                onClick={resetToSelf}
                className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-primary-300 bg-primary-50 px-3.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-xs transition-all cursor-pointer"
                title="Return to the team-level view with all members' records"
              >
                <Users className="h-3.5 w-3.5 text-primary-600" />
                <span>View All Team Records</span>
              </button>
            ) : (
              /* When in Team View: Search Input is visible */
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary-400" />
                <input
                  type="text"
                  placeholder="Search program, name, ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 w-60 rounded-lg border border-secondary-200 bg-white pl-8 pr-7 text-xs text-secondary-800 placeholder-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-xs"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Export to CSV / Excel Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting || totalRecords === 0}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-secondary-300 bg-white px-3.5 text-xs font-semibold text-secondary-700 hover:border-primary-500 hover:bg-primary-50/50 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:pointer-events-none shadow-xs transition-all cursor-pointer"
              title="Stream-download in-scope training records as an Excel-ready UTF-8 CSV"
            >
              {isExporting ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin text-primary-600" />
              ) : (
                <Download className="h-3.5 w-3.5 text-secondary-500" />
              )}
              <span>{isExporting ? "Exporting..." : "Export to CSV"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          {/* Table Head with Interactive Sort Column Headers */}
          <thead className="bg-secondary-50/90 border-b border-secondary-200 text-secondary-700 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              {/* 1. Employee ID */}
              <th
                scope="col"
                onClick={() => handleSort("employeeNumber")}
                className="px-4 py-3 cursor-pointer hover:bg-secondary-100/70 transition-colors select-none group font-semibold"
              >
                <div className="flex items-center">
                  <span className="font-semibold">Employee ID</span>
                  {renderSortIcon("employeeNumber")}
                </div>
              </th>

              {/* 2. Full Name */}
              <th
                scope="col"
                onClick={() => handleSort("fullName")}
                className="px-4 py-3 cursor-pointer hover:bg-secondary-100/70 transition-colors select-none group font-semibold"
              >
                <div className="flex items-center">
                  <span className="font-semibold">Full Name</span>
                  {renderSortIcon("fullName")}
                </div>
              </th>

              {/* 3. Designation */}
              <th
                scope="col"
                onClick={() => handleSort("designation")}
                className="px-4 py-3 cursor-pointer hover:bg-secondary-100/70 transition-colors select-none group font-semibold"
              >
                <div className="flex items-center">
                  <span className="font-semibold">Designation</span>
                  {renderSortIcon("designation")}
                </div>
              </th>

              {/* 4. Program Name */}
              <th
                scope="col"
                onClick={() => handleSort("programName")}
                className="px-5 py-3 cursor-pointer hover:bg-secondary-100/70 transition-colors select-none group font-semibold"
              >
                <div className="flex items-center">
                  <span className="font-semibold">Program Name</span>
                  {renderSortIcon("programName")}
                </div>
              </th>

              {/* 5. Training Type */}
              <th
                scope="col"
                onClick={() => handleSort("trainingType")}
                className="px-4 py-3 cursor-pointer hover:bg-secondary-100/70 transition-colors select-none group font-semibold"
              >
                <div className="flex items-center">
                  <span className="font-semibold">Training Type</span>
                  {renderSortIcon("trainingType")}
                </div>
              </th>

              {/* 6. Dates */}
              <th
                scope="col"
                onClick={() => handleSort("startDate")}
                className="px-4 py-3 cursor-pointer hover:bg-secondary-100/70 transition-colors select-none group font-semibold"
              >
                <div className="flex items-center">
                  <span className="font-semibold">Dates</span>
                  {renderSortIcon("startDate")}
                </div>
              </th>

              {/* 7. Duration */}
              <th
                scope="col"
                onClick={() => handleSort("durationHours")}
                className="px-4 py-3 cursor-pointer hover:bg-secondary-100/70 transition-colors select-none group font-semibold text-right"
              >
                <div className="flex items-center justify-end">
                  <span className="font-semibold">Duration</span>
                  {renderSortIcon("durationHours")}
                </div>
              </th>

              {/* 8. Status */}
              <th
                scope="col"
                onClick={() => handleSort("status")}
                className="px-5 py-3 cursor-pointer hover:bg-secondary-100/70 transition-colors select-none group font-semibold text-center"
              >
                <div className="flex items-center justify-center">
                  <span className="font-semibold">Status</span>
                  {renderSortIcon("status")}
                </div>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-secondary-100 bg-white">
            {/* Loading Skeletons */}
            {isLoading &&
              [...Array(pageSize > 10 ? 10 : pageSize)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {/* 1. Employee ID */}
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </td>
                  {/* 2. Full Name */}
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  {/* 3. Designation */}
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-28 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </td>
                  {/* 4. Program Name */}
                  <td className="px-5 py-3.5">
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </td>
                  {/* 5. Training Type */}
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </td>
                  {/* 6. Dates */}
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </td>
                  {/* 7. Duration */}
                  <td className="px-4 py-3.5 text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </td>
                  {/* 8. Status */}
                  <td className="px-5 py-3.5 text-center">
                    <Skeleton className="h-5 w-20 mx-auto rounded-full" />
                  </td>
                </tr>
              ))}

            {/* Error Message Row */}
            {!isLoading && error && records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-2">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-secondary-900">
                      Error Loading Training History
                    </h4>
                    <p className="mt-1 text-xs text-secondary-500 max-w-sm">
                      {error}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty Records State */}
            {!isLoading && !error && records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-100 text-secondary-500 mb-3">
                      <FileText className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-secondary-800">
                      No Training Records Found
                    </h4>
                    <p className="mt-1 text-xs text-secondary-500">
                      {viewAsUser
                        ? `No training records were found for ${viewAsUser.name} (${viewAsUser.employeeNumber}).`
                        : activeSearch
                        ? `No training records match "${activeSearch}". Try adjusting your search term or clearing filters.`
                        : "No training records were found matching the selected date range or category filters."}
                    </p>
                    {viewAsUser ? (
                      <button
                        type="button"
                        onClick={resetToSelf}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors cursor-pointer"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>View All Team Records</span>
                      </button>
                    ) : (activeSearch || filters.trainingType !== "ALL" || filters.designation) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput("");
                          setActiveSearch("");
                          resetFilters();
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-1.5 text-xs font-medium text-secondary-700 hover:bg-secondary-100 transition-colors"
                      >
                        <Filter className="h-3 w-3" />
                        <span>Reset All Filters</span>
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )}

            {/* Live Records */}
            {!isLoading &&
              records.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-primary-50/30 transition-colors group"
                >
                  {/* 1. Employee ID */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="inline-block font-mono text-xs font-semibold text-secondary-800 bg-secondary-100 border border-secondary-200/80 px-2 py-0.5 rounded-md">
                      {record.employeeNumber}
                    </span>
                  </td>

                  {/* 2. Full Name */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <p className="font-semibold text-secondary-900 group-hover:text-primary-700 transition-colors">
                      {record.fullName}
                    </p>
                  </td>

                  {/* 3. Designation */}
                  <td className="px-4 py-3.5 text-secondary-700">
                    <p className="font-medium text-secondary-800 truncate max-w-[180px]">{record.designation}</p>
                    {record.department && record.department !== "General" && (
                      <p className="text-[11px] text-secondary-400">
                        {record.department}
                      </p>
                    )}
                  </td>

                  {/* 4. Program Name */}
                  <td className="px-5 py-3.5 min-w-[200px]">
                    <p className="font-medium text-secondary-900 group-hover:text-primary-700 transition-colors">
                      {record.programName}
                    </p>
                    <p className="text-[11px] text-secondary-400 font-mono">
                      ID: {record.id.slice(0, 8)}...
                    </p>
                  </td>

                  {/* 5. Training Type */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${getTrainingTypeBadge(
                        record.trainingType
                      )}`}
                    >
                      {record.trainingType}
                    </span>
                  </td>

                  {/* 6. Dates */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-secondary-700">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <Calendar className="h-3.5 w-3.5 text-secondary-400 shrink-0" />
                      <span>{record.startDate}</span>
                    </div>
                    {record.endDate && record.endDate !== record.startDate && (
                      <p className="font-mono text-[10px] text-secondary-400 pl-5">
                        to {record.endDate}
                      </p>
                    )}
                  </td>

                  {/* 7. Duration */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold text-secondary-900">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-secondary-400" />
                      {record.durationHours.toFixed(1)}h
                    </span>
                  </td>

                  {/* 8. Status */}
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getStatusBadge(
                        record.status
                      )}`}
                    >
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && totalRecords > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-secondary-200 bg-secondary-50/60 px-6 py-3.5">
          {/* Records Counter and Page Size Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary-600">
              Showing{" "}
              <span className="font-semibold text-secondary-900">
                {startRecord}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-secondary-900">
                {endRecord}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-secondary-900">
                {totalRecords}
              </span>{" "}
              entries
            </span>

            <div className="flex items-center gap-1.5 pl-2 border-l border-secondary-200">
              <span className="text-xs text-secondary-500">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                aria-label="Records per page"
                className="h-7 rounded border border-secondary-200 bg-white px-2 text-xs font-medium text-secondary-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Page navigation controls */}
          <div className="flex items-center gap-1">
            {/* Previous Page Button */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-secondary-200 bg-white text-secondary-600 hover:bg-secondary-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Numbered Page Buttons */}
            {pageNumbers.map((p, idx) => {
              if (p === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-8 w-8 items-center justify-center text-xs text-secondary-400 select-none"
                  >
                    ...
                  </span>
                );
              }

              const isActive = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => setCurrentPage(p as number)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary-600 text-white shadow-xs"
                      : "border border-secondary-200 bg-white text-secondary-700 hover:bg-secondary-50"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            {/* Next Page Button */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-secondary-200 bg-white text-secondary-600 hover:bg-secondary-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
