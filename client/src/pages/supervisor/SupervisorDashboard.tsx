import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, BookOpen, ListChecks, BookPlus, User } from "lucide-react";
import { learnerApi } from "../../api/lpmsApi";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

type TeamMember = {
  employeeNumber: string;
  name: string;
  designation: string;
  gradeName: string;
  email: string;
};

type LearningPath = {
  id: string;
  title: string;
  description: string;
};

type SupervisorTab = "progress" | "assign";

type TeamProgressCourse = {
  courseId: string;
  courseCode: string | null;
  title: string;
  duration: string | null;
  order: number;
  stageTitle: string | null;
  stageOrder: number;
  progress: number;
  isCompleted: boolean;
};

type TeamProgressLearningPath = {
  enrollmentId: string;
  learningPathId: string;
  title: string;
  totalDuration: string | null;
  status: string;
  progress: number;
  enrolledAt: string;
  completedAt: string | null;
  enrollmentSource: string | null;
  totalCourses: number;
  completedCourses: number;
  courses: TeamProgressCourse[];
};

type TeamProgressLearner = {
  employeeNumber: string;
  name: string;
  designation: string;
  gradeName: string;
  email: string;
  totalLearningPaths: number;
  completedLearningPaths: number;
  averageProgress: number;
  learningPaths: TeamProgressLearningPath[];
};

const getEmployeeDisplayName = (row: Record<string, unknown>) => {
  const employeeName =
    typeof row.employeeName === "string" ? row.employeeName.trim() : "";
  if (employeeName) {
    return employeeName;
  }
  const initials =
    typeof row.employeeInitials === "string" ? row.employeeInitials.trim() : "";
  const surname =
    typeof row.employeeSurname === "string" ? row.employeeSurname.trim() : "";
  const merged = `${initials} ${surname}`.trim();
  return merged || "Learner";
};

export function SupervisorDashboard() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [teamProgress, setTeamProgress] = useState<TeamProgressLearner[]>([]);
  const [selectedLearningPathId, setSelectedLearningPathId] = useState("");
  const [selectedTeamNumbers, setSelectedTeamNumbers] = useState<string[]>([]);
  const [employeeNoSearch, setEmployeeNoSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<SupervisorTab>("progress");
  const [expandedLearners, setExpandedLearners] = useState<string[]>([]);
  const [expandedEnrollments, setExpandedEnrollments] = useState<string[]>([]);
  const teamSkeletons = Array.from({ length: 4 }, (_, index) => index);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const [teamResponse, learningPathResponse, progressResponse] =
        await Promise.all([
          learnerApi.getTeam(token),
          learnerApi.getLearningPaths(token),
          learnerApi.getTeamProgressDetails(token),
        ]);

      if (!teamResponse.isSupervisor) {
        const message = "Supervisor access is not enabled for this account.";
        setError(message);
        showToast(message, "error");
        setTeam([]);
        setLearningPaths([]);
        setTeamProgress([]);
        return;
      }

      setTeam(
        (teamResponse.team || []).map((row) => ({
          employeeNumber: String(row.employeeNumber || ""),
          name: getEmployeeDisplayName(row),
          designation: String(row.designation || "-"),
          gradeName: String(row.gradeName || "-"),
          email: String(row.email || "-"),
        })),
      );
      setLearningPaths(learningPathResponse.learningPaths);
      setTeamProgress(progressResponse.learners || []);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load supervisor dashboard.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const assignedPathCount = teamProgress.reduce(
      (sum, learner) => sum + learner.totalLearningPaths,
      0,
    );
    const completedPathCount = teamProgress.reduce(
      (sum, learner) => sum + learner.completedLearningPaths,
      0,
    );
    return {
      teamCount: team.length,
      availablePathCount: learningPaths.length,
      assignedPathCount,
      completedPathCount,
    };
  }, [team.length, learningPaths.length, teamProgress]);

  const designationOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        team
          .map((member) => member.designation.trim())
          .filter((value) => value.length > 0 && value !== "-"),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return ["ALL", ...values];
  }, [team]);

  const filteredTeam = useMemo(() => {
    const employeeNoTerm = employeeNoSearch.trim().toLowerCase();
    const nameTerm = nameSearch.trim().toLowerCase();

    return team.filter((member) => {
      const byEmployeeNo =
        !employeeNoTerm ||
        member.employeeNumber.toLowerCase().includes(employeeNoTerm);
      const byName = !nameTerm || member.name.toLowerCase().includes(nameTerm);
      const byDesignation =
        designationFilter === "ALL" || member.designation === designationFilter;
      return byEmployeeNo && byName && byDesignation;
    });
  }, [designationFilter, employeeNoSearch, nameSearch, team]);

  const filteredTeamProgress = useMemo(() => {
    const filteredNumbers = new Set(
      filteredTeam.map((member) => member.employeeNumber),
    );
    return teamProgress.filter((learner) =>
      filteredNumbers.has(learner.employeeNumber),
    );
  }, [filteredTeam, teamProgress]);

  const toggleTeamMember = (employeeNumber: string) => {
    setSelectedTeamNumbers((prev) =>
      prev.includes(employeeNumber)
        ? prev.filter((id) => id !== employeeNumber)
        : [...prev, employeeNumber],
    );
  };

  const selectAllFiltered = () => {
    const filteredNumbers = filteredTeam.map((member) => member.employeeNumber);
    setSelectedTeamNumbers((prev) => {
      const next = new Set(prev);
      filteredNumbers.forEach((employeeNumber) => next.add(employeeNumber));
      return Array.from(next);
    });
  };

  const clearAllFiltered = () => {
    const filteredSet = new Set(
      filteredTeam.map((member) => member.employeeNumber),
    );
    setSelectedTeamNumbers((prev) =>
      prev.filter((employeeNumber) => !filteredSet.has(employeeNumber)),
    );
  };

  const toggleExpandedLearner = (employeeNumber: string) => {
    setExpandedLearners((prev) =>
      prev.includes(employeeNumber)
        ? prev.filter((value) => value !== employeeNumber)
        : [...prev, employeeNumber],
    );
  };

  const toggleExpandedEnrollment = (enrollmentId: string) => {
    setExpandedEnrollments((prev) =>
      prev.includes(enrollmentId)
        ? prev.filter((value) => value !== enrollmentId)
        : [...prev, enrollmentId],
    );
  };

  const getStatusClassName = (status: string) => {
    if (status === "COMPLETED") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (status === "IN_PROGRESS") {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (status === "OVERDUE") {
      return "bg-red-50 text-red-700 border-red-200";
    }
    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  const handleAssign = async () => {
    if (!selectedLearningPathId || selectedTeamNumbers.length === 0) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const result = await learnerApi.enrollTeam(token, {
        employeeNumbers: selectedTeamNumbers,
        learningPathIds: [selectedLearningPathId],
      });
      showToast(
        `Assigned learning path to ${result.assignedCount} learner(s).`,
        "success",
      );
      setSelectedTeamNumbers([]);
      setSelectedLearningPathId("");
      await load();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to assign learning paths to learners.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Supervisor Dashboard
        </h1>
        <p className="text-slate-500">
          Track subordinate learning progress and assign learning paths.
        </p>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Learners Card */}
        <Card
          className="relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-medium border-l-4 border-l-primary-500 bg-gradient-to-br from-indigo-50/80 to-white"
          bodyClassName="h-28 px-6 py-5 flex flex-col justify-center relative z-10"
        >
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-25 transition-transform duration-300 hover:scale-110 hover:opacity-20">
            <Users size={64} className="text-primary-800" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
            Team Learners
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-16" />
          ) : (
            <p className="mt-2 text-4xl font-extrabold text-slate-900">
              {stats.teamCount}
            </p>
          )}
        </Card>

        {/* Available Learning Paths Card */}
        <Card
          className="relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-medium border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/80 to-white"
          bodyClassName="h-28 px-6 py-5 flex flex-col justify-center relative z-10"
        >
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-25 transition-transform duration-300 hover:scale-110 hover:opacity-20">
            <BookOpen size={64} className="text-emerald-800" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
            Available Learning Paths
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-16" />
          ) : (
            <p className="mt-2 text-4xl font-extrabold text-slate-900">
              {stats.availablePathCount}
            </p>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("progress")}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            activeTab === "progress"
              ? "bg-primary-700 text-white shadow-md ring-1 ring-primary-700/50"
              : "text-slate-600 hover:bg-white hover:text-primary-600 hover:shadow-sm"
          }`}
        >
          <ListChecks
            size={18}
            className={
              activeTab === "progress"
                ? "text-primary-100"
                : "text-slate-400 group-hover:text-primary-500"
            }
          />
          Subordinates Progress
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("assign")}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            activeTab === "assign"
              ? "bg-primary-700 text-white shadow-md ring-1 ring-primary-700/50"
              : "text-slate-600 hover:bg-white hover:text-primary-600 hover:shadow-sm"
          }`}
        >
          <BookPlus
            size={18}
            className={
              activeTab === "assign"
                ? "text-primary-100"
                : "text-slate-400 group-hover:text-primary-500"
            }
          />
          Assign Learning Paths
        </button>
      </div>

      {activeTab === "progress" ? (
        <Card title="Subordinates Progress" bodyClassName="p-4">
          {loading ? (
            <div className="space-y-3">
              {teamSkeletons.map((index) => (
                <div
                  key={`progress-skeleton-${index}`}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-3 h-4 w-72" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-slate-200 p-3">
                <Input
                  label="Search by Employee No"
                  value={employeeNoSearch}
                  onChange={(event) => setEmployeeNoSearch(event.target.value)}
                  placeholder="e.g. 011338"
                />
                <Input
                  label="Search by Name"
                  value={nameSearch}
                  onChange={(event) => setNameSearch(event.target.value)}
                  placeholder="e.g. Tennakoon"
                />
                <Select
                  label="Filter by Designation"
                  value={designationFilter}
                  onChange={(event) => setDesignationFilter(event.target.value)}
                  options={designationOptions.map((option) => ({
                    value: option,
                    label: option,
                  }))}
                />
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Click a subordinate to view assigned learning paths, then click
                “Show Courses” on a learning path to view course progress.
              </div>
              {filteredTeamProgress.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No assigned learning path progress found for the current
                  subordinate filters.
                </p>
              ) : (
                filteredTeamProgress.map((learner) => {
                  const learnerExpanded = expandedLearners.includes(
                    learner.employeeNumber,
                  );
                  return (
                    <div
                      key={learner.employeeNumber}
                      className="rounded-lg border border-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleExpandedLearner(learner.employeeNumber)
                        }
                        className="flex w-full flex-col gap-4 p-3 text-left transition-colors hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 ring-4 ring-primary-50">
                            <User size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {learner.name}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              {learner.employeeNumber}{" "}
                              <span className="mx-1 text-slate-300">|</span>{" "}
                              {learner.designation || "-"}{" "}
                              <span className="mx-1 text-slate-300">|</span>{" "}
                              {learner.gradeName || "-"}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`min-w-full rounded-lg px-4 py-3 md:min-w-[320px] ${
                            learner.averageProgress === 100
                              ? "bg-emerald-50/80 border border-emerald-100"
                              : "bg-slate-50 border border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span
                              className={
                                learner.averageProgress === 100
                                  ? "text-emerald-700"
                                  : "text-slate-600"
                              }
                            >
                              {learner.completedLearningPaths}/
                              {learner.totalLearningPaths} LP completed
                            </span>
                            <span
                              className={`font-bold ${learner.averageProgress === 100 ? "text-emerald-700" : "text-slate-900"}`}
                            >
                              {learner.averageProgress}%
                            </span>
                          </div>
                          <div
                            className={`mt-2 h-2 rounded-full ${learner.averageProgress === 100 ? "bg-emerald-200" : "bg-slate-200"}`}
                          >
                            <div
                              className={`h-2 rounded-full ${learner.averageProgress === 100 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-blue-500"}`}
                              style={{
                                width: `${Math.min(100, Math.max(0, learner.averageProgress))}%`,
                              }}
                            />
                          </div>
                        </div>
                      </button>

                      {learnerExpanded ? (
                        <div className="space-y-3 border-t border-slate-100 bg-white p-4">
                          {learner.learningPaths.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              No learning paths assigned yet.
                            </p>
                          ) : (
                            learner.learningPaths.map((path) => {
                              const enrollmentExpanded =
                                expandedEnrollments.includes(path.enrollmentId);
                              return (
                                <div
                                  key={path.enrollmentId}
                                  className="rounded-md border border-slate-200 p-3"
                                >
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <p className="font-medium text-slate-900">
                                        {path.title}
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                        <span
                                          className={`rounded-full border px-2 py-0.5 ${getStatusClassName(path.status)}`}
                                        >
                                          {path.status.replace("_", " ")}
                                        </span>
                                        <span>
                                          {path.completedCourses}/
                                          {path.totalCourses} courses completed
                                        </span>
                                        {path.totalDuration ? (
                                          <span>{path.totalDuration}</span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div
                                      className={`min-w-full rounded-lg px-4 py-2 md:min-w-[240px] ${path.progress === 100 ? "bg-emerald-50/50 border" : "bg-sky-50/50 border"}`}
                                    >
                                      <div className="flex items-center justify-between text-xs font-medium">
                                        <span
                                          className={
                                            path.progress === 100
                                              ? "text-emerald-700"
                                              : "text-sky-700"
                                          }
                                        >
                                          Progress
                                        </span>
                                        <span
                                          className={`font-bold ${path.progress === 100 ? "text-emerald-700" : "text-sky-900"}`}
                                        >
                                          {path.progress}%
                                        </span>
                                      </div>
                                      <div
                                        className={`mt-1.5 h-1.5 rounded-full ${path.progress === 100 ? "bg-emerald-200" : "bg-sky-200"}`}
                                      >
                                        <div
                                          className={`h-1.5 rounded-full ${path.progress === 100 ? "bg-emerald-500" : "bg-sky-500"}`}
                                          style={{
                                            width: `${Math.min(100, Math.max(0, path.progress))}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-3"
                                    onClick={() =>
                                      toggleExpandedEnrollment(
                                        path.enrollmentId,
                                      )
                                    }
                                  >
                                    {enrollmentExpanded
                                      ? "Hide Courses"
                                      : "Show Courses"}
                                  </Button>
                                  {enrollmentExpanded ? (
                                    <div className="mt-3 overflow-auto">
                                      {path.courses.length === 0 ? (
                                        <p className="text-sm text-slate-500">
                                          No courses configured for this
                                          learning path.
                                        </p>
                                      ) : (
                                        <div className="min-w-[680px]">
                                          <div className="grid grid-cols-[0.6fr_1.5fr_1fr_0.7fr_0.7fr] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <span>Order</span>
                                            <span>Course</span>
                                            <span>Stage</span>
                                            <span>Status</span>
                                            <span>Progress</span>
                                          </div>
                                          {path.courses.map((course) => (
                                            <div
                                              key={`${path.enrollmentId}-${course.courseId}-${course.order}`}
                                              className="grid grid-cols-[0.6fr_1.5fr_1fr_0.7fr_0.7fr] gap-3 border-b border-slate-100 px-3 py-2 text-sm text-slate-600"
                                            >
                                              <span>{course.order || "-"}</span>
                                              <span>
                                                <span className="font-medium text-slate-800">
                                                  {course.title}
                                                </span>
                                                {course.courseCode ? (
                                                  <span className="block text-xs text-slate-400">
                                                    {course.courseCode}
                                                  </span>
                                                ) : null}
                                              </span>
                                              <span>
                                                {course.stageTitle || "-"}
                                              </span>
                                              <span
                                                className={
                                                  course.isCompleted
                                                    ? "text-emerald-600"
                                                    : "text-slate-500"
                                                }
                                              >
                                                {course.isCompleted
                                                  ? "Completed"
                                                  : "Pending"}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                                                  <div
                                                    className={`h-1.5 rounded-full ${course.isCompleted ? "bg-emerald-500" : "bg-primary-400"}`}
                                                    style={{
                                                      width: `${Math.min(100, Math.max(0, course.progress))}%`,
                                                    }}
                                                  />
                                                </div>
                                                <span className="w-8 text-right font-medium">
                                                  {course.progress}%
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === "assign" ? (
        <Card title="Assign Learning Paths" bodyClassName="p-4">
          <div className="space-y-4">
            {loading ? (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Learning Path
                </p>
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ) : (
              <Select
                label="Learning Path"
                value={selectedLearningPathId}
                onChange={(event) =>
                  setSelectedLearningPathId(event.target.value)
                }
                options={[
                  { value: "", label: "Select a learning path" },
                  ...learningPaths.map((path) => ({
                    value: path.id,
                    label: path.title,
                  })),
                ]}
              />
            )}

            <div className="max-h-80 overflow-auto border border-slate-200 rounded-md p-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-2 border-b border-slate-200 mb-2">
                <Input
                  label="Search by Employee No"
                  value={employeeNoSearch}
                  onChange={(event) => setEmployeeNoSearch(event.target.value)}
                  placeholder="e.g. 011338"
                />
                <Input
                  label="Search by Name"
                  value={nameSearch}
                  onChange={(event) => setNameSearch(event.target.value)}
                  placeholder="e.g. Tennakoon"
                />
                <Select
                  label="Filter by Designation"
                  value={designationFilter}
                  onChange={(event) => setDesignationFilter(event.target.value)}
                  options={designationOptions.map((option) => ({
                    value: option,
                    label: option,
                  }))}
                />
              </div>

              <div className="flex items-center justify-between px-2 pb-2">
                <p className="text-xs text-slate-500">
                  Filtered learners: {filteredTeam.length} | Selected:{" "}
                  {selectedTeamNumbers.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={selectAllFiltered}
                    disabled={filteredTeam.length === 0}
                  >
                    Select All Filtered
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={clearAllFiltered}
                    disabled={filteredTeam.length === 0}
                  >
                    Clear Filtered
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="space-y-2 p-2">
                  {teamSkeletons.map((index) => (
                    <div
                      key={`team-skeleton-${index}`}
                      className="grid grid-cols-[44px_1.4fr_0.9fr_1.1fr_0.9fr_1.4fr] items-center gap-3"
                    >
                      <Skeleton className="h-4 w-4 rounded-sm" />
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-48" />
                    </div>
                  ))}
                </div>
              ) : team.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">
                  No learners found under this supervisor.
                </p>
              ) : filteredTeam.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">
                  No learners match current filters.
                </p>
              ) : (
                <div className="min-w-[840px]">
                  <div className="grid grid-cols-[44px_1.4fr_0.9fr_1.1fr_0.9fr_1.4fr] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Select</span>
                    <span>Name</span>
                    <span>Emp No</span>
                    <span>Designation</span>
                    <span>Grade</span>
                    <span>Email</span>
                  </div>
                  {filteredTeam.map((member) => (
                    <label
                      key={member.employeeNumber}
                      className="grid grid-cols-[44px_1.4fr_0.9fr_1.1fr_0.9fr_1.4fr] items-center gap-3 border-b border-slate-100 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTeamNumbers.includes(
                          member.employeeNumber,
                        )}
                        onChange={() => toggleTeamMember(member.employeeNumber)}
                        className="shrink-0"
                      />
                      <span className="font-medium text-slate-900">
                        {member.name}
                      </span>
                      <span>{member.employeeNumber}</span>
                      <span>{member.designation || "-"}</span>
                      <span>{member.gradeName || "-"}</span>
                      <span>{member.email || "-"}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleAssign}
              isLoading={saving}
              disabled={
                !selectedLearningPathId || selectedTeamNumbers.length === 0
              }
            >
              Assign Enrollments
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
