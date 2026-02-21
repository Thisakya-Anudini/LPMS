import React from 'react';
import { Card } from '../../components/ui/Card';
import { SimpleBarChart } from '../../components/charts/SimpleChart';
import { Users, BookOpen, CheckCircle, AlertCircle } from 'lucide-react';
export function AdminDashboard() {
  const stats = [
  {
    label: 'Total Users',
    value: '1,248',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  {
    label: 'Active Paths',
    value: '42',
    icon: BookOpen,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
  },
  {
    label: 'Completions',
    value: '3,892',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  {
    label: 'System Alerts',
    value: '0',
    icon: AlertCircle,
    color: 'text-amber-600',
    bg: 'bg-amber-100'
  }];

  const userActivityData = [
  {
    label: 'Mon',
    value: 120
  },
  {
    label: 'Tue',
    value: 145
  },
  {
    label: 'Wed',
    value: 132
  },
  {
    label: 'Thu',
    value: 190
  },
  {
    label: 'Fri',
    value: 160
  },
  {
    label: 'Sat',
    value: 40
  },
  {
    label: 'Sun',
    value: 25
  }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Overview</h1>
        <p className="text-slate-500">Welcome back, Super Admin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) =>
        <Card key={stat.label} className="p-0">
            <div className="flex items-center p-4">
              <div className={`p-3 rounded-lg ${stat.bg} mr-4`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {stat.value}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="User Activity (Last 7 Days)">
          <SimpleBarChart data={userActivityData} height={250} />
        </Card>

        <Card title="Recent System Logs">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) =>
            <div
              key={i}
              className="flex items-start pb-4 border-b border-slate-100 last:border-0 last:pb-0">

                <div className="h-2 w-2 mt-2 rounded-full bg-blue-500 mr-3" />
                <div>
                  <p className="text-sm text-slate-800">
                    New user batch import completed successfully.
                  </p>
                  <p className="text-xs text-slate-400">2 hours ago • System</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>);

}