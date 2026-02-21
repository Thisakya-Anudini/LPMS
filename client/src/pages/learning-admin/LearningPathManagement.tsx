import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { MOCK_PATHS } from '../../utils/mockData';
import { Plus, Search, MoreVertical, FileEdit, Trash2 } from 'lucide-react';
import { Input } from '../../components/ui/Input';
export function LearningPathManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Learning Paths</h1>
          <p className="text-slate-500">
            Create and manage curriculum structures.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create New Path
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search paths..." className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Filter</Button>
            <Button variant="outline">Export</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Path Name</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Stages</th>
                <th className="px-6 py-3">Duration</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {MOCK_PATHS.map((path) =>
              <tr
                key={path.id}
                className="hover:bg-slate-50 transition-colors">

                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      {path.title}
                    </div>
                    <div className="text-slate-500 text-xs truncate max-w-xs">
                      {path.description}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                    variant={
                    path.category === 'RESTRICTED' ?
                    'danger' :
                    path.category === 'SEMI_RESTRICTED' ?
                    'warning' :
                    'success'
                    }>

                      {path.category.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {path.stages.length} Stages
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {path.totalDuration}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                      Active
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-1 text-slate-400 hover:text-blue-600">
                        <FileEdit className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-slate-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>);

}