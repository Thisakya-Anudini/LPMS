import React from 'react';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { MOCK_ENROLLMENTS, MOCK_PATHS } from '../../utils/mockData';
import { Download, CheckCircle } from 'lucide-react';
export function MyLearningPaths() {
  const completed = MOCK_ENROLLMENTS.filter((e) => e.status === 'COMPLETED');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          My Learning History
        </h1>
        <p className="text-slate-500">
          View your completed courses and certificates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {completed.map((enrollment) => {
          const path = MOCK_PATHS.find(
            (p) => p.id === enrollment.learningPathId
          );
          if (!path) return null;
          return (
            <Card
              key={enrollment.id}
              className="border-green-200 bg-green-50/30">

              <div className="flex justify-between items-start mb-4">
                <div>
                  <Badge variant="success" className="mb-2">
                    Completed
                  </Badge>
                  <h3 className="text-lg font-bold text-slate-900">
                    {path.title}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Completed on {enrollment.completedAt}
                  </p>
                </div>
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-green-100">
                <div className="text-sm text-slate-600">
                  Score: <span className="font-bold text-slate-900">95%</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50">

                  <Download className="h-4 w-4 mr-2" />
                  Certificate
                </Button>
              </div>
            </Card>);

        })}
      </div>
    </div>);

}