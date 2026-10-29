import {
    TalentFilterParams,
    TalentKpiMetrics,
    TrendDataPoint,
    SubordinateProgress,
    PaginatedHistoryResponse,
    TopTrainingProgram,
    TalentTargetResponse,
    TalentTargetSettingItem,
} from "../types";

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

    /**
     * Fetches monthly or yearly learning hours trend data
     */
    async getTrendData(
        token: string,
        filters: TalentFilterParams = {},
        granularity: "monthly" | "yearly" = "monthly",
    ): Promise<TrendDataPoint[]> {
        const params = new URLSearchParams();
        params.set("granularity", granularity);
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

        const res = await fetch(`${API_BASE_URL}/talent-dashboard/trend?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch trend data: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data || [];
    },

    /**
     * Fetches immediate subordinates' training progress against the 18h target
     */
    async getImmediateSubordinates(
        token: string,
        filters: TalentFilterParams = {},
    ): Promise<SubordinateProgress[]> {
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

        const res = await fetch(
            `${API_BASE_URL}/talent-dashboard/immediate-subordinates?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );
        if (!res.ok) {
            throw new Error(`Failed to fetch immediate subordinates: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data || [];
    },

    /**
     * Fetches paginated training history records with sorting and search
     */
    async getTrainingHistory(
        token: string,
        filters: TalentFilterParams & { search?: string } = {},
        page: number = 1,
        pageSize: number = 10,
        sortBy: string = "startDate",
        sortOrder: "ASC" | "DESC" = "DESC",
    ): Promise<PaginatedHistoryResponse> {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);

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
        if (filters.search) {
            params.set("search", filters.search);
        }

        const res = await fetch(
            `${API_BASE_URL}/talent-dashboard/history?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );
        if (!res.ok) {
            throw new Error(`Failed to fetch training history: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data;
    },

    /**
     * Downloads an exported CSV file of the filtered training history
     */
    async exportTrainingHistory(
        token: string,
        filters: TalentFilterParams & { search?: string } = {},
        sortBy: string = "startDate",
        sortOrder: "ASC" | "DESC" = "DESC",
    ): Promise<Blob> {
        const params = new URLSearchParams();
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);
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
        if (filters.search) {
            params.set("search", filters.search);
        }

        const res = await fetch(
            `${API_BASE_URL}/talent-dashboard/history/export?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );
        if (!res.ok) {
            throw new Error(`Failed to export training history: ${res.statusText}`);
        }
        return await res.blob();
    },

    /**
     * Fetches top 5 training programs by completed hours
     */
    async getTopPrograms(
        token: string,
        filters: TalentFilterParams = {},
    ): Promise<TopTrainingProgram[]> {
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
        const res = await fetch(
            `${API_BASE_URL}/talent-dashboard/top-programs${queryStr}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );
        if (!res.ok) {
            throw new Error(`Failed to fetch top programs: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data || [];
    },

    /**
   * Fetches active organizational target hours and historical/future settings
   */
    async getTargetSettings(token: string): Promise<TalentTargetResponse> {
        const res = await fetch(`${API_BASE_URL}/talent-dashboard/settings/target`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch target settings: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data;
    },
    /**
     * Updates organizational target hours for a fiscal year (Super Admin only)
     */
    async updateTargetSettings(
        token: string,
        payload: { fiscalYear: number; targetHours: number; effectiveFrom?: string }
    ): Promise<TalentTargetSettingItem> {
        const res = await fetch(`${API_BASE_URL}/talent-dashboard/settings/target`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.message || `Failed to update target settings`);
        }
        return json.data;
    },
};
