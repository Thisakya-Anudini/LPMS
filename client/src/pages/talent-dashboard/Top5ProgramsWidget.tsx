import React, { useEffect, useState, useMemo } from "react";
import {
  Award,
  BookOpen,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useTalentDashboardScope } from "../../contexts/TalentDashboardScopeContext";
import { useAuth } from "../../contexts/useAuth";
import { talentDashboardApi } from "../../api/talentDashboardApi";
import { TopTrainingProgram } from "../../types";
import { Skeleton } from "../../components/ui/Skeleton";
import top5ProgramsMockData from "../../mocks/top5ProgramsMock.json";

// Cohesive LPMS theme palette for the 5 donut segments
const PALETTE = [
  {
    color: "#4f46e5", // Indigo 600
    hoverColor: "#4338ca",
    lightBg: "bg-indigo-50",
    textClass: "text-indigo-700",
    borderClass: "border-indigo-200",
    name: "Indigo",
  },
  {
    color: "#0284c7", // Sky 600
    hoverColor: "#0369a1",
    lightBg: "bg-sky-50",
    textClass: "text-sky-700",
    borderClass: "border-sky-200",
    name: "Sky",
  },
  {
    color: "#059669", // Emerald 600
    hoverColor: "#047857",
    lightBg: "bg-emerald-50",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-200",
    name: "Emerald",
  },
  {
    color: "#d97706", // Amber 600
    hoverColor: "#b45309",
    lightBg: "bg-amber-50",
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
    name: "Amber",
  },
  {
    color: "#7c3aed", // Violet 600
    hoverColor: "#6d28d9",
    lightBg: "bg-violet-50",
    textClass: "text-violet-700",
    borderClass: "border-violet-200",
    name: "Violet",
  },
];

export function Top5ProgramsWidget() {
  const { filters, viewAsUser, refreshKey } = useTalentDashboardScope();
  const { getAccessToken } = useAuth();

  const [programs, setPrograms] = useState<TopTrainingProgram[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTopPrograms() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        let apiData: TopTrainingProgram[] | null = null;

        if (token) {
          try {
            const result = await talentDashboardApi.getTopPrograms(token, {
              ...filters,
              viewAsId: viewAsUser?.principalId,
            });
            if (Array.isArray(result)) {
              apiData = result; // Accepts live data even when it is an empty array []
            }
          } catch {
            // Only fallback to mock data if the network/API completely fails
            apiData = null;
          }
        }

        if (!isMounted) return;

        if (apiData !== null) {
          setPrograms(apiData);
          setIsUsingFallback(false);
        } else {
          // Seamless fallback only on API network failure
          setPrograms(top5ProgramsMockData as TopTrainingProgram[]);
          setIsUsingFallback(true);
        }

      } catch (err: any) {
        if (!isMounted) return;
        console.error("Top 5 Programs fetch error:", err);
        setPrograms(top5ProgramsMockData as TopTrainingProgram[]);
        setIsUsingFallback(true);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTopPrograms();

    return () => {
      isMounted = false;
    };
  }, [filters, viewAsUser, refreshKey, getAccessToken]);

  // Aggregate metrics
  const totalTop5Hours = useMemo(() => {
    return programs.reduce((sum, p) => sum + (p.totalCompletedHours || 0), 0);
  }, [programs]);

  const totalParticipants = useMemo(() => {
    return programs.reduce((sum, p) => sum + (p.participantCount || 0), 0);
  }, [programs]);

  // SVG Donut calculation constants
  const size = 200;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2 - 4; // ≈ 84
  const center = size / 2;
  const circumference = 2 * Math.PI * radius; // ≈ 527.78

  // Calculate slice angles & cumulative stroke offsets
  const slices = useMemo(() => {
    if (!programs.length || totalTop5Hours === 0) return [];

    let accumulatedPercentage = 0;
    return programs.map((program, index) => {
      const pct =
        typeof program.percentageOfTop5 === "number" && program.percentageOfTop5 > 0
          ? program.percentageOfTop5
          : (program.totalCompletedHours / totalTop5Hours) * 100;

      const strokeLength = (pct / 100) * circumference;
      // Slight gap between segments
      const displayStroke = Math.max(1, strokeLength - 3);
      const strokeOffset = -(accumulatedPercentage / 100) * circumference;

      accumulatedPercentage += pct;

      return {
        ...program,
        percentage: pct,
        strokeLength: displayStroke,
        strokeOffset,
        theme: PALETTE[index % PALETTE.length],
      };
    });
  }, [programs, totalTop5Hours, circumference]);

  const activeProgram =
    hoveredIndex !== null && slices[hoveredIndex] ? slices[hoveredIndex] : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 border border-indigo-100/60 rounded-xl text-indigo-600 shadow-xs">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Top 5 Training Programs
              </h2>
              {isUsingFallback && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  <Sparkles className="w-2.5 h-2.5" />
                  Sample Data
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Ranked by cumulative completed training hours in the current scope
            </p>
          </div>
        </div>

        {/* Aggregate Pill Badges */}
        {!isLoading && programs.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{totalTop5Hours.toFixed(1)} hrs Total</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>{totalParticipants} Learners</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content: Donut Chart on Left + Table on Right */}
      <div className="py-5">
        {isLoading ? (
          /* Loading Skeleton State */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-5 flex justify-center py-4">
              <Skeleton className="w-44 h-44 rounded-full" />
            </div>
            <div className="md:col-span-7 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
            <p className="text-sm font-semibold text-slate-800">
              Failed to load Top 5 Programs
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">{error}</p>
          </div>
        ) : programs.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 bg-slate-50 rounded-full text-slate-400 mb-3 border border-slate-200/60">
              <BookOpen className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              No Training Programs Found
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              There are no completed training records matching your selected filters.
            </p>
          </div>
        ) : (
          /* Main Donut + Table Split Layout */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left: Donut Chart with Interactive Center Hub */}
            <div className="md:col-span-5 flex flex-col items-center justify-center relative">
              <div className="relative w-[200px] h-[200px] flex items-center justify-center">
                <svg
                  width={size}
                  height={size}
                  viewBox={`0 0 ${size} ${size}`}
                  className="transform -rotate-90"
                >
                  {/* Subtle Background Track */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                  />

                  {/* Program Slices */}
                  {slices.map((slice, index) => {
                    const isHovered = hoveredIndex === index;
                    return (
                      <circle
                        key={slice.programId || index}
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke={isHovered ? slice.theme.hoverColor : slice.theme.color}
                        strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={`${slice.strokeLength} ${circumference}`}
                        strokeDashoffset={slice.strokeOffset}
                        strokeLinecap="round"
                        className="transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    );
                  })}
                </svg>

                {/* Donut Center Display */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4"
                  style={{ width: `${(radius - strokeWidth / 2) * 2}px`, height: `${(radius - strokeWidth / 2) * 2}px`, margin: "auto" }}
                >
                  {activeProgram ? (
                    <div className="animate-fadeIn">
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${activeProgram.theme.lightBg} ${activeProgram.theme.textClass} mb-0.5`}
                      >
                        #{hoveredIndex! + 1}
                      </span>
                      <p className="text-base font-extrabold text-slate-900 leading-tight">
                        {activeProgram.totalCompletedHours.toFixed(1)}
                        <span className="text-[11px] font-normal text-slate-500">h</span>
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600">
                        {activeProgram.percentage.toFixed(1)}%
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Top 5
                      </p>
                      <p className="text-lg font-extrabold text-slate-900 leading-tight">
                        {totalTop5Hours.toFixed(1)}
                        <span className="text-xs font-normal text-slate-500">h</span>
                      </p>
                      <p className="text-[10px] text-slate-500">Total Hours</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-label under donut */}
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                Hover slice or row to inspect details
              </p>
            </div>

            {/* Right: Accompanying Table Matching Wireframe (Program | Hours | %) */}
            <div className="md:col-span-7 flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 pb-2.5 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <div className="col-span-7">Program</div>
                <div className="col-span-3 text-right">Hours</div>
                <div className="col-span-2 text-right">%</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-slate-100">
                {slices.map((slice, index) => {
                  const isHovered = hoveredIndex === index;
                  return (
                    <div
                      key={slice.programId || index}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className={`grid grid-cols-12 gap-2 items-center py-2.5 px-2 rounded-xl transition-all cursor-pointer ${isHovered
                          ? "bg-slate-100/90 shadow-xs translate-x-1"
                          : "hover:bg-slate-50"
                        }`}
                    >
                      {/* Program Title with Color Bullet & Learner Meta */}
                      <div className="col-span-7 flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-xs transition-transform"
                          style={{
                            backgroundColor: slice.theme.color,
                            transform: isHovered ? "scale(1.25)" : "scale(1)",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-semibold truncate transition-colors ${isHovered ? "text-indigo-600 font-bold" : "text-slate-800"
                              }`}
                            title={slice.programName}
                          >
                            {slice.programName}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {slice.participantCount} learners •{" "}
                            {(slice.totalCompletedHours / (slice.participantCount || 1)).toFixed(1)}h avg
                          </p>
                        </div>
                      </div>

                      {/* Hours Column */}
                      <div className="col-span-3 text-right">
                        <span className="text-xs font-bold text-slate-900">
                          {slice.totalCompletedHours.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-0.5">h</span>
                      </div>

                      {/* % Column */}
                      <div className="col-span-2 text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${slice.theme.lightBg
                            } ${slice.theme.textClass} border ${slice.theme.borderClass}`}
                        >
                          {slice.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Widget Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
          Proportional share computed across the 5 highest-volume programs
        </span>
        <span className="font-medium text-slate-600">
          Target: 18.0h benchmark
        </span>
      </div>
    </div>
  );
}
