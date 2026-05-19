import React, { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Crown,
  Layers3,
  Network,
  UsersRound
} from 'lucide-react';
import { integrationApi } from '../../api/lpmsApi';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type HierarchyEmployee = {
  employeeNumber: string;
  name: string;
  designation: string;
};

export type SelectedHierarchyEmployee = HierarchyEmployee;

type HierarchyChildrenState = {
  rows: HierarchyEmployee[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

const ROOT_EMPLOYEE_NO = '020987';

const normalizeHierarchyName = (row: Record<string, unknown>, fallbackEmployeeNo = '') => {
  const employeeName = typeof row.employeeName === 'string' ? row.employeeName.trim() : '';
  if (employeeName) {
    return employeeName;
  }

  const initials = typeof row.employeeInitials === 'string' ? row.employeeInitials.trim() : '';
  const surname = typeof row.employeeSurname === 'string' ? row.employeeSurname.trim() : '';
  const merged = `${initials} ${surname}`.trim();
  return merged || `Employee ${fallbackEmployeeNo || 'Unknown'}`;
};

const mapHierarchyEmployee = (row: Record<string, unknown>) => {
  const employeeNumber = String(row.employeeNumber || row.employeeNo || '').trim();
  return {
    employeeNumber,
    name: normalizeHierarchyName(row, employeeNumber),
    designation: String(row.designation || row.designationName || '').trim() || 'Employee'
  };
};

const hierarchyDepthStyles = [
  {
    cardClass: 'border-sky-200 bg-gradient-to-r from-sky-50 via-cyan-50 to-white hover:border-sky-300',
    iconWrapClass: 'border-sky-200 bg-sky-100 text-sky-700',
    countClass: 'border-sky-200 bg-sky-50 text-sky-700',
    accentClass: 'bg-sky-400',
    icon: Briefcase
  },
  {
    cardClass:
      'border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50/70 to-white hover:border-violet-300',
    iconWrapClass: 'border-violet-200 bg-violet-100 text-violet-700',
    countClass: 'border-violet-200 bg-violet-50 text-violet-700',
    accentClass: 'bg-violet-400',
    icon: UsersRound
  },
  {
    cardClass:
      'border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-white hover:border-emerald-300',
    iconWrapClass: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    countClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    accentClass: 'bg-emerald-300',
    icon: Building2
  },
  {
    cardClass:
      'border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50/70 to-white hover:border-rose-300',
    iconWrapClass: 'border-rose-200 bg-rose-100 text-rose-700',
    countClass: 'border-rose-200 bg-rose-50 text-rose-700',
    accentClass: 'bg-rose-400',
    icon: Layers3
  }
] as const;

const getDepthStyle = (depth: number) => hierarchyDepthStyles[depth % hierarchyDepthStyles.length];

type EmployeeHierarchyPanelProps = {
  selectedEmployeeNumber?: string | null;
  onViewDetails?: (employee: SelectedHierarchyEmployee) => void;
};

export function EmployeeHierarchyPanel({
  selectedEmployeeNumber,
  onViewDetails
}: EmployeeHierarchyPanelProps) {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [hierarchyRoot, setHierarchyRoot] = useState<HierarchyEmployee | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});
  const [hierarchyChildrenByEmployee, setHierarchyChildrenByEmployee] = useState<
    Record<string, HierarchyChildrenState>
  >({});

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
          error: null
        }
      }));

      try {
        const token = await getAccessToken();
        if (!token) {
          showToast('Session expired. Please login again.', 'error');
          setHierarchyChildrenByEmployee((prev) => ({
            ...prev,
            [normalizedEmployeeNo]: {
              rows: prev[normalizedEmployeeNo]?.rows || [],
              loaded: prev[normalizedEmployeeNo]?.loaded || false,
              loading: false,
              error: 'Session expired.'
            }
          }));
          return;
        }

        const response = await integrationApi.getErpSubordinates(token, normalizedEmployeeNo);
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
            error: null
          }
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load subordinate details.';
        setHierarchyChildrenByEmployee((prev) => ({
          ...prev,
          [normalizedEmployeeNo]: {
            rows: prev[normalizedEmployeeNo]?.rows || [],
            loaded: prev[normalizedEmployeeNo]?.loaded || false,
            loading: false,
            error: message
          }
        }));
      }
    },
    [getAccessToken, showToast]
  );

  const loadHierarchy = useCallback(async () => {
    setHierarchyLoading(true);
    setHierarchyError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const [detailsResponse, childrenResponse] = await Promise.all([
        integrationApi.getErpLearnerDetails(token, ROOT_EMPLOYEE_NO),
        integrationApi.getErpSubordinates(token, ROOT_EMPLOYEE_NO)
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
          String(detailRow.designation || detailRow.designationName || '').trim() ||
          'Chief Executive Officer'
      });
      setHierarchyChildrenByEmployee({
        [ROOT_EMPLOYEE_NO]: {
          rows: childRows,
          loaded: true,
          loading: false,
          error: null
        }
      });
      setExpandedEmployees({ [ROOT_EMPLOYEE_NO]: true });
    } catch (err) {
      setHierarchyError(err instanceof Error ? err.message : 'Failed to load employee hierarchy.');
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
        [employeeNo]: !isExpanded
      }));

      if (!isExpanded && !nodeState?.loaded && !nodeState?.loading) {
        await loadHierarchyChildren(employeeNo);
      }
    },
    [expandedEmployees, hierarchyChildrenByEmployee, loadHierarchyChildren]
  );

  const renderHierarchyNode = (
    employee: HierarchyEmployee,
    depth = 0,
    isRoot = false
  ): React.ReactNode => {
    const nodeState = hierarchyChildrenByEmployee[employee.employeeNumber];
    const isExpanded = Boolean(expandedEmployees[employee.employeeNumber]);
    const childCount = nodeState?.loaded ? nodeState.rows.length : null;
    const canExpand = isRoot || Boolean(nodeState?.loaded) || isExpanded || !nodeState?.error;
    const hasChildren =
      nodeState?.loading || Boolean(nodeState?.error) || (childCount !== null ? childCount > 0 : true);
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
          <span className="absolute left-[12px] top-6 h-px w-[13px] bg-slate-300" aria-hidden="true" />
        ) : null}

        <div
          className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${
            isRoot
              ? 'border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-white shadow-sm hover:border-amber-300 hover:shadow-md'
              : `${depthStyle.cardClass} hover:shadow-sm`
          } ${isSelected ? 'ring-2 ring-primary-600 ring-offset-1' : ''}`}
        >
          <button
            type="button"
            onClick={() => void toggleHierarchyEmployee(employee.employeeNumber)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
              hasChildren ? 'cursor-pointer' : 'cursor-default'
            } ${
              isRoot
                ? 'border-amber-200 bg-amber-100 text-amber-700'
                : depthStyle.iconWrapClass
            }`}
            disabled={!canExpand && !nodeState?.loading}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${employee.name}`}
          >
            <LevelIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => void toggleHierarchyEmployee(employee.employeeNumber)}
            className="min-w-0 flex-1 text-left"
            disabled={!canExpand && !nodeState?.loading}
          >
            <p className="truncate text-[15px] font-semibold leading-5 text-slate-900">{employee.name}</p>
            <p className="truncate text-sm leading-4 text-slate-500">{employee.designation}</p>
          </button>

          {childCount !== null ? (
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                isRoot ? 'border-amber-200 bg-amber-50 text-amber-700' : depthStyle.countClass
              }`}
            >
              {childCount}
            </span>
          ) : null}

          <Button
            type="button"
            variant={isSelected ? 'primary' : 'outline'}
            size="sm"
            className="shrink-0"
            onClick={() => onViewDetails?.(employee)}
          >
            View
          </Button>

          <button
            type="button"
            onClick={() => void toggleHierarchyEmployee(employee.employeeNumber)}
            className={`shrink-0 rounded-full p-1.5 text-slate-400 transition ${
              hasChildren ? 'group-hover:bg-slate-100 group-hover:text-slate-600' : 'opacity-40'
            }`}
            disabled={!canExpand && !nodeState?.loading}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${employee.name}`}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {isExpanded ? (
          <div className="space-y-2">
            {nodeState?.loading ? (
              <div className="relative space-y-2 pl-[25px]">
                <span className="absolute left-[12px] top-0 bottom-0 w-px bg-slate-300" aria-hidden="true" />
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={`${employee.employeeNumber}-skeleton-${index}`}
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
            ) : nodeState?.error ? (
              <div className="ml-[25px] rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {nodeState.error}
              </div>
            ) : nodeState?.loaded && nodeState.rows.length === 0 ? (
              <div className="ml-[25px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-500">
                No subordinates found.
              </div>
            ) : (
              <div className="relative space-y-2">
                <span className="absolute left-[12px] top-0 bottom-0 w-px bg-slate-300" aria-hidden="true" />
                {nodeState?.rows.map((child) => renderHierarchyNode(child, depth + 1)) ?? null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Card
      title="Employee Hierarchy"
      className="flex h-full min-h-[520px] flex-col xl:h-[calc(100vh-170px)]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadHierarchy()}
          isLoading={hierarchyLoading}
        >
          Refresh
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
        <div className="rounded-3xl border border-slate-200 bg-[#fcfcfd] p-3 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm">
                <Network className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Organization Tree
              </p>
            </div>
          </div>
          <div className="space-y-2">{renderHierarchyNode(hierarchyRoot, 0, true)}</div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Hierarchy is not available right now.</p>
      )}
    </Card>
  );
}
