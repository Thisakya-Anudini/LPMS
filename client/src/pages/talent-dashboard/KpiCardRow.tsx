import React, { useEffect, useState } from "react";
import {
    Users,
    Clock,
    Award,
    GraduationCap,
    TrendingUp,
    Target,
    AlertCircle,
    RotateCw,
} from "lucide-react";
import { useTalentDashboardScope } from "../../contexts/TalentDashboardScopeContext";
import { useAuth } from "../../contexts/useAuth";
import { talentDashboardApi } from "../../api/talentDashboardApi";
import { TalentKpiMetrics } from "../../types";
import { Skeleton } from "../../components/ui/Skeleton";

export function KpiCardRow() {
    const { filters, viewAsUser, refreshKey, refreshData } =
        useTalentDashboardScope();
    const { getAccessToken } = useAuth();

    const [metrics, setMetrics] = useState<TalentKpiMetrics | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function loadKpis() {
            setIsLoading(true);
            setError(null);

            try {
                const token = await getAccessToken();
                if (!token) {
                    throw new Error("Session expired. Please log in again.");
                }

                const data = await talentDashboardApi.getKpiMetrics(token, {
                    ...filters,
                    viewAsId: viewAsUser?.principalId,
                });

                if (isMounted) {
                    setMetrics(data);
                }
            } catch (err) {
                if (isMounted) {
                    setError(
                        err instanceof Error ? err.message : "Failed to load KPI metrics",
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        loadKpis();

        return () => {
            isMounted = false;
        };
    }, [getAccessToken, filters, viewAsUser, refreshKey]);

    // Loading Skeleton State (Zero layout shift)
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                        key={`kpi-skeleton-${idx}`}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-28 rounded" />
                            <Skeleton className="h-10 w-10 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-24 rounded" />
                            <Skeleton className="h-3 w-36 rounded" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                ))}
            </div>
        );
    }

    // Error State with Retry
    if (error || !metrics) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-800 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                    <span>{error || "Unable to display KPI summary metrics."}</span>
                </div>
                <button
                    type="button"
                    onClick={refreshData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors shadow-sm"
                >
                    <RotateCw className="h-3.5 w-3.5" />
                    Retry
                </button>
            </div>
        );
    }

    const targetHours = Number(metrics.targetHours) || 18.0;
    const avgHours = Number(metrics.averageTrainingHours) || 0;
    const selfHours = Number(metrics.selfTrainingHours) || 0;
    const totalStaff = Number(metrics.totalStaff) || 0;
    const totalHours = Number(metrics.totalTrainingHours) || 0;

    const avgProgressPct = Math.min(
        Math.round((avgHours / targetHours) * 100),
        100,
    );
    const selfProgressPct = Math.min(
        Math.round((selfHours / targetHours) * 100),
        100,
    );

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Total Staff */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Total Staff
                        </p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                            {totalStaff.toLocaleString()}
                        </h3>
                    </div>
                    <div className="rounded-xl border border-sky-100 bg-sky-50 p-2.5 text-sky-600 shadow-sm">
                        <Users className="h-5 w-5" />
                    </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                        {viewAsUser
                            ? `Subordinates under ${viewAsUser.name}`
                            : "In-scope organizational headcount"}
                    </p>
                </div>
            </div>

            {/* 2. Total Training Hours */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Total Hours
                        </p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                            {totalHours.toLocaleString(undefined, {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                            })}
                            <span className="text-sm font-medium text-slate-500 ml-1">
                                hrs
                            </span>
                        </h3>
                    </div>
                    <div className="rounded-xl border border-violet-100 bg-violet-50 p-2.5 text-violet-600 shadow-sm">
                        <Clock className="h-5 w-5" />
                    </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                        Cumulative learning duration recorded
                    </p>
                </div>
            </div>

            {/* 3. Average Hours vs. 18.0 Target */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Average Hours / Staff
                        </p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                            {avgHours.toFixed(1)}
                            <span className="text-sm font-medium text-slate-500 ml-1">
                                / {targetHours.toFixed(1)}h
                            </span>
                        </h3>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-600 shadow-sm">
                        <Award className="h-5 w-5" />
                    </div>
                </div>
                <div className="mt-4 space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Target Progress</span>
                        <span
                            className={`font-semibold inline-flex items-center gap-1 ${avgHours >= targetHours ? "text-emerald-600" : "text-amber-600"
                                }`}
                        >
                            {avgHours >= targetHours ? (
                                <>
                                    <TrendingUp className="h-3 w-3" /> Met
                                </>
                            ) : (
                                <>
                                    <Target className="h-3 w-3" /> {(targetHours - avgHours).toFixed(1)}h to go
                                </>
                            )}
                        </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${avgHours >= targetHours ? "bg-emerald-500" : "bg-amber-500"
                                }`}
                            style={{ width: `${avgProgressPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 4. Personal Training Hours */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            My Training Hours
                        </p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                            {selfHours.toFixed(1)}
                            <span className="text-sm font-medium text-slate-500 ml-1">
                                / {targetHours.toFixed(1)}h
                            </span>
                        </h3>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-amber-600 shadow-sm">
                        <GraduationCap className="h-5 w-5" />
                    </div>
                </div>
                <div className="mt-4 space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Personal Target</span>
                        <span
                            className={`font-semibold ${selfHours >= targetHours ? "text-emerald-600" : "text-slate-700"
                                }`}
                        >
                            {selfProgressPct}%
                        </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${selfHours >= targetHours ? "bg-emerald-500" : "bg-primary-500"
                                }`}
                            style={{ width: `${selfProgressPct}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
