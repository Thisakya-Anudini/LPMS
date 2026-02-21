import React from 'react';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Users, AlertTriangle, CheckCircle } from 'lucide-react';
export function SupervisorDashboard() {
  const teamMembers = [
  {
    name: 'Alice Johnson',
    role: 'Senior Dev',
    progress: 85,
    status: 'On Track'
  },
  {
    name: 'Bob Smith',
    role: 'Junior Dev',
    progress: 30,
    status: 'Behind'
  },
  {
    name: 'Charlie Brown',
    role: 'Designer',
    progress: 60,
    status: 'On Track'
  },
  {
    name: 'Diana Prince',
    role: 'Product Mgr',
    progress: 95,
    status: 'Completed'
  }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Overview</h1>
        <p className="text-slate-500">Monitor your team's learning progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full mr-4">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Team Members</p>
              <p className="text-2xl font-bold text-slate-900">12</p>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center">
            <div className="p-3 bg-amber-100 rounded-full mr-4">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending Approvals</p>
              <p className="text-2xl font-bold text-slate-900">3</p>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full mr-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Team Completion Rate</p>
              <p className="text-2xl font-bold text-slate-900">72%</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Team Progress">
        <div className="space-y-6">
          {teamMembers.map((member, i) =>
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">

              <div className="flex items-center min-w-[200px]">
                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 mr-3">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.role}</p>
                </div>
              </div>

              <div className="flex-1">
                <ProgressBar
                progress={member.progress}
                showLabel
                size="sm"
                variant={member.progress === 100 ? 'success' : 'default'} />

              </div>

              <div className="min-w-[100px] text-right">
                <Badge
                variant={
                member.status === 'Behind' ?
                'danger' :
                member.status === 'Completed' ?
                'success' :
                'info'
                }>

                  {member.status}
                </Badge>
              </div>

              <div>
                <Button variant="outline" size="sm">
                  Details
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>);

}