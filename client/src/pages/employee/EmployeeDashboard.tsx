import React from 'react';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  MOCK_ENROLLMENTS,
  MOCK_PATHS,
  MOCK_NOTIFICATIONS } from
'../../utils/mockData';
import { PlayCircle, Clock, Award, Bell } from 'lucide-react';
export function EmployeeDashboard() {
  const activeEnrollments = MOCK_ENROLLMENTS.filter(
    (e) => e.status === 'IN_PROGRESS'
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Dashboard</h1>
          <p className="text-slate-500">Track your learning journey.</p>
        </div>
        <Button>
          <PlayCircle className="h-4 w-4 mr-2" />
          Resume Learning
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Active Courses */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Active Learning Paths
          </h2>
          {activeEnrollments.length > 0 ?
          activeEnrollments.map((enrollment) => {
            const path = MOCK_PATHS.find(
              (p) => p.id === enrollment.learningPathId
            );
            if (!path) return null;
            return (
              <Card
                key={enrollment.id}
                className="hover:shadow-md transition-shadow">

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <Badge variant="info" className="mb-2">
                        In Progress
                      </Badge>
                      <h3 className="text-xl font-bold text-slate-900">
                        {path.title}
                      </h3>
                      <p className="text-slate-500 text-sm mt-1">
                        {path.description}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <div className="flex items-center justify-end mb-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {path.totalDuration}
                      </div>
                      <span>Due in 5 days</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <ProgressBar progress={enrollment.progress} showLabel />
                  </div>

                  <div className="flex justify-end">
                    <Button>Continue Learning</Button>
                  </div>
                </Card>);

          }) :

          <Card className="p-8 text-center">
              <p className="text-slate-500">
                No active courses. Browse the catalog to start learning!
              </p>
              <Button variant="outline" className="mt-4">
                Browse Catalog
              </Button>
            </Card>
          }
        </div>

        {/* Sidebar - Notifications & Stats */}
        <div className="space-y-6">
          <Card title="My Stats">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">12</p>
                <p className="text-xs text-slate-500">Hours Learned</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">4</p>
                <p className="text-xs text-slate-500">Certificates</p>
              </div>
            </div>
          </Card>

          <Card title="Notifications">
            <div className="space-y-4">
              {MOCK_NOTIFICATIONS.map((notif) =>
              <div key={notif.id} className="flex gap-3 items-start">
                  <div
                  className={`mt-1 p-1.5 rounded-full flex-shrink-0 ${notif.type === 'SUCCESS' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>

                    {notif.type === 'SUCCESS' ?
                  <Award className="h-3 w-3" /> :

                  <Bell className="h-3 w-3" />
                  }
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      2 hours ago
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>);

}