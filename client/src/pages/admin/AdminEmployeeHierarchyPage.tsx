import React from 'react';
import { EmployeeHierarchyPanel } from '../../components/admin/EmployeeHierarchyPanel';

export function AdminEmployeeHierarchyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Employee Hierarchy</h1>
        <p className="text-slate-500">Browse the organization structure and expand employees to load their subordinates.</p>
      </div>

      <EmployeeHierarchyPanel />
    </div>
  );
}
