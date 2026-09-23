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
  Users,
} from "lucide-react";
import { learningApi, superAdminApi } from "../../api/lpmsApi";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
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
        delivery_mode?: "ONLINE" | "PHYSICAL";
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

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setPopupSection("DETAILS")}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            popupSection === "DETAILS"
              ? "bg-blue-100 border-blue-300 text-blue-800"
              : "bg-white border-slate-200 text-slate-700"
          }`}
        >
          Learning Path Details
        </button>
        <button
          type="button"
          onClick={() => setPopupSection("ENROLLMENTS")}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            popupSection === "ENROLLMENTS"
              ? "bg-blue-100 border-blue-300 text-blue-800"
              : "bg-white border-slate-200 text-slate-700"
          }`}
        >
          Enrolled Learners & Progress
        </button>
      </div>

      {popupSection === "DETAILS" ? (
        <Card title="Courses">
          {loading ? (
            <p className="text-sm text-slate-500">Loading courses...</p>
          ) : stagedCourses.length === 0 ? (
            <p className="text-sm text-slate-500">
              No courses found for this learning path.
            </p>
          ) : (
            <div className="space-y-2">
              {stagedCourses.map((stage) => (
                <div
                  key={stage.id}
                  className="p-2 rounded border border-slate-200 bg-white text-sm text-slate-800"
                >
                  <p className="font-semibold text-slate-900">
                    Stage {stage.stage_order}: {stage.title}
                  </p>
                  <div className="mt-1 space-y-1">
                    {(stage.courses || []).map((course) => (
                      <p key={course.course_id} className="text-slate-700">
                        {course.course_order}. {course.title}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card title="Enrolled Learners & Progress">
          {loading ? (
            <p className="text-sm text-slate-500">Loading enrollments...</p>
          ) : pathEnrollments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No learners enrolled in this learning path yet.
            </p>
          ) : (
            <div className="space-y-2">
              {pathEnrollments.map((enrollment) => (
                <div
                  key={enrollment.enrollment_id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {enrollment.name} ({enrollment.employee_number})
                      </p>
                      <p className="text-xs text-slate-500">
                        {enrollment.designation || "-"} | {enrollment.email}
                      </p>
                    </div>
                    <span className="text-xs text-slate-600">
                      {enrollment.status.replace("_", " ")}
                    </span>
                  </div>
                  <ProgressBar
                    progress={Number(enrollment.progress || 0)}
                    showLabel
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
