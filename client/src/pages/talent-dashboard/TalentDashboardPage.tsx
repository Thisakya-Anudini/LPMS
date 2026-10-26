import { useState } from "react";
import {
  TalentDashboardScopeProvider,
  useTalentDashboardScope,
} from "../../contexts/TalentDashboardScopeContext";
import { useAuth } from "../../contexts/useAuth";
import { Eye, RotateCcw } from "lucide-react";
import { FilterBar } from "./FilterBar";
import { KpiCardRow } from "./KpiCardRow";
import { TargetGaugeRow } from "./TargetGaugeRow";
import {
  EmployeeHierarchyPanel,
  SelectedHierarchyEmployee,
} from "../../components/admin/EmployeeHierarchyPanel";
import { LearningHoursTrendChart } from "./LearningHoursTrendChart";
import { ImmediateSubordinatesChart } from "./ImmediateSubordinatesChart";
import { Top5ProgramsWidget } from "./Top5ProgramsWidget";
import { TrainingHistoryTable } from "./TrainingHistoryTable";

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
            Showing metrics scoped strictly to this subordinate's hierarchy branch.
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
  const { user } = useAuth();
  const { drillDown, viewAsUser, refreshData, resetToSelf } = useTalentDashboardScope();
  const [isHierarchyCollapsed, setIsHierarchyCollapsed] = useState(false);

  // Super Admin & Learning Admin see the whole enterprise tree starting at the CEO ("020987").
  // In LPMS, Learning Admins have role === "EMPLOYEE" with isLearningAdmin === true.
  // Supervisors see only their own hierarchy starting from their employee number.
  const isCompanyWideAdmin =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "LEARNING_ADMIN" ||
    Boolean(user?.isLearningAdmin);
  const hierarchyRootEmployeeNo = isCompanyWideAdmin
    ? undefined
    : user?.employeeNo || undefined;

  const handleHierarchyRefresh = () => {
    resetToSelf(); // Resets drill-down back to self/root view
    refreshData();  // Reloads all widgets for my view
  };

  const handleSelectSubordinate = (employee: SelectedHierarchyEmployee) => {
    drillDown({
      principalId: employee.employeeNumber,
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      designation: employee.designation,
      department: employee.orgName,
    });
  };

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

      {/* Top KPI Summary Metrics Row */}
      <KpiCardRow />

      {/* Target vs. Achievement Semicircular Gauges (Full Width below KPIs) */}
      <TargetGaugeRow />

      {/* Main Interactive Grid: Hierarchy Rail (Left) + Learning Hours Trend Chart & Top 5 Programs (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Organization Hierarchy (Collapsible between 5 cols and 1 col) */}
        <div
          className={`${
            isHierarchyCollapsed
              ? "lg:col-span-1 xl:col-span-1"
              : "lg:col-span-5 xl:col-span-5"
          } transition-all duration-300`}
        >
          <EmployeeHierarchyPanel
            rootEmployeeNumber={hierarchyRootEmployeeNo}
            selectedEmployeeNumber={viewAsUser?.employeeNumber}
            onSelectSubordinate={handleSelectSubordinate}
            onRefresh={handleHierarchyRefresh}
            isCollapsed={isHierarchyCollapsed}
            onToggleCollapse={() => setIsHierarchyCollapsed((prev) => !prev)}
          />
        </div>

        {/* Right Column: Learning Hours Trend Chart + Immediate Subordinates + Top 5 Training Programs Widget */}
        <div
          className={`${
            isHierarchyCollapsed
              ? "lg:col-span-11 xl:col-span-11"
              : "lg:col-span-7 xl:col-span-7"
          } transition-all duration-300 space-y-6`}
        >
          <LearningHoursTrendChart />
          <ImmediateSubordinatesChart />
          <Top5ProgramsWidget />
        </div>
      </div>

      {/* Full-Width Bottom Section: Exportable Training History Table */}
      <TrainingHistoryTable />
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
