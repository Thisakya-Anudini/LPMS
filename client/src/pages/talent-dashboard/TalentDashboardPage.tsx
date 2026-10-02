import React from "react";

export function TalentDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Talent Development Dashboard
        </h1>
        <p className="text-sm text-slate-600">
          Track organization and team learning hours against the 18.0-hour
          annual benchmark.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Dashboard widgets and charts will be assembled here.
      </div>
    </div>
  );
}
