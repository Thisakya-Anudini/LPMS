import React, { useCallback, useState } from 'react';
import { BookOpen, UserRound } from 'lucide-react';
import {
  EmployeeHierarchyPanel,
  type SelectedHierarchyEmployee
} from '../../components/admin/EmployeeHierarchyPanel';
import { superAdminApi } from '../../api/lpmsApi';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type LearnerPath = {
  enrollment_id: string;
  status: string;
  progress: number;
  enrolled_at: string;
  completed_at?: string;
  learning_path_id: string;
  title: string;
  description: string;
  category: string;
  total_duration: string;
};

export function AdminEmployeeHierarchyPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<SelectedHierarchyEmployee | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [learner, setLearner] = useState<{ id: string; name: string; email: string } | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearnerPath[]>([]);

  const loadLearnerDetails = useCallback(
    async (employee: SelectedHierarchyEmployee) => {
      setSelectedEmployee(employee);
      setLoadingDetails(true);
      setDetailsError(null);
      setLearner(null);
      setLearningPaths([]);

      try {
        const token = await getAccessToken();
        if (!token) {
          showToast('Session expired. Please login again.', 'error');
          return;
        }

        const response = await superAdminApi.getLearnerLearningPathsByEmployeeNo(
          token,
          employee.employeeNumber
        );
        setLearner(response.learner);
        setLearningPaths(response.learningPaths);
      } catch (err) {
        setDetailsError(
          err instanceof Error
            ? err.message
            : 'Failed to load learner details for the selected employee.'
        );
      } finally {
        setLoadingDetails(false);
      }
    },
    [getAccessToken, showToast]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Employee Hierarchy</h1>
        <p className="text-slate-500">Browse the organization structure and inspect learner progress from one workspace.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
        <aside className="min-w-0">
          <EmployeeHierarchyPanel
            selectedEmployeeNumber={selectedEmployee?.employeeNumber}
            onViewDetails={loadLearnerDetails}
          />
        </aside>

        <section className="min-w-0">
          <Card
            title="Learner Details"
            description={
              selectedEmployee
                ? `${selectedEmployee.employeeNumber} | ${selectedEmployee.designation}`
                : 'Select an employee from the hierarchy.'
            }
            className="h-full"
          >
            {!selectedEmployee ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                  <UserRound className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-900">No hierarchy employee selected</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Use the View button on a hierarchy employee to load their assigned learning paths here.
                </p>
              </div>
            ) : loadingDetails ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Skeleton className="mb-3 h-5 w-52" />
                  <Skeleton className="h-4 w-64" />
                </div>
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={`selected-learner-path-skeleton-${index}`} className="rounded-xl border border-slate-200 p-4">
                    <Skeleton className="mb-3 h-5 w-60" />
                    <Skeleton className="mb-3 h-3 w-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
              </div>
            ) : detailsError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {detailsError}
              </div>
            ) : learner ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-lg font-semibold text-slate-900">{learner.name}</p>
                  <p className="text-sm text-slate-500">{learner.email}</p>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-900">
                      Assigned Learning Paths ({learningPaths.length})
                    </p>
                  </div>

                  {learningPaths.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      No learning paths assigned to this learner.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {learningPaths.map((path) => (
                        <div key={path.enrollment_id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <p className="min-w-0 font-medium text-slate-900">{path.title}</p>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {path.status.replace('_', ' ')}
                            </span>
                          </div>
                          <ProgressBar progress={Number(path.progress || 0)} showLabel size="sm" />
                          <p className="mt-2 text-xs text-slate-500">
                            {path.category.replace('_', ' ')} | {path.total_duration}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Learner details are not available.</p>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
