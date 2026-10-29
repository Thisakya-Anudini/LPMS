import React, { useState, useEffect } from "react";
import { X, Target, ShieldAlert, CheckCircle2, AlertCircle, Lock, Calendar } from "lucide-react";
import { talentDashboardApi } from "../../api/talentDashboardApi";
import { TalentTargetSettingItem } from "../../types/talent.types";
import { ModalOverlay } from "../../components/ui/ModalOverlay";

interface ConfigureTargetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTargetUpdated: () => void;
    token: string;
}

export function ConfigureTargetModal({
    isOpen,
    onClose,
    onTargetUpdated,
    token,
}: ConfigureTargetModalProps) {
    const currentYear = new Date().getFullYear();
    const [settings, setSettings] = useState<TalentTargetSettingItem[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [targetHours, setTargetHours] = useState<number>(18.0);
    const [effectiveDate, setEffectiveDate] = useState<string>(`${currentYear}-01-01`);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Load existing targets
    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        talentDashboardApi
            .getTargetSettings(token)
            .then((data) => {
                setSettings(data.settings);
                const currentConfig = data.settings.find((s) => s.fiscalYear === currentYear);
                if (currentConfig) {
                    setTargetHours(currentConfig.targetHours);
                    setEffectiveDate(currentConfig.effectiveFrom.split("T")[0]);
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [isOpen, token, currentYear]);

    // When selected year changes, update target hours input
    const handleYearChange = (year: number) => {
        setSelectedYear(year);
        const existing = settings.find((s) => s.fiscalYear === year);
        if (existing) {
            setTargetHours(existing.targetHours);
            setEffectiveDate(existing.effectiveFrom.split("T")[0]);
        } else {
            setTargetHours(18.0);
            setEffectiveDate(`${year}-01-01`);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsSaving(true);

        try {
            await talentDashboardApi.updateTargetSettings(token, {
                fiscalYear: selectedYear,
                targetHours: Number(targetHours),
                effectiveFrom: effectiveDate,
            });

            setSuccessMessage(`Successfully updated ${selectedYear} benchmark target to ${targetHours}h.`);
            onTargetUpdated();
            setTimeout(() => {
                onClose();
            }, 1200);
        } catch (err: any) {
            setError(err.message || "Failed to update target.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const isSelectedYearLocked = selectedYear < currentYear;

    return (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary-100 text-primary-700">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                Configure Target Hours
                            </h3>
                            <p className="text-xs text-slate-500">
                                Organizational annual benchmark configuration
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Informational Non-Retroactive Callout */}
                <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200/60 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        <span className="font-semibold">Audit Protection:</span> Target updates apply strictly to current and future fiscal periods. Historical completed years remain locked to preserve past employee achievements.
                    </p>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Fiscal Year Selection */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                            Target Fiscal Year
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((yr) => {
                                const isLocked = yr < currentYear;
                                const isSelected = selectedYear === yr;
                                return (
                                    <button
                                        key={yr}
                                        type="button"
                                        onClick={() => handleYearChange(yr)}
                                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all flex flex-col items-center gap-0.5 ${isSelected
                                            ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                                            : isLocked
                                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            }`}
                                    >
                                        <span>{yr}</span>
                                        <span className="text-[10px] font-normal opacity-85">
                                            {isLocked ? "Locked" : yr === currentYear ? "Current" : "Future"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Target Hours Field */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                            Annual Target Hours (per staff)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.5"
                                min="1"
                                max="200"
                                disabled={isSelectedYearLocked || isSaving}
                                value={targetHours}
                                onChange={(e) => setTargetHours(parseFloat(e.target.value) || 0)}
                                required
                                className="w-full rounded-xl border border-slate-300 py-2.5 pl-3 pr-12 text-sm text-slate-900 font-bold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-500">
                                Hours
                            </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                            Default baseline is 18.0 hours. You may adjust for corporate expansion (e.g., 20.0h or 25.0h).
                        </p>
                    </div>

                    {/* Effective Date Field */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                            Effective Date
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                disabled={isSelectedYearLocked || isSaving}
                                value={effectiveDate}
                                onChange={(e) => setEffectiveDate(e.target.value)}
                                required
                                className="w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Modal Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSelectedYearLocked || isSaving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? "Saving..." : isSelectedYearLocked ? "Locked (Historical)" : "Save Target"}
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
}