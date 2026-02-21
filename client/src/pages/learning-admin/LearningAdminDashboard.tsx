import React from 'react';
import { Card } from '../../components/ui/Card';
import { SimpleBarChart } from '../../components/charts/SimpleChart';
import { BookOpen, Users, Award, TrendingUp } from 'lucide-react';
export function LearningAdminDashboard() {
  const enrollmentData = [
  {
    label: 'Restricted',
    value: 450,
    color: 'bg-red-500'
  },
  {
    label: 'Semi-Restricted',
    value: 320,
    color: 'bg-amber-500'
  },
  {
    label: 'Public',
    value: 890,
    color: 'bg-green-500'
  }];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Learning Administration
          </h1>
          <p className="text-slate-500">
            Manage learning paths and enrollments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 font-medium">Total Enrollments</p>
              <h3 className="text-3xl font-bold mt-1">1,660</h3>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-blue-100">
            <TrendingUp className="h-4 w-4 mr-1" />
            <span>+12% from last month</span>
          </div>
        </Card>

        <Card className="bg-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 font-medium">
                Active Learning Paths
              </p>
              <h3 className="text-3xl font-bold mt-1 text-slate-900">24</h3>
            </div>
            <div className="bg-purple-100 p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-500">
            8 Restricted • 6 Semi • 10 Public
          </div>
        </Card>

        <Card className="bg-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 font-medium">Completion Rate</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-900">78%</h3>
            </div>
            <div className="bg-green-100 p-2 rounded-lg">
              <Award className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-500">
            Average across all paths
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Enrollments by Category" className="lg:col-span-2">
          <SimpleBarChart data={enrollmentData} height={300} />
        </Card>

        <Card title="Top Performing Paths">
          <div className="space-y-4">
            {[
            {
              name: 'Security Basics',
              completions: 450,
              rate: '98%'
            },
            {
              name: 'Leadership 101',
              completions: 210,
              rate: '85%'
            },
            {
              name: 'React Advanced',
              completions: 120,
              rate: '72%'
            },
            {
              name: 'Onboarding',
              completions: 890,
              rate: '100%'
            }].
            map((path, i) =>
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">

                <div>
                  <p className="font-medium text-slate-900">{path.name}</p>
                  <p className="text-xs text-slate-500">
                    {path.completions} completions
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-green-600">
                    {path.rate}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>);

}