import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-secondary-50">
      <div className="flex min-h-screen flex-col">
        <Header />

        <main className="flex-1 overflow-x-hidden p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
