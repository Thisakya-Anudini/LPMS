import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  Globe,
  Layers,
  MapPin,
  MonitorPlay,
  X,
} from "lucide-react";
import { learnerApi } from "../../api/lpmsApi";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ModalOverlay } from "../../components/ui/ModalOverlay";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

type LearnerPublicPathsPanelProps = {
  showHeader?: boolean;
  cardTitle?: string;
};

export function LearnerPublicPathsPanel({
  showHeader = true,
  cardTitle = "Public Learning Paths - Self Enrollment",
}: LearnerPublicPathsPanelProps) {
  const { getAccessToken, user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selfEnrollLoadingId, setSelfEnrollLoadingId] = useState<string | null>(
    null,
  );
  const [publicLearningPaths, setPublicLearningPaths] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      total_duration: string;
      already_enrolled: boolean;
    }>
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [pathDetail, setPathDetail] = useState<{
    id: string;
    title: string;
    description: string;
    category: string;
    total_duration: string;
    status: string;
    created_at: string;
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const response = await learnerApi.getPublicPaths(token);
      setPublicLearningPaths(response.learningPaths);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to load public learning paths.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelfEnroll = async (learningPathId: string) => {
    try {
      setSelfEnrollLoadingId(learningPathId);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      await learnerApi.selfEnroll(token, learningPathId);
      showToast("Enrolled successfully.", "success");
      await load();
      window.dispatchEvent(new Event("notifications:updated"));
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to self enroll.",
        "error",
      );
    } finally {
      setSelfEnrollLoadingId(null);
    }
  };

  const handleOpenDetails = async (learningPathId: string) => {
    try {
      setSelectedPathId(learningPathId);
      setDetailLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const response = await learnerApi.getPublicPathById(
        token,
        learningPathId,
      );
      setPathDetail(response.learningPath);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to load learning path details.",
        "error",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closePopup = () => {
    setSelectedPathId(null);
    setPathDetail(null);
  };

  const formattedCreatedAt = useMemo(() => {
    if (!pathDetail?.created_at) {
      return "-";
    }
    const parsed = new Date(pathDetail.created_at);
    if (Number.isNaN(parsed.getTime())) {
      return pathDetail.created_at;
    }
    return parsed.toLocaleString();
  }, [pathDetail?.created_at]);

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Public Learning Paths
          </h1>
          <p className="text-slate-500">
            Self enroll to available public learning paths.
          </p>
          {user?.name ? (
            <p className="text-sm text-slate-500 mt-1">Learner: {user.name}</p>
          ) : null}
        </div>
      ) : null}

      <Card title={cardTitle}>
        <div className="space-y-3">
          {publicLearningPaths.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">
              No public learning paths available.
            </p>
          ) : (
            publicLearningPaths.map((path) => (
              <div
                key={path.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{path.title}</p>
                  <p className="text-xs text-slate-500">{path.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleOpenDetails(path.id)}
                  >
                    View Details
                  </Button>
                  <Button
                    onClick={() => handleSelfEnroll(path.id)}
                    isLoading={selfEnrollLoadingId === path.id}
                    disabled={path.already_enrolled}
                    className="w-40"
                  >
                    {path.already_enrolled ? "Already Enrolled" : "Self Enroll"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {selectedPathId ? (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-5 sm:px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Learning Path Details
                  </h2>
                  <p className="text-xs text-slate-500">
                    Curriculum structure and course syllabus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePopup}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
              {detailLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent mb-3" />
                  <p className="text-sm font-medium text-slate-600">
                    Loading learning path details...
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Please wait while the curriculum is retrieved
                  </p>
                </div>
              ) : !pathDetail ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Select a learning path to view details and courses.
                </div>
              ) : (
                <>
                  {/* Path Overview Card */}
                  <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50/70 via-white to-sky-50/30 p-4 sm:p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 max-w-md">
                        <h3 className="text-base font-bold text-slate-900">
                          {pathDetail.title}
                        </h3>
                        {pathDetail.description && (
                          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                            {pathDetail.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="default"
                          className="flex items-center gap-1 bg-slate-100 text-slate-700 font-semibold"
                        >
                          <Globe className="h-3 w-3 text-slate-500" />
                          {pathDetail.category?.replace("_", " ") || "PUBLIC"}
                        </Badge>
                        <Badge variant="success" className="font-semibold">
                          {pathDetail.status || "ACTIVE"}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                      {pathDetail.total_duration && (
                        <div className="flex items-center gap-1.5 font-medium text-slate-600">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>Duration: {pathDetail.total_duration}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 font-medium text-slate-600">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>Created: {formattedCreatedAt}</span>
                      </div>
                    </div>
                  </div>

                  {/* Courses & Stages Curriculum */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary-600" />
                        <h4 className="text-sm font-bold text-slate-900">
                          Curriculum & Stages
                        </h4>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5">
                        {pathDetail.stages.length}{" "}
                        {pathDetail.stages.length === 1 ? "Stage" : "Stages"}
                      </span>
                    </div>

                    {pathDetail.stages.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                        No courses found for this learning path.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pathDetail.stages
                          .slice()
                          .sort((a, b) => a.stage_order - b.stage_order)
                          .map((stage) => {
                            const courses = (stage.courses || [])
                              .slice()
                              .sort((a, b) => a.course_order - b.course_order);

                            return (
                              <div
                                key={stage.id}
                                className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
                              >
                                {/* Stage Header */}
                                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                                  <div className="flex items-center gap-2.5">
                                    <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700 ring-1 ring-inset ring-primary-200/60">
                                      Stage {stage.stage_order}
                                    </span>
                                    <p className="font-semibold text-slate-900 text-sm">
                                      {stage.title}
                                    </p>
                                  </div>
                                  <span className="text-xs font-medium text-slate-400">
                                    {courses.length}{" "}
                                    {courses.length === 1
                                      ? "Course"
                                      : "Courses"}
                                  </span>
                                </div>

                                {/* Courses List */}
                                {courses.length === 0 ? (
                                  <p className="pt-3 text-xs text-slate-400 italic">
                                    No courses in this stage.
                                  </p>
                                ) : (
                                  <div className="pt-2.5 space-y-1.5">
                                    {courses.map((course) => (
                                      <div
                                        key={course.course_id}
                                        className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-50/80 transition-colors"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                            {course.course_order}
                                          </span>
                                          <span className="text-sm font-medium text-slate-800 truncate">
                                            {course.title}
                                          </span>
                                        </div>

                                        {course.delivery_mode === "ONLINE" ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200/70 shrink-0">
                                            <MonitorPlay className="h-3 w-3" />
                                            Online
                                          </span>
                                        ) : course.delivery_mode ===
                                          "PHYSICAL" ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/70 shrink-0">
                                            <MapPin className="h-3 w-3" />
                                            Physical
                                          </span>
                                        ) : course.delivery_mode &&
                                          course.delivery_mode !== "N/A" ? (
                                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 shrink-0">
                                            {course.delivery_mode}
                                          </span>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200/80 bg-slate-50/70 px-6 py-3.5 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closePopup}
                className="min-w-[90px]"
              >
                Close
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

export function LearnerPublicPathsPage() {
  return <LearnerPublicPathsPanel />;
}
