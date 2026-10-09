import React, { useState, useEffect } from "react";
import {
    Calendar,
    Filter,
    RotateCcw,
    SlidersHorizontal,
    GraduationCap,
    Users,
} from "lucide-react";
import { useTalentDashboardScope } from "../../contexts/TalentDashboardScopeContext";
import { TalentFilterParams } from "../../types";

const TRAINING_TYPES = [
    { value: "ALL", label: "All Formats" },
    { value: "ONLINE", label: "Online" },
    { value: "CLASSROOM", label: "Classroom" },
    { value: "HYBRID", label: "Hybrid" },
    { value: "EXTERNAL", label: "External" },
];

const STAFF_CATEGORIES = [
    { value: "ALL", label: "All Categories" },
    { value: "EXECUTIVE", label: "Executive" },
    { value: "MANAGERIAL", label: "Managerial" },
    { value: "TECHNICAL", label: "Technical" },
    { value: "OPERATIONAL", label: "Operational" },
];

export function FilterBar() {
    const { filters, updateFilters, resetFilters } = useTalentDashboardScope();

    // Local draft state so users can make selections before triggering API calls
    const [draft, setDraft] = useState<TalentFilterParams>(filters);

    // Sync draft whenever context filters change (e.g. on external reset)
    useEffect(() => {
        setDraft(filters);
    }, [filters]);

    const handleChange = (key: keyof TalentFilterParams, value: string) => {
        setDraft((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleApply = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilters(draft);
    };

    const handleReset = () => {
        resetFilters();
    };

    const hasActiveFilters = Boolean(
        draft.startDate ||
        draft.endDate ||
        (draft.trainingType && draft.trainingType !== "ALL") ||
        (draft.staffCategory && draft.staffCategory !== "ALL") ||
        draft.designation,
    );

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
            <form onSubmit={handleApply} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 text-slate-700">
                        <SlidersHorizontal className="h-4 w-4 text-primary-600" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Filter Records
                        </span>
                        {hasActiveFilters && (
                            <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700 border border-primary-200">
                                Filters Active
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={!hasActiveFilters}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
                    {/* Start Date */}
                    <div>
                        <label
                            htmlFor="filter-start-date"
                            className="mb-1 block text-xs font-medium text-slate-600"
                        >
                            Start Date
                        </label>
                        <div className="relative">
                            <input
                                id="filter-start-date"
                                type="date"
                                value={draft.startDate || ""}
                                onChange={(e) => handleChange("startDate", e.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 transition focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                            />
                            <Calendar className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    {/* End Date */}
                    <div>
                        <label
                            htmlFor="filter-end-date"
                            className="mb-1 block text-xs font-medium text-slate-600"
                        >
                            End Date
                        </label>
                        <div className="relative">
                            <input
                                id="filter-end-date"
                                type="date"
                                value={draft.endDate || ""}
                                onChange={(e) => handleChange("endDate", e.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 transition focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                            />
                            <Calendar className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>


                    {/* Training Type Dropdown */}
                    <div>
                        <label
                            htmlFor="filter-training-type"
                            className="mb-1 block text-xs font-medium text-slate-600"
                        >
                            Training Format
                        </label>
                        <div className="relative">
                            <select
                                id="filter-training-type"
                                value={draft.trainingType || "ALL"}
                                onChange={(e) => handleChange("trainingType", e.target.value)}
                                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-8 text-xs text-slate-800 transition focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                            >
                                {TRAINING_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                            <GraduationCap className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    {/* Staff Category Dropdown */}
                    <div>
                        <label
                            htmlFor="filter-staff-category"
                            className="mb-1 block text-xs font-medium text-slate-600"
                        >
                            Staff Category
                        </label>
                        <div className="relative">
                            <select
                                id="filter-staff-category"
                                value={draft.staffCategory || "ALL"}
                                onChange={(e) => handleChange("staffCategory", e.target.value)}
                                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-8 text-xs text-slate-800 transition focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                            >
                                {STAFF_CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                            <Users className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
                        >
                            <Filter className="h-3.5 w-3.5" />
                            <span>Apply</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
