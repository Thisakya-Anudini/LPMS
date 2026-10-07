import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useAuth } from "./useAuth";
import { TalentFilterParams } from "../types";

export interface DrillDownUser {
  principalId: string;
  employeeNumber: string;
  name: string;
  designation?: string;
  department?: string;
}

export type TrendGranularity = "MONTHLY" | "YEARLY";

export interface TalentDashboardScopeContextType {
  // Scope / Drill-Down State
  viewAsUser: DrillDownUser | null;
  isSelfView: boolean;
  effectivePrincipalId: string | undefined;
  drillDown: (user: DrillDownUser) => void;
  resetToSelf: () => void;

  // Global Filters
  filters: TalentFilterParams;
  updateFilters: (newFilters: Partial<TalentFilterParams>) => void;
  resetFilters: () => void;

  // Chart Granularity (Monthly vs. Yearly)
  trendGranularity: TrendGranularity;
  setTrendGranularity: (granularity: TrendGranularity) => void;

  // Global Refresh Signal
  refreshKey: number;
  refreshData: () => void;
}

const defaultFilters: TalentFilterParams = {
  startDate: "",
  endDate: "",
  trainingType: "ALL",
  staffCategory: "ALL",
  designation: "",
};

const TalentDashboardScopeContext = createContext<
  TalentDashboardScopeContextType | undefined
>(undefined);

export function TalentDashboardScopeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const [viewAsUser, setViewAsUser] = useState<DrillDownUser | null>(null);
  const [filters, setFilters] = useState<TalentFilterParams>(defaultFilters);
  const [trendGranularity, setTrendGranularity] =
    useState<TrendGranularity>("MONTHLY");
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // If viewAsUser is set, we are viewing that subordinate. Otherwise, viewing self.
  const isSelfView = useMemo(() => {
    return !viewAsUser || viewAsUser.principalId === user?.id;
  }, [viewAsUser, user?.id]);

  const effectivePrincipalId = useMemo(() => {
    return viewAsUser ? viewAsUser.principalId : user?.id;
  }, [viewAsUser, user?.id]);

  const drillDown = useCallback((targetUser: DrillDownUser) => {
    setViewAsUser(targetUser);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const resetToSelf = useCallback(() => {
    setViewAsUser(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const updateFilters = useCallback(
    (newFilters: Partial<TalentFilterParams>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      setRefreshKey((prev) => prev + 1);
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const refreshData = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const value = useMemo(
    () => ({
      viewAsUser,
      isSelfView,
      effectivePrincipalId,
      drillDown,
      resetToSelf,
      filters,
      updateFilters,
      resetFilters,
      trendGranularity,
      setTrendGranularity,
      refreshKey,
      refreshData,
    }),
    [
      viewAsUser,
      isSelfView,
      effectivePrincipalId,
      drillDown,
      resetToSelf,
      filters,
      updateFilters,
      resetFilters,
      trendGranularity,
      refreshKey,
      refreshData,
    ],
  );

  return (
    <TalentDashboardScopeContext.Provider value={value}>
      {children}
    </TalentDashboardScopeContext.Provider>
  );
}

export function useTalentDashboardScope() {
  const context = useContext(TalentDashboardScopeContext);
  if (!context) {
    throw new Error(
      "useTalentDashboardScope must be used within a TalentDashboardScopeProvider",
    );
  }
  return context;
}
