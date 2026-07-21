import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Globe, Lock } from "lucide-react";
import { learningApi } from "../../api/lpmsApi";
import { Badge } from "../../components/ui/Badge";
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
  const [paths, setPaths] = useState<LearningPathRow[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

      <Card title="All Learning Paths">
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
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Status</th>
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
                filteredPaths.map((path) => (
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
      </Card>
    </div>
  );
}
