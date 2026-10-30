import React, { useEffect, useState, useId } from "react";
import {
  Users,
  Award,
  GraduationCap,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Info,
  Sparkles,
} from "lucide-react";
import { useTalentDashboardScope } from "../../contexts/TalentDashboardScopeContext";
import { useAuth } from "../../contexts/useAuth";
import { talentDashboardApi } from "../../api/talentDashboardApi";
import { TalentKpiMetrics } from "../../types";
import { Skeleton } from "../../components/ui/Skeleton";

interface SemicircularGaugeProps {
  currentValue: number;
  targetValue: number;
  label: string;
  subLabel?: string;
  gradientId: string;
  gradientColors: [string, string];
  isAchieved: boolean;
  isDisabled?: boolean;
  disabledMessage?: string;
  unit?: string;
}

/**
 * Native Semicircular SVG Gauge Component
 * Implements a 180° arc using strokeDasharray & strokeDashoffset.
 * Center at (120, 115) with radius 85px.
 * Total arc length = π * 85 ≈ 267.035px.
 */
function SemicircularGauge({
  currentValue,
  targetValue,
  label,
  subLabel,
  gradientId,
  gradientColors,
  isAchieved,
  isDisabled = false,
  disabledMessage,
  unit = "h",
}: SemicircularGaugeProps) {
  const radius = 85;
  const strokeWidth = 14;
  const cx = 120;
  const cy = 115;
  const arcLength = Math.PI * radius; // ≈ 267.035

  const safeTarget = targetValue > 0 ? targetValue : 18.0;
  const safeCurrent = Math.max(0, currentValue);
  const ratio = Math.min(safeCurrent / safeTarget, 1);
  const strokeDashoffset = isDisabled ? arcLength : arcLength * (1 - ratio);
  const percentage = Math.round((safeCurrent / safeTarget) * 100);

  // Calculate tip indicator coordinate along the arc (from 180° on left to 0° on right)
  const angleRad = Math.PI * (1 - ratio);
  const tipX = cx + radius * Math.cos(angleRad);
  const tipY = cy - radius * Math.sin(angleRad);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="w-full max-w-[280px] aspect-[240/145]">
        <svg
          viewBox="0 0 240 145"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`${label}: ${safeCurrent.toFixed(1)} of ${safeTarget.toFixed(1)}${unit} (${percentage}%)`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColors[0]} />
              <stop offset="100%" stopColor={gradientColors[1]} />
            </linearGradient>

            <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track arc (180° semicircle) */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Scale tick marks at 0%, 50%, 100% */}
          <g className="text-slate-300">
            {/* 0% Tick */}
            <circle cx={cx - radius} cy={cy} r="2" fill="#cbd5e1" />
            {/* 50% Tick */}
            <circle cx={cx} cy={cy - radius} r="2" fill="#cbd5e1" />
            {/* 100% Tick */}
            <circle cx={cx + radius} cy={cy} r="2" fill="#cbd5e1" />
          </g>

          {/* Active progress arc */}
          {!isDisabled && ratio > 0 && (
            <path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={strokeWidth}
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                filter: isAchieved ? `url(#glow-${gradientId})` : undefined,
              }}
            />
          )}

          {/* Indicator dot at tip of progress arc */}
          {!isDisabled && ratio > 0.02 && (
            <g className="transition-all duration-1000 ease-out">
              <circle
                cx={tipX}
                cy={tipY}
                r="6"
                fill="#ffffff"
                stroke={gradientColors[1]}
                strokeWidth="3"
                className="drop-shadow-md"
              />
            </g>
          )}

          {/* Gauge baseline scale labels */}
          <text
            x={cx - radius}
            y={cy + 18}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-medium"
          >
            0{unit}
          </text>
          <text
            x={cx}
            y={cy - radius - 8}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-medium"
          >
            {(safeTarget / 2).toFixed(0)}
            {unit} (50%)
          </text>
          <text
            x={cx + radius}
            y={cy + 18}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-medium"
          >
            {safeTarget.toFixed(0)}
            {unit}+
          </text>
        </svg>
      </div>

      {/* Center Reading Overlay */}
      <div className="absolute top-[38%] left-1/2 -translate-x-1/2 text-center pointer-events-none w-full px-4">
        {isDisabled ? (
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-slate-400 tracking-tight">N/A</span>
            <span className="text-xs text-slate-500 font-medium mt-0.5 max-w-[170px] leading-tight">
              {disabledMessage || "Individual Learner Scope"}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                {safeCurrent.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                / {safeTarget.toFixed(1)}
                {unit}
              </span>
            </div>

            {/* Achievement / Status Pill */}
            <div className="mt-1 inline-flex items-center gap-1">
              {isAchieved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs animate-bounceSubtle">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Target Met ({percentage}%)
                </span>
              ) : ratio >= 0.5 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                  <TrendingUp className="w-3 h-3 text-sky-600" />
                  {percentage}% Achieved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Target className="w-3 h-3 text-amber-600" />
                  {percentage}% Achieved
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface TargetGaugeRowProps {
  /** Optional pre-fetched metrics to avoid redundant network requests */
  metrics?: TalentKpiMetrics | null;
  /** Optional loading state override */
  isLoading?: boolean;
  /** Layout orientation: "horizontal" (2-col grid) or "vertical" (stacked 1-col) */
  layout?: "horizontal" | "vertical";
  className?: string;
}

export function TargetGaugeRow({
  metrics: externalMetrics,
  isLoading: externalIsLoading,
  layout = "horizontal",
  className = "",
}: TargetGaugeRowProps) {
  const { filters, viewAsUser, refreshKey, refreshData } = useTalentDashboardScope();
  const { getAccessToken } = useAuth();

  const [internalMetrics, setInternalMetrics] = useState<TalentKpiMetrics | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const staffGradId = useId().replace(/:/g, "") + "-staff-grad";
  const selfGradId = useId().replace(/:/g, "") + "-self-grad";

  const metrics = externalMetrics !== undefined ? externalMetrics : internalMetrics;
  const isLoading = externalIsLoading !== undefined ? externalIsLoading : internalLoading;

  useEffect(() => {
    // Skip internal fetch if metrics are supplied externally
    if (externalMetrics !== undefined) {
      return;
    }

    let isMounted = true;

    async function loadMetrics() {
      setInternalLoading(true);
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
          setInternalMetrics(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load target gauge data");
        }
      } finally {
        if (isMounted) {
          setInternalLoading(false);
        }
      }
    }

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [externalMetrics, getAccessToken, filters, viewAsUser, refreshKey]);

  // Loading Skeleton State (Matches exact card dimensions to eliminate CLS)
  if (isLoading) {
    const containerClass =
      layout === "vertical"
        ? "flex flex-col gap-6"
        : "grid grid-cols-1 md:grid-cols-2 gap-6";
    return (
      <div className={`${containerClass} ${className}`}>
        {Array.from({ length: 2 }).map((_, idx) => (
          <div
            key={`gauge-skeleton-${idx}`}
            className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-48 rounded" />
              </div>
              <Skeleton className="h-10 w-10 rounded-2xl" />
            </div>

            <div className="flex justify-center py-4">
              <Skeleton className="h-32 w-56 rounded-t-full" />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error State with Retry
  if (error || !metrics) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-5 text-rose-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-xl text-rose-600">
            <AlertCircle className="h-5 w-5 shrink-0" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Unable to load Target Achievement Gauges
            </p>
            <p className="text-xs text-rose-700">
              {error || "An error occurred while fetching training hours targets."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refreshData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors shadow-xs"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const targetHours = Number(metrics.targetHours) || 18.0;
  const avgStaffHours = Number(metrics.averageTrainingHours) || 0;
  const selfHours = Number(metrics.selfTrainingHours) || 0;
  const totalStaff = Number(metrics.totalStaff) || 0;
  const totalHours = Number(metrics.totalTrainingHours) || 0;

  const isStaffTargetMet = avgStaffHours >= targetHours;
  const isSelfTargetMet = selfHours >= targetHours;

  const staffRemaining = Math.max(0, targetHours - avgStaffHours);
  const staffSurplus = Math.max(0, avgStaffHours - targetHours);

  const selfRemaining = Math.max(0, targetHours - selfHours);
  const selfSurplus = Math.max(0, selfHours - targetHours);

  const hasSubordinates = totalStaff > 0;

  const containerClass =
    layout === "vertical"
      ? "flex flex-col gap-6"
      : "grid grid-cols-1 md:grid-cols-2 gap-6";
  return (
    <div className={`${containerClass} ${className}`}>
      {/* 1. Staff Target vs. 18.0h Gauge */}
      <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Staff Target vs. Achievement
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Average completed hours per subordinate against the 18.0h corporate benchmark
            </p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-2.5 text-sky-600 shadow-xs">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Dial Visual */}
        <div className="py-4">
          <SemicircularGauge
            currentValue={avgStaffHours}
            targetValue={targetHours}
            label="Staff Target Progress"
            gradientId={staffGradId}
            gradientColors={
              isStaffTargetMet
                ? ["#10b981", "#059669"]
                : avgStaffHours >= targetHours / 2
                  ? ["#0284c7", "#10b981"]
                  : ["#f59e0b", "#0284c7"]
            }
            isAchieved={isStaffTargetMet && hasSubordinates}
            isDisabled={!hasSubordinates}
            disabledMessage="No subordinate staff under current scope"
          />
        </div>

        {/* Bottom Breakdown Stats */}
        <div className="pt-4 border-t border-slate-100">
          {hasSubordinates ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500">In-Scope Staff</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {totalStaff.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500">Team Total</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {totalHours.toFixed(1)}
                  <span className="text-[10px] text-slate-500 ml-0.5">h</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500">Benchmark Gap</p>
                <p
                  className={`text-sm font-bold mt-0.5 ${isStaffTargetMet ? "text-emerald-600" : "text-amber-600"
                    }`}
                >
                  {isStaffTargetMet ? `+${staffSurplus.toFixed(1)}h` : `-${staffRemaining.toFixed(1)}h`}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 flex items-center gap-2 text-xs text-slate-600">
              <Info className="h-4 w-4 text-slate-400 shrink-0" />
              <span>
                Standard Employee role: Subordinate team gauges activate when managing direct reports.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Self Target vs. 18.0h Gauge */}
      <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Self Target vs. Achievement
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Personal learning hours tracked against the mandatory 18.0h annual target
            </p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-2.5 text-violet-600 shadow-xs">
            <GraduationCap className="h-5 w-5" />
          </div>
        </div>

        {/* Dial Visual */}
        <div className="py-4">
          <SemicircularGauge
            currentValue={selfHours}
            targetValue={targetHours}
            label="Personal Target Progress"
            gradientId={selfGradId}
            gradientColors={
              isSelfTargetMet
                ? ["#10b981", "#059669"]
                : selfHours >= targetHours / 2
                  ? ["#8b5cf6", "#0ea5e9"]
                  : ["#f59e0b", "#8b5cf6"]
            }
            isAchieved={isSelfTargetMet}
          />
        </div>

        {/* Bottom Breakdown Stats */}
        <div className="pt-4 border-t border-slate-100">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <p className="text-[11px] font-medium text-slate-500">My Completed</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {selfHours.toFixed(1)}
                <span className="text-[10px] text-slate-500 ml-0.5">h</span>
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <p className="text-[11px] font-medium text-slate-500">Corporate Target</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {targetHours.toFixed(1)}
                <span className="text-[10px] text-slate-500 ml-0.5">h</span>
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <p className="text-[11px] font-medium text-slate-500">Status</p>
              <p
                className={`text-sm font-bold mt-0.5 ${isSelfTargetMet ? "text-emerald-600" : "text-amber-600"
                  }`}
              >
                {isSelfTargetMet ? `+${selfSurplus.toFixed(1)}h Surplus` : `${selfRemaining.toFixed(1)}h Left`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
