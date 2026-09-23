import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Layers,
  Lock,
  Mail,
  MapPin,
  MonitorPlay,
  PlayCircle,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { learningApi, superAdminApi } from "../../api/lpmsApi";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

export function AdminLearningPathDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [popupSection, setPopupSection] = useState<"DETAILS" | "ENROLLMENTS">(
    "DETAILS",
  );
  const [learnerQuery, setLearnerQuery] = useState("");
  const [pathDetail, setPathDetail] = useState<{
    id: string;
    title: string;
    description: string;
    category: string;
    total_duration?: string;
    status: string;
    created_at: string;
    certificate_signer_name?: string | null;
    certificate_signer_title?: string | null;
    stages: Array<{
      id: string;
      title: string;
      stage_order: number;
      courses?: Array<{
        course_id: string;
        title: string;
        course_order: number;
        delivery_mode?: string;
      }>;
    }>;
  } | null>(null);

  const [pathEnrollments, setPathEnrollments] = useState<
    Array<{
      enrollment_id: string;
      status: string;
      progress: number;
      enrolled_at: string;
      completed_at?: string;
      principal_id: string;
      name: string;
      email: string;
      employee_number: string;
      designation: string;
      grade_name: string;
    }>
  >([]);

  const formatDate = useCallback((value?: string | null) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  }, []);

  const loadDetails = useCallback(async () => {
    if (!id) {
      return;
    }
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }
      const [detailResponse, enrollmentsResponse] = await Promise.all([
        learningApi.getLearningPathById(token, id),
        superAdminApi.getLearningPathEnrollments(token, id),
      ]);
      setPathDetail(detailResponse.learningPath);
      setPathEnrollments(enrollmentsResponse.enrollments);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to load learning path details.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id, showToast]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const stagedCourses = useMemo(() => {
    if (!pathDetail) {
      return [];
    }
    return pathDetail.stages
      .slice()
      .sort((a, b) => a.stage_order - b.stage_order)
      .map((stage) => ({
        ...stage,
        courses: (stage.courses || [])
          .slice()
          .sort((a, b) => a.course_order - b.course_order),
      }));
  }, [pathDetail]);

  const totalCourseCount = useMemo(() => {
    return stagedCourses.reduce(
      (sum, stage) => sum + (stage.courses?.length || 0),
      0,
    );
  }, [stagedCourses]);

  const averageProgress = useMemo(() => {
    if (pathEnrollments.length === 0) return 0;
    const sum = pathEnrollments.reduce(
      (acc, curr) => acc + Number(curr.progress || 0),
      0,
    );
    return Math.round(sum / pathEnrollments.length);
  }, [pathEnrollments]);

  const filteredEnrollments = useMemo(() => {
    const q = learnerQuery.trim().toLowerCase();
    if (!q) return pathEnrollments;
    return pathEnrollments.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.employee_number && e.employee_number.toLowerCase().includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (e.designation && e.designation.toLowerCase().includes(q)),
    );
  }, [pathEnrollments, learnerQuery]);

  const getEnrollmentStatus = (enrollment: {
    progress: number;
    status: string;
  }) => {
    const progress = Math.min(
      100,
      Math.max(0, Number(enrollment.progress || 0)),
    );
    if (progress === 100 || enrollment.status?.toUpperCase() === "COMPLETED") {
      return {
        label: "Completed",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        progressVariant: "success" as const,
      };
    }
    if (progress > 0 || enrollment.status?.toUpperCase() === "IN_PROGRESS") {
      return {
        label: "In Progress",
        className: "bg-amber-50 text-amber-700 ring-amber-600/20",
        progressVariant: "warning" as const,
      };
    }
    return {
      label: "Not Started",
      className: "bg-slate-100 text-slate-600 ring-slate-500/20",
      progressVariant: "default" as const,
    };
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Gradient Banner */}
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 via-white to-secondary-50 p-6 shadow-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
            Super Admin
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Learning Path Details
          </h1>
          <p className="text-slate-500">
            Review learning path details, curriculum stages, and enrolled
            learner progress.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/admin/learning-paths")}
          className="shrink-0 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Learning Paths
        </Button>
      </div>

      {/* KPI Stats Cards (matching AdminLearningPathsPage) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Curriculum Stages",
            value: stagedCourses.length,
            icon: Layers,
            color: "text-primary-600",
          },
          {
            label: "Total Courses",
            value: totalCourseCount,
            icon: BookOpen,
            color: "text-blue-600",
          },
          {
            label: "Enrolled Learners",
            value: pathEnrollments.length,
            icon: Users,
            color: "text-amber-600",
          },
          {
            label: "Avg. Completion",
            value: `${averageProgress}%`,
            icon: CheckCircle2,
            color: "text-success-600",
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-0" bodyClassName="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {loading ? <Skeleton className="h-7 w-12" /> : stat.value}
                </p>
              </div>
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Path Metadata Card */}
      <Card title="Path Overview">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ) : !pathDetail ? (
          <p className="text-sm text-slate-500">Learning path not found.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {pathDetail.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed max-w-3xl">
                {pathDetail.description || "No description provided."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Badge
                variant={
                  pathDetail.category === "RESTRICTED" ? "danger" : "success"
                }
              >
                <span className="flex items-center gap-1.5">
                  {pathDetail.category === "RESTRICTED" ? (
                    <Lock className="h-3 w-3 text-black" />
                  ) : (
                    <Globe className="h-3 w-3 text-blue-500" />
                  )}
                  {pathDetail.category.replace("_", " ")}
                </span>
              </Badge>

              <Badge
                variant={
                  pathDetail.status === "ACTIVE"
                    ? "success"
                    : pathDetail.status === "DRAFT"
                      ? "warning"
                      : "default"
                }
              >
                {pathDetail.status}
              </Badge>

              {pathDetail.total_duration && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {pathDetail.total_duration}
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                Created: {formatDate(pathDetail.created_at)}
              </span>

              {pathDetail.certificate_signer_name && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                  <Award className="h-3.5 w-3.5 text-primary-500" />
                  Signer: {pathDetail.certificate_signer_name}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Super Admin Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setPopupSection("DETAILS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            popupSection === "DETAILS"
              ? "border-primary-600 text-primary-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Curriculum & Stages</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              popupSection === "DETAILS"
                ? "bg-primary-100 text-primary-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {stagedCourses.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPopupSection("ENROLLMENTS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            popupSection === "ENROLLMENTS"
              ? "border-primary-600 text-primary-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Enrolled Learners</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              popupSection === "ENROLLMENTS"
                ? "bg-primary-100 text-primary-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {pathEnrollments.length}
          </span>
        </button>
      </div>

      {/* Course Stages Section */}
      {popupSection === "DETAILS" ? (
        <div className="space-y-4">
          {loading ? (
            <Card className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </Card>
          ) : stagedCourses.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Layers className="h-6 w-6" />
              </div>
              <p className="font-medium text-slate-700">
                No curriculum stages found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                This learning path does not have any stages or courses defined
                yet.
              </p>
            </Card>
          ) : (
            stagedCourses.map((stage) => (
              <Card
                key={stage.id}
                className="overflow-hidden border-slate-200/80 shadow-sm"
                bodyClassName="p-0"
              >
                {/* Stage Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 bg-slate-50/75 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center rounded-lg bg-primary-100 px-2.5 py-1 text-xs font-bold text-primary-700">
                      Stage {stage.stage_order}
                    </span>
                    <h3 className="font-semibold text-slate-900 text-base">
                      {stage.title}
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {stage.courses?.length || 0}{" "}
                    {(stage.courses?.length || 0) === 1 ? "Course" : "Courses"}
                  </span>
                </div>

                {/* Courses in Stage */}
                <div className="p-4 sm:p-5">
                  {!stage.courses || stage.courses.length === 0 ? (
                    <p className="text-sm text-slate-400 italic py-2">
                      No courses assigned to this stage.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {stage.courses.map((course) => {
                        const titleLower = String(
                          course.title || "",
                        ).toLowerCase();
                        const isOnline =
                          titleLower.includes("online") ||
                          titleLower.includes("elearning") ||
                          titleLower.includes("e-learning");
                        const displayMode = isOnline ? "ONLINE" : "PHYSICAL";

                        return (
                          <div
                            key={course.course_id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all hover:border-primary-200 hover:bg-primary-50/20"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                {course.course_order}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 text-sm truncate">
                                  {course.title}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  isOnline
                                    ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                                    : "bg-emerald-100 text-emerald-600 ring-1 ring-inset ring-emerald-500/20"
                                }`}
                              >
                                {isOnline ? (
                                  <MonitorPlay className="h-3 w-3" />
                                ) : (
                                  <MapPin className="h-3 w-3" />
                                )}
                                {displayMode}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card
          title="Enrolled Learners & Progress"
          className="shadow-sm"
          bodyClassName="p-5 sm:p-6"
        >
          {/* Search bar and counter */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search learners by name or employeeNo"
                className="pl-9 h-9 text-sm"
                value={learnerQuery}
                onChange={(e) => setLearnerQuery(e.target.value)}
              />
            </div>
            <p className="text-xs font-medium text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filteredEnrollments.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {pathEnrollments.length}
              </span>{" "}
              learners
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-3 w-72" />
                  <Skeleton className="mt-3 h-2 w-full" />
                </div>
              ))}
            </div>
          ) : pathEnrollments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Users className="h-6 w-6" />
              </div>
              <p className="font-medium text-slate-700">No learners enrolled</p>
              <p className="mt-1 text-sm text-slate-500">
                No learners have been enrolled in this learning path yet.
              </p>
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium text-slate-700">No matching learners</p>
              <p className="mt-1 text-xs text-slate-500">
                No enrolled learners matched "{learnerQuery}".
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setLearnerQuery("")}
              >
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEnrollments.map((enrollment) => {
                const status = getEnrollmentStatus(enrollment);
                return (
                  <div
                    key={enrollment.enrollment_id}
                    className="rounded-xl border border-slate-200/80 bg-white p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-4 ring-sky-50/60 font-bold text-xs">
                          {enrollment.name ? (
                            enrollment.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()
                          ) : (
                            <UserRound className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 text-sm truncate">
                              {enrollment.name}
                            </p>

                            {enrollment.employee_number && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 shrink-0">
                                {enrollment.employee_number}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                            {enrollment.designation && (
                              <span>{enrollment.designation}</span>
                            )}
                            {enrollment.grade_name && (
                              <>
                                <span>•</span>
                                <span>{enrollment.grade_name}</span>
                              </>
                            )}
                            {enrollment.email && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-slate-400" />
                                  {enrollment.email}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset shrink-0 ${status.className}`}
                      >
                        {status.label === "Completed" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : status.label === "In Progress" ? (
                          <PlayCircle className="h-3 w-3" />
                        ) : null}
                        {status.label}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <ProgressBar
                        progress={Number(enrollment.progress || 0)}
                        showLabel
                        size="sm"
                        variant={status.progressVariant}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
