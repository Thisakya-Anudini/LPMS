import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Globe, Lock } from "lucide-react";
import { learningApi } from "../../api/lpmsApi";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

type LearningPathRow = {
  id: string;
  title: string;
  description: string;
  category: "PUBLIC" | "RESTRICTED";
  total_duration: string;
  status: string;
  created_at: string;
};

export function AdminLearningPathsPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 12;
  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const loadPaths = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }
      const response = await learningApi.getLearningPaths(token);
      setPaths(response.learningPaths as LearningPathRow[]);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load learning paths.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadPaths();
  }, [loadPaths]);

  const filteredPaths = useMemo(() => {
    let result = paths;

    if (categoryFilter) {
      result = result.filter((path) => path.category === categoryFilter);
    }
    if (statusFilter) {
      result = result.filter((path) => path.status === statusFilter);
    }

    const normalized = query.trim().toLowerCase();
    if (normalized) {
      result = result.filter(
        (path) =>
          path.title.toLowerCase().includes(normalized) ||
          path.description.toLowerCase().includes(normalized),
      );
    }
    return result;
  }, [paths, query, categoryFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPaths.length / PAGE_SIZE));
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages],
  );

  const paginatedPaths = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredPaths.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredPaths, page]);

  const handleResetFilters = () => {
    setQuery("");
    setCategoryFilter("");
    setStatusFilter("");
  };

  const openPathDetail = (pathId: string) => {
    navigate(`/admin/learning-paths/${pathId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Learning Paths</h1>
        <p className="text-slate-500">
          Browse learning paths, included courses, and enrolled learner
          progress.
        </p>
      </div>

      <Card
        title="All Learning Paths"
        className="max-h-[calc(100vh-12rem)] flex flex-col"
        bodyClassName="min-h-0 flex-1"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
            <div>Page {page} of {totalPages}</div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="h-8 rounded-lg border border-secondary-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="h-8 rounded-lg border border-secondary-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                &lt;
              </button>
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-8 min-w-[2rem] rounded-full border px-2 text-sm transition-colors duration-200 ${
                    pageNumber === page
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-secondary-200 bg-white text-slate-700 hover:bg-secondary-100'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="h-8 rounded-lg border border-secondary-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                &gt;
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="h-8 rounded-lg border border-secondary-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Last
              </button>
            </div>
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search Learning paths..."
              className="pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center">
            <Select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              options={[
                { value: "", label: "All Categories" },
                { value: "PUBLIC", label: "Public" },
                { value: "RESTRICTED", label: "Restricted" },
              ]}
              className="min-w-[180px]"
            />
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "ACTIVE", label: "Active" },
                { value: "DRAFT", label: "Draft" },
                { value: "ARCHIVED", label: "Archived" },
              ]}
              className="min-w-[180px]"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleResetFilters}
              disabled={!query && !categoryFilter && !statusFilter}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Duration</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">
                    Loading learning paths...
                  </td>
                </tr>
              ) : filteredPaths.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">
                    No learning paths found.
                  </td>
                </tr>
              ) : (
                paginatedPaths.map((path) => (
                  <tr
                    key={path.id}
                    onClick={() => openPathDetail(path.id)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {path.title}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          path.category === "RESTRICTED" ? "danger" : "success"
                        }
                      >
                        <span className="flex items-center gap-1.5">
                          {path.category === "RESTRICTED" ? (
                            <Lock className="h-3 w-3 text-black" />
                          ) : (
                            <Globe className="h-3 w-3 text-blue-500" />
                          )}
                          {path.category.replace("_", " ")}
                        </span>
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {path.total_duration}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          path.status === "ACTIVE"
                            ? "success"
                            : path.status === "DRAFT"
                              ? "warning"
                              : "default"
                        }
                      >
                        {path.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
          <div>Page {page} of {totalPages}</div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="h-8 rounded-lg border border-secondary-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="h-8 rounded-lg border border-secondary-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &lt;
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`h-8 min-w-[2rem] rounded-full border px-2 text-sm transition-colors duration-200 ${
                  pageNumber === page
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-secondary-200 bg-white text-slate-700 hover:bg-secondary-100'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="h-8 rounded-lg border border-secondary-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="h-8 rounded-lg border border-secondary-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Last
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
