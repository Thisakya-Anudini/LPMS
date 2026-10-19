import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  Calendar,
  AlertCircle,
  RotateCw,
  BarChart2,
  Clock,
} from "lucide-react";
import { useTalentDashboardScope } from "../../contexts/TalentDashboardScopeContext";
import { useAuth } from "../../contexts/useAuth";
import { talentDashboardApi } from "../../api/talentDashboardApi";
import { TrendDataPoint } from "../../types";
import { Skeleton } from "../../components/ui/Skeleton";

type ActiveMetricFilter = "ALL" | "TOTAL" | "AVERAGE";

export function LearningHoursTrendChart() {
  const {
    filters,
    viewAsUser,
    refreshKey,
    trendGranularity,
    setTrendGranularity,
  } = useTalentDashboardScope();
  const { getAccessToken } = useAuth();

  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<ActiveMetricFilter>("ALL");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchTrend() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error("Session expired. Please log in again.");
        }

        const granularityParam =
          trendGranularity === "YEARLY" ? "yearly" : "monthly";

        const data = await talentDashboardApi.getTrendData(
          token,
          {
            ...filters,
            viewAsId: viewAsUser?.principalId,
          },
          granularityParam
        );

        if (isMounted) {
          setTrendData(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load trend metrics"
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTrend();

    return () => {
      isMounted = false;
    };
  }, [
    getAccessToken,
    filters,
    viewAsUser,
    refreshKey,
    trendGranularity,
  ]);

  // Format period label helper (e.g. "2026-03" -> "Mar '26", "2026" -> "2026")
  const formatPeriod = (period: string, isFull = false) => {
    if (!period) return "";
    if (period.includes("-")) {
      const [year, month] = period.split("-");
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const monthIndex = parseInt(month, 10) - 1;
      const monthStr = monthNames[monthIndex] || month;
      return isFull ? `${monthStr} ${year}` : `${monthStr} '${year.slice(2)}`;
    }
    return period;
  };

  // Aggregated Summary Statistics
  const summaryStats = useMemo(() => {
    if (!trendData.length) {
      return { totalHours: 0, peakHours: 0, peakPeriod: "-", avgHours: 0 };
    }

    let total = 0;
    let peak = 0;
    let peakP = "-";

    trendData.forEach((d) => {
      total += d.totalHours;
      if (d.totalHours > peak) {
        peak = d.totalHours;
        peakP = d.period;
      }
    });

    const avg = Math.round((total / trendData.length) * 10) / 10;

    return {
      totalHours: Math.round(total * 10) / 10,
      peakHours: peak,
      peakPeriod: formatPeriod(peakP, true),
      avgHours: avg,
    };
  }, [trendData]);

  // Chart Dimensions & Scales
  const svgWidth = 640;
  const svgHeight = 260;
  const padding = { top: 25, right: 30, bottom: 45, left: 45 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Max value calculation for Y-Axis
  const maxVal = useMemo(() => {
    if (!trendData.length) return 10;
    const maxData = Math.max(
      ...trendData.map((d) =>
        activeMetric === "AVERAGE"
          ? d.averageHours
          : activeMetric === "TOTAL"
          ? d.totalHours
          : Math.max(d.totalHours, d.averageHours)
      )
    );
    // Add a 15% headroom and round up to a clean multiple
    const ceiling = Math.max(maxData * 1.15, 5);
    return Math.ceil(ceiling / 5) * 5;
  }, [trendData, activeMetric]);

  // Coordinate Mapping
  const points = useMemo(() => {
    if (!trendData.length) return [];
    const step =
      trendData.length === 1
        ? chartWidth / 2
        : chartWidth / (trendData.length - 1);

    return trendData.map((d, index) => {
      const x =
        trendData.length === 1
          ? padding.left + chartWidth / 2
          : padding.left + index * step;
      const yTotal =
        padding.top + chartHeight - (d.totalHours / maxVal) * chartHeight;
      const yAvg =
        padding.top + chartHeight - (d.averageHours / maxVal) * chartHeight;

      return {
        x,
        yTotal: Math.min(Math.max(yTotal, padding.top), padding.top + chartHeight),
        yAvg: Math.min(Math.max(yAvg, padding.top), padding.top + chartHeight),
        data: d,
      };
    });
  }, [trendData, chartWidth, chartHeight, maxVal, padding]);

  // Build SVG Paths
  const totalPathD = useMemo(() => {
    if (!points.length) return "";
    return points.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.yTotal}` : `${acc} L ${curr.x} ${curr.yTotal}`;
    }, "");
  }, [points]);

  const totalAreaD = useMemo(() => {
    if (!points.length) return "";
    const bottomY = padding.top + chartHeight;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${totalPathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [points, totalPathD, padding.top, chartHeight]);

  const avgPathD = useMemo(() => {
    if (!points.length) return "";
    return points.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.yAvg}` : `${acc} L ${curr.x} ${curr.yAvg}`;
    }, "");
  }, [points]);

  // Loading Skeleton View
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-44 rounded" />
            <Skeleton className="h-3.5 w-64 rounded" />
          </div>
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // Error View with Retry
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-rose-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>Failed to load Learning Hours Trend</span>
        </div>
        <p className="text-xs text-rose-700">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
          }}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md">
      {/* Component Header with Granularity Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#0b66b2]/10 rounded-lg text-[#0b66b2]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Learning Hours Trend
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tracking total hours and per-staff average across{" "}
            {trendGranularity === "MONTHLY" ? "months" : "calendar years"}.
          </p>
        </div>

        {/* Interactive Monthly / Yearly Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTrendGranularity("MONTHLY")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              trendGranularity === "MONTHLY"
                ? "bg-[#0b66b2] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setTrendGranularity("YEARLY")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              trendGranularity === "YEARLY"
                ? "bg-[#0b66b2] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Yearly
          </button>
        </div>
      </div>

      {/* Metric Quick Stats Chips & Filter Pill Selector */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Metric Series View Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Series:</span>
          <button
            type="button"
            onClick={() => setActiveMetric("ALL")}
            className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
              activeMetric === "ALL"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Both Lines
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric("TOTAL")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors ${
              activeMetric === "TOTAL"
                ? "bg-[#0b66b2] text-white"
                : "bg-blue-50 text-[#0b66b2] hover:bg-blue-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#0b66b2] inline-block" />
            Total Hours
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric("AVERAGE")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors ${
              activeMetric === "AVERAGE"
                ? "bg-[#16a34a] text-white"
                : "bg-emerald-50 text-[#16a34a] hover:bg-emerald-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#16a34a] inline-block" />
            Avg Hours / Staff
          </button>
        </div>

        {/* Aggregate KPI Badges */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Range Total:</span>
            <span className="font-semibold text-slate-900">
              {summaryStats.totalHours} hrs
            </span>
          </div>
          {summaryStats.peakHours > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600">
              <span>Peak:</span>
              <span className="font-semibold text-slate-900">
                {summaryStats.peakPeriod} ({summaryStats.peakHours}h)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Chart Body */}
      {trendData.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
          <div className="p-3 bg-white rounded-full shadow-xs border border-slate-200 mb-3 text-slate-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            No training activity recorded
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            There are no recorded training hours in this time period for the
            current filter selection. Try switching to {trendGranularity === "MONTHLY" ? "Yearly" : "Monthly"} view or adjusting filters.
          </p>
        </div>
      ) : (
        <div className="relative mt-4 w-full overflow-x-auto">
          <div className="min-w-[500px]">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                {/* Gradient for Total Hours Area */}
                <linearGradient
                  id="totalHoursGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#0b66b2" stopOpacity="0.28" />
                  <stop offset="85%" stopColor="#0b66b2" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#0b66b2" stopOpacity="0.0" />
                </linearGradient>

                {/* Gradient for Average Hours Area */}
                <linearGradient
                  id="avgHoursGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#16a34a" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Y-Axis Gridlines & Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const yPos = padding.top + chartHeight * (1 - pct);
                const valueLabel = Math.round(maxVal * pct);
                return (
                  <g key={`gridline-${idx}`}>
                    <line
                      x1={padding.left}
                      y1={yPos}
                      x2={padding.left + chartWidth}
                      y2={yPos}
                      stroke="#e2e8f0"
                      strokeDasharray={pct === 0 ? "none" : "4 4"}
                      strokeWidth={pct === 0 ? "1.5" : "1"}
                    />
                    <text
                      x={padding.left - 8}
                      y={yPos + 4}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-medium"
                    >
                      {valueLabel}h
                    </text>
                  </g>
                );
              })}

              {/* Area Fill for Total Hours */}
              {(activeMetric === "ALL" || activeMetric === "TOTAL") && (
                <path d={totalAreaD} fill="url(#totalHoursGradient)" />
              )}

              {/* Path Line for Total Hours */}
              {(activeMetric === "ALL" || activeMetric === "TOTAL") && (
                <path
                  d={totalPathD}
                  fill="none"
                  stroke="#0b66b2"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Path Line for Average Hours */}
              {(activeMetric === "ALL" || activeMetric === "AVERAGE") && (
                <path
                  d={avgPathD}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2.2"
                  strokeDasharray={activeMetric === "ALL" ? "5 3" : "none"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Data Points & Hover Targets */}
              {points.map((pt, idx) => {
                const isHovered = hoveredIndex === idx;

                return (
                  <g key={`point-${idx}`}>
                    {/* Hover vertical guideline */}
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={padding.top}
                        x2={pt.x}
                        y2={padding.top + chartHeight}
                        stroke="#94a3b8"
                        strokeDasharray="3 3"
                        strokeWidth="1.2"
                      />
                    )}

                    {/* Total Hours Circular Node */}
                    {(activeMetric === "ALL" || activeMetric === "TOTAL") && (
                      <circle
                        cx={pt.x}
                        cy={pt.yTotal}
                        r={isHovered ? 5.5 : 4}
                        fill="#ffffff"
                        stroke="#0b66b2"
                        strokeWidth={isHovered ? 2.5 : 2}
                        className="transition-all duration-150"
                      />
                    )}

                    {/* Average Hours Circular Node */}
                    {(activeMetric === "ALL" || activeMetric === "AVERAGE") && (
                      <circle
                        cx={pt.x}
                        cy={pt.yAvg}
                        r={isHovered ? 5 : 3.5}
                        fill="#ffffff"
                        stroke="#16a34a"
                        strokeWidth={isHovered ? 2.5 : 2}
                        className="transition-all duration-150"
                      />
                    )}

                    {/* Bottom X-Axis Label */}
                    <text
                      x={pt.x}
                      y={padding.top + chartHeight + 20}
                      textAnchor="middle"
                      className={`text-[11px] font-medium transition-colors ${
                        isHovered ? "fill-[#0b66b2] font-bold" : "fill-slate-500"
                      }`}
                    >
                      {formatPeriod(pt.data.period)}
                    </text>

                    {/* Invisible Hover Hitbox for Smooth Cursor Tracking */}
                    <rect
                      x={pt.x - chartWidth / (points.length * 2 || 1)}
                      y={padding.top}
                      width={chartWidth / (points.length || 1)}
                      height={chartHeight + 30}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Floating Interactive Tooltip */}
            {hoveredIndex !== null && points[hoveredIndex] && (
              <div
                className="pointer-events-none absolute z-20 rounded-xl bg-slate-900/95 text-white px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-xs transition-all duration-100 ease-out animate-fadeIn border border-slate-700/60"
                style={{
                  left: `${(points[hoveredIndex].x / svgWidth) * 100}%`,
                  top: `${Math.min(
                    (points[hoveredIndex].yTotal / svgHeight) * 100,
                    55
                  )}%`,
                  transform: "translate(-50%, -115%)",
                }}
              >
                <div className="font-semibold text-slate-200 border-b border-slate-700/80 pb-1 mb-1.5 flex items-center justify-between gap-4">
                  <span>{formatPeriod(points[hoveredIndex].data.period, true)}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">
                    {trendGranularity}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                      Total Hours:
                    </span>
                    <span className="font-bold text-white">
                      {points[hoveredIndex].data.totalHours} hrs
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
                      Avg / Staff:
                    </span>
                    <span className="font-bold text-emerald-300">
                      {points[hoveredIndex].data.averageHours} hrs
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart Legend Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#0b66b2] rounded" />
            <span className="font-medium text-slate-700">Total Training Hours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#16a34a] border-b border-dashed border-[#16a34a]" />
            <span className="font-medium text-slate-700">Average Hours per Staff</span>
          </div>
        </div>
        <span className="text-[11px] text-slate-400">
          Target benchmark: 18.0 hrs/year
        </span>
      </div>
    </div>
  );
}
