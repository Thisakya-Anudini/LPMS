import React, { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Crown,
  Layers3,
  Network,
  RotateCw,
  UsersRound,
} from "lucide-react";
import { integrationApi } from "../../api/lpmsApi";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

type HierarchyEmployee = {
  employeeNumber: string;
  name: string;
  designation: string;
  orgName?: string;
};

export type SelectedHierarchyEmployee = HierarchyEmployee;

type HierarchyChildrenState = {
  rows: HierarchyEmployee[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

const ROOT_EMPLOYEE_NO = "020987";

const normalizeHierarchyName = (
  row: Record<string, unknown>,
  fallbackEmployeeNo = "",
) => {
  const employeeName =
    typeof row.employeeName === "string" ? row.employeeName.trim() : "";
  if (employeeName) {
    return employeeName;
  }

  const initials =
    typeof row.employeeInitials === "string" ? row.employeeInitials.trim() : "";
  const surname =
    typeof row.employeeSurname === "string" ? row.employeeSurname.trim() : "";
  const merged = `${initials} ${surname}`.trim();
  return merged || `Employee ${fallbackEmployeeNo || "Unknown"}`;
};

const mapHierarchyEmployee = (row: Record<string, unknown>) => {
  const employeeNumber = String(
    row.employeeNumber || row.employeeNo || "",
  ).trim();
  return {
    employeeNumber,
    name: normalizeHierarchyName(row, employeeNumber),
    designation:
      String(row.designation || row.designationName || "").trim() || "Employee",
    orgName: String(
      row.orgName || row.empSection || row.empDivision || "",
    ).trim(),
  };
};

const hierarchyDepthStyles = [
  {
    cardClass:
      "border-sky-200 bg-gradient-to-r from-sky-50 via-cyan-50 to-white hover:border-sky-300 hover:shadow-md hover:shadow-sky-100 hover:-translate-y-0.5",
    iconWrapClass:
      "border-sky-200 bg-sky-100 text-sky-700 group-hover:scale-105 group-hover:bg-sky-200/80 transition-all duration-200",
    countClass:
      "border-sky-200 bg-sky-50 text-sky-700 group-hover:bg-sky-100 transition-colors duration-200",
    accentClass: "bg-sky-400",
    icon: Briefcase,
  },
  {
    cardClass:
      "border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50/70 to-white hover:border-violet-300 hover:shadow-md hover:shadow-violet-100 hover:-translate-y-0.5",
    iconWrapClass:
      "border-violet-200 bg-violet-100 text-violet-700 group-hover:scale-105 group-hover:bg-violet-200/80 transition-all duration-200",
    countClass:
      "border-violet-200 bg-violet-50 text-violet-700 group-hover:bg-violet-100 transition-colors duration-200",
    accentClass: "bg-violet-400",
    icon: UsersRound,
  },
  {
    cardClass:
      "border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-white hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100 hover:-translate-y-0.5",
    iconWrapClass:
      "border-emerald-200 bg-emerald-100 text-emerald-700 group-hover:scale-105 group-hover:bg-emerald-200/80 transition-all duration-200",
    countClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 transition-colors duration-200",
    accentClass: "bg-emerald-400",
    icon: Building2,
  },
  {
    cardClass:
      "border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50/70 to-white hover:border-rose-300 hover:shadow-md hover:shadow-rose-100 hover:-translate-y-0.5",
    iconWrapClass:
      "border-rose-200 bg-rose-100 text-rose-700 group-hover:scale-105 group-hover:bg-rose-200/80 transition-all duration-200",
    countClass:
      "border-rose-200 bg-rose-50 text-rose-700 group-hover:bg-rose-100 transition-colors duration-200",
    accentClass: "bg-rose-400",
    icon: Layers3,
  },
] as const;

const getDepthStyle = (depth: number) =>
  hierarchyDepthStyles[depth % hierarchyDepthStyles.length];

type EmployeeHierarchyPanelProps = {
  selectedEmployeeNumber?: string | null;
  onViewDetails?: (employee: SelectedHierarchyEmployee) => void;
  onRefresh?: () => void;
};

export function EmployeeHierarchyPanel({
  selectedEmployeeNumber,
  onViewDetails,
  onRefresh,
}: EmployeeHierarchyPanelProps) {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [hierarchyRoot, setHierarchyRoot] = useState<HierarchyEmployee | null>(
    null,
  );
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [expandedEmployees, setExpandedEmployees] = useState<
    Record<string, boolean>
  >({});
  const [hierarchyChildrenByEmployee, setHierarchyChildrenByEmployee] =
    useState<Record<string, HierarchyChildrenState>>({});

  const loadHierarchyChildren = useCallback(
    async (employeeNo: string) => {
      const normalizedEmployeeNo = employeeNo.trim();
      if (!normalizedEmployeeNo) {
        return;
      }

      setHierarchyChildrenByEmployee((prev) => ({
        ...prev,
        [normalizedEmployeeNo]: {
          rows: prev[normalizedEmployeeNo]?.rows || [],
          loaded: prev[normalizedEmployeeNo]?.loaded || false,
          loading: true,
          error: null,
        },
      }));

      try {
        const token = await getAccessToken();
        if (!token) {
          showToast("Session expired. Please login again.", "error");
          setHierarchyChildrenByEmployee((prev) => ({
            ...prev,
            [normalizedEmployeeNo]: {
              rows: prev[normalizedEmployeeNo]?.rows || [],
              loaded: prev[normalizedEmployeeNo]?.loaded || false,
              loading: false,
              error: "Session expired.",
            },
          }));
          return;
        }

        const response = await integrationApi.getErpSubordinates(
          token,
          normalizedEmployeeNo,
        );
        const rows = Array.isArray(response.data)
          ? response.data
              .map((row) => mapHierarchyEmployee(row))
              .filter((row) => row.employeeNumber.length > 0)
          : [];

        setHierarchyChildrenByEmployee((prev) => ({
          ...prev,
          [normalizedEmployeeNo]: {
            rows,
            loaded: true,
            loading: false,
            error: null,
          },
        }));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load subordinate details.";
        setHierarchyChildrenByEmployee((prev) => ({
          ...prev,
          [normalizedEmployeeNo]: {
            rows: prev[normalizedEmployeeNo]?.rows || [],
            loaded: prev[normalizedEmployeeNo]?.loaded || false,
            loading: false,
            error: message,
          },
        }));
      }
    },
    [getAccessToken, showToast],
  );

  const loadHierarchy = useCallback(async () => {
    setHierarchyLoading(true);
    setHierarchyError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const [detailsResponse, childrenResponse] = await Promise.all([
        integrationApi.getErpLearnerDetails(token, ROOT_EMPLOYEE_NO),
        integrationApi.getErpSubordinates(token, ROOT_EMPLOYEE_NO),
      ]);

      const detailRow =
        Array.isArray(detailsResponse.data) && detailsResponse.data.length > 0
          ? (detailsResponse.data[0] as Record<string, unknown>)
          : {};
      const childRows = Array.isArray(childrenResponse.data)
        ? childrenResponse.data
            .map((row) => mapHierarchyEmployee(row))
            .filter((row) => row.employeeNumber.length > 0)
        : [];

      setHierarchyRoot({
        employeeNumber: ROOT_EMPLOYEE_NO,
        name: normalizeHierarchyName(detailRow, ROOT_EMPLOYEE_NO),
        designation:
          String(
            detailRow.designation || detailRow.designationName || "",
          ).trim() || "Chief Executive Officer",
        orgName: String(detailRow.orgName || "").trim(),
      });
      setHierarchyChildrenByEmployee({
        [ROOT_EMPLOYEE_NO]: {
          rows: childRows,
          loaded: true,
          loading: false,
          error: null,
        },
      });
      setExpandedEmployees({ [ROOT_EMPLOYEE_NO]: true });
    } catch (err) {
      setHierarchyError(
        err instanceof Error
          ? err.message
          : "Failed to load employee hierarchy.",
      );
    } finally {
      setHierarchyLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);

  const toggleHierarchyEmployee = useCallback(
    async (employeeNo: string) => {
      const isExpanded = Boolean(expandedEmployees[employeeNo]);
      const nodeState = hierarchyChildrenByEmployee[employeeNo];

      setExpandedEmployees((prev) => ({
        ...prev,
        [employeeNo]: !isExpanded,
      }));

      if (!isExpanded && !nodeState?.loaded && !nodeState?.loading) {
        await loadHierarchyChildren(employeeNo);
      }
    },
    [expandedEmployees, hierarchyChildrenByEmployee, loadHierarchyChildren],
  );

  const renderHierarchyNodeChildren = (
    employeeNumber: string,
    depth: number,
    nodeState: HierarchyChildrenState | undefined,
  ) => {
    if (nodeState?.loading) {
      return (
        <div className="relative space-y-2 pl-[25px]">
          <span
            className="absolute left-[12px] top-0 bottom-0 w-px bg-slate-300"
            aria-hidden="true"
          />
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={`${employeeNumber}-skeleton-${index}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3"
            >
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (nodeState?.error) {
      return (
        <div className="ml-[25px] rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {nodeState.error}
        </div>
      );
    }

    if (nodeState?.loaded && nodeState.rows.length === 0) {
      return (
        <div className="ml-[25px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-500">
          No subordinates found.
        </div>
      );
    }

    return (
      <div className="relative space-y-2">
        <span
          className="absolute left-[12px] top-0 bottom-0 w-px bg-slate-300"
          aria-hidden="true"
        />
        {nodeState?.rows.map((child) =>
          renderHierarchyNode(child, depth + 1),
        ) ?? null}
      </div>
    );
  };

  const renderHierarchyNode = (
    employee: HierarchyEmployee,
    depth = 0,
    isRoot = false,
  ): React.ReactNode => {
    const nodeState = hierarchyChildrenByEmployee[employee.employeeNumber];
    const isExpanded = Boolean(expandedEmployees[employee.employeeNumber]);
    const childCount = nodeState?.loaded ? nodeState.rows.length : null;
    const canExpand =
      isRoot || Boolean(nodeState?.loaded) || isExpanded || !nodeState?.error;
    const hasChildren =
      nodeState?.loading ||
      Boolean(nodeState?.error) ||
      (childCount !== null ? childCount > 0 : true);
    const depthStyle = getDepthStyle(depth);
    const LevelIcon = isRoot ? Crown : depthStyle.icon;
    const isSelected = selectedEmployeeNumber === employee.employeeNumber;

    return (
      <div
        key={`${employee.employeeNumber}-${depth}`}
        className="relative space-y-2"
        style={{ paddingLeft: depth === 0 ? 0 : 25 }}
      >
        {depth > 0 ? (
          <span
            className="absolute left-[12px] top-6 h-px w-[13px] bg-slate-300"
            aria-hidden="true"
          />
        ) : null}

        <div
          className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 ease-out ${
            isRoot
              ? "border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-white shadow-sm hover:border-amber-300 hover:shadow-md hover:shadow-amber-100 hover:-translate-y-0.5"
              : depthStyle.cardClass
          } ${isSelected ? "ring-2 ring-primary-600 ring-offset-1 shadow-md" : ""}`}
        >
          <button
            type="button"
            onClick={() => {
              toggleHierarchyEmployee(employee.employeeNumber).catch(
                console.error,
              );
            }}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
              hasChildren ? "cursor-pointer" : "cursor-default"
            } ${
              isRoot
                ? "border-amber-200 bg-amber-100 text-amber-700 group-hover:scale-105 group-hover:bg-amber-200/80 transition-all duration-200"
                : depthStyle.iconWrapClass
            }`}
            disabled={!canExpand && !nodeState?.loading}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${employee.name}`}
          >
            <LevelIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              toggleHierarchyEmployee(employee.employeeNumber).catch(
                console.error,
              );
            }}
            className="min-w-0 flex-1 text-left"
            disabled={!canExpand && !nodeState?.loading}
          >
            <p className="truncate text-[15px] font-semibold leading-5 text-slate-900">
              {employee.name}
            </p>
            <p className="truncate text-sm leading-4 text-slate-500">
              {employee.designation}
            </p>
            {employee.orgName ? (
              <p className="truncate text-xs leading-4 text-slate-400">
                {employee.orgName}
              </p>
            ) : null}
          </button>

          {childCount !== null ? (
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                isRoot
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : depthStyle.countClass
              }`}
            >
              {childCount}
            </span>
          ) : null}

          <Button
            type="button"
            variant={isSelected ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => onViewDetails?.(employee)}
          >
            View
          </Button>

          <button
            type="button"
            onClick={() => {
              toggleHierarchyEmployee(employee.employeeNumber).catch(
                console.error,
              );
            }}
            className={`shrink-0 rounded-full p-1.5 text-slate-400 transition ${
              hasChildren
                ? "group-hover:bg-slate-100 group-hover:text-slate-600"
                : "opacity-40"
            }`}
            disabled={!canExpand && !nodeState?.loading}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${employee.name}`}
          >
            {hasChildren && isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {isExpanded ? (
          <div className="space-y-2">
            {renderHierarchyNodeChildren(
              employee.employeeNumber,
              depth,
              nodeState,
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Card
      title={<span className="text-xl">Employee Hierarchy</span>}
      className="flex h-full min-h-[520px] flex-col xl:h-[calc(100vh-170px)] transition-all duration-300 ease-out hover:border-slate-300 hover:shadow-xl"
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            loadHierarchy().catch(console.error);
            onRefresh?.();
          }}
          isLoading={hierarchyLoading}
          className="group transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-700 hover:shadow-sm active:translate-y-0"
        >
          {!hierarchyLoading && (
            <RotateCw className="h-3.5 w-3.5 text-slate-400 transition-transform duration-500 group-hover:rotate-180 group-hover:text-primary-600" />
          )}
          <span>Refresh</span>
        </Button>
      }
    >
      {hierarchyError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {hierarchyError}
        </div>
      ) : hierarchyLoading && !hierarchyRoot ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={`hierarchy-root-skeleton-${index}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : hierarchyRoot ? (
        <div className="rounded-3xl border border-slate-200 bg-[#fcfcfd] p-3 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-slate-300 hover:shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-transform duration-200 group-hover:scale-105">
                <Network className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Organization Tree
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {renderHierarchyNode(hierarchyRoot, 0, true)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Hierarchy is not available right now.
        </p>
      )}
    </Card>
  );
}
