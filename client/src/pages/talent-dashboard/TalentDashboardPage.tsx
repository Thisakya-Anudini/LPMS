import React from "react";
import {
  TalentDashboardScopeProvider,
  useTalentDashboardScope,
} from "../../contexts/TalentDashboardScopeContext";
import { Eye, RotateCcw } from "lucide-react";
import { FilterBar } from "./FilterBar";


function DrillDownBanner() {
  const { isSelfView, viewAsUser, resetToSelf } = useTalentDashboardScope();

  if (isSelfView || !viewAsUser) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-900 shadow-sm animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
          <Eye className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            Drill-Down View Active: {viewAsUser.name} (
            {viewAsUser.employeeNumber})
          </p>
          <p className="text-xs text-amber-700">
            {viewAsUser.designation ? `${viewAsUser.designation} • ` : ""}
            Showing metrics scoped strictly to this subordinate's hierarchy
            branch.
          </p>
        </div>
      </div>
      <button
        onClick={resetToSelf}
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset to My View
      </button>
    </div>
  );
}

function TalentDashboardContent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Talent Development Dashboard
        </h1>
        <p className="text-sm text-slate-600">
          Monitor training hours, analyze team competencies, and benchmark
          against the 18.0-hour organizational target.
        </p>
      </div>

      {/* Drill-down indicator banner when inspecting a subordinate */}
      <DrillDownBanner />

      {/* Global Filter Bar */}
      <FilterBar />

      {/* Widget Grid Scaffolding */}
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Ready for KPI Cards (`[N1.7]`).
      </div>

    </div>
  );
}

export function TalentDashboardPage() {
  return (
    <TalentDashboardScopeProvider>
      <TalentDashboardContent />
    </TalentDashboardScopeProvider>
  );
}
