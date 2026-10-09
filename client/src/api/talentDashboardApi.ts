import { TalentFilterParams, TalentKpiMetrics } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const talentDashboardApi = {
    /**
     * Fetches the dynamic list of designations for filters
     */
    async getDesignations(token: string): Promise<string[]> {
        const res = await fetch(`${API_BASE_URL}/talent-dashboard/designations`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch designations: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data || [];
    },

    /**
     * Fetches the 4 KPI summary cards
     */
    async getKpiMetrics(
        token: string,
        filters: TalentFilterParams = {},
    ): Promise<TalentKpiMetrics> {
        const params = new URLSearchParams();
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);
        if (filters.trainingType && filters.trainingType !== "ALL") {
            params.set("trainingType", filters.trainingType);
        }
        if (filters.designation && filters.designation !== "ALL") {
            params.set("designation", filters.designation);
        }
        if (filters.viewAsId) {
            params.set("viewAsId", filters.viewAsId);
        }

        const queryStr = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`${API_BASE_URL}/talent-dashboard/kpis${queryStr}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch KPI metrics: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data;
    },
};
