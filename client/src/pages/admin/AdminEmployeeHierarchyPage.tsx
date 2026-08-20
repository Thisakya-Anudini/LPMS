import React, { useCallback, useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, CircleDot, Mail, Network, UserRound, UsersRound } from "lucide-react";
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

const getPathStatus = (path: LearnerPath) => {
  const progress = Math.min(100, Math.max(0, Number(path.progress || 0)));
  if (progress === 100 || path.status.toUpperCase() === "COMPLETED") return { label: "Completed", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/10", variant: "success" as const };
  if (progress > 0) return { label: "In progress", className: "bg-amber-50 text-amber-700 ring-amber-600/10", variant: "warning" as const };
  return { label: "Not started", className: "bg-slate-100 text-slate-600 ring-slate-500/10", variant: "default" as const };
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
      <div className="mt-4 text-xs text-slate-500">Loading courses...</div>
    );
  if (courses.length === 0)
    return (
      <div className="mt-4 text-xs text-slate-500">
        No courses found in this path.
      </div>
    );

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      {courses.map((course) => (
        <div key={course.courseId} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">
              {course.title}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {course.stageTitle}
            </span>
          </div>
          <ProgressBar
            progress={Number(course.progress || 0)}
            showLabel
            size="sm"
          />
        </div>
      ))}
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

  const loadLearnerDetails = useCallback(
    async (employee: SelectedHierarchyEmployee) => {
      setSelectedEmployee(employee);
      setLoadingDetails(true);
      setDetailsError(null);

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
        setLearner(response.learner);
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

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary-700"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100"><Network className="h-4 w-4" /></span>Organization workspace</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employee Hierarchy</h1>
          <p className="mt-1 text-slate-500">Explore reporting lines and review learner progress in one place.</p>
        </div>
        <div className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition-transform duration-200 group-hover:scale-105"><UsersRound className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-900">Interactive hierarchy</p><p className="text-xs text-slate-500">Select View to inspect a learner</p></div></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
        <aside className="min-w-0 self-stretch">
          <EmployeeHierarchyPanel
            selectedEmployeeNumber={selectedEmployee?.employeeNumber}
            onViewDetails={loadLearnerDetails}
            onRefresh={() => setSelectedEmployee(null)}
          />
        </aside>

        <section className="min-w-0 self-stretch">
          <Card className="min-h-[520px] shadow-sm xl:h-[calc(100vh-170px)]" bodyClassName="h-full overflow-y-auto p-0">
            <div className="border-b border-slate-100 px-6 py-5"><div className="flex items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-700"><BookOpen className="h-3.5 w-3.5" /> Learner inspection</div><h2 className="text-lg font-semibold text-slate-900">Learner Details</h2><p className="mt-1 text-sm text-slate-500">{selectedEmployee ? `Employee no. ${selectedEmployee.employeeNumber}` : "Select an employee from the hierarchy."}</p></div>{selectedEmployee && <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">Selected</span>}</div></div>
            <div className="p-6">
            {!selectedEmployee ? (
              <div className="flex min-h-[410px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-primary-600 shadow-sm">
                  <UserRound className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-slate-900">No employee selected</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Choose <span className="font-medium text-slate-700">View</span> on any hierarchy employee to inspect their assigned learning paths.
                </p>
              </div>
            ) : loadingDetails ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Skeleton className="mb-3 h-5 w-52" />
                  <Skeleton className="h-4 w-64" />
                </div>
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={`selected-learner-path-skeleton-${index}`}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <Skeleton className="mb-3 h-5 w-60" />
                    <Skeleton className="mb-3 h-3 w-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
              </div>
            ) : detailsError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {detailsError}
              </div>
            ) : learner ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4 rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 to-white p-4 shadow-sm transition-all duration-200 hover:border-primary-200 hover:shadow-md">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-4 ring-white"><UserRound className="h-6 w-6" /></div>
                  <div className="min-w-0"><p className="text-lg font-semibold text-slate-900">{learner.name}</p><p className="truncate text-sm text-slate-500">{selectedEmployee?.designation || "No designation available"}</p>{learner.email && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Mail className="h-3 w-3" />{learner.email}</p>}</div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-900">
                      Assigned Learning Paths ({learningPaths.length})
                    </p>
                  </div>

                  {learningPaths.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      No learning paths assigned to this learner.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {learningPaths.map((path) => {
                        const pathStatus = getPathStatus(path);
                        const isExpanded = expandedPathId === path.enrollment_id;
                        return (
                        <div
                          key={path.enrollment_id}
                          className={`cursor-pointer rounded-xl border bg-white p-4 transition-all duration-200 ease-out ${isExpanded ? "border-primary-300 shadow-md ring-1 ring-primary-100" : "border-slate-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5"}`}
                          onClick={() =>
                            setExpandedPathId(
                              expandedPathId === path.enrollment_id
                                ? null
                                : path.enrollment_id,
                            )
                          }
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0"><p className="font-semibold text-slate-900">{path.title}</p>{path.description && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{path.description}</p>}</div>
                            <div className="flex shrink-0 items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${pathStatus.className}`}>{pathStatus.label === "Completed" ? <CheckCircle2 className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}{pathStatus.label}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} /></div>
                          </div>
                          <ProgressBar
                            progress={Number(path.progress || 0)}
                            showLabel
                            size="sm"
                            variant={pathStatus.variant}
                          />
                          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500"><span className="rounded-md bg-slate-100 px-2 py-1 font-medium">{path.category.replace("_", " ")}</span><span>{path.total_duration}</span></div>
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
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Learner details are not available.
              </p>
            )}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
