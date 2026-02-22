import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { employeeApi } from '../../api/lpmsApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAuth } from '../../contexts/useAuth';

type EnrollmentRow = {
  id: string;
  status: string;
  progress: number;
  enrolled_at: string;
  completed_at?: string;
  learning_path_id: string;
  title: string;
  description: string;
  total_duration: string;
};

type PublicPathRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  total_duration: string;
  status: string;
  already_enrolled: boolean;
};

type ProgressSummary = {
  total_enrollments: string;
  completed_enrollments: string;
  average_progress: string;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

export function EmployeeDashboard() {
  const { getAccessToken } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [publicPaths, setPublicPaths] = useState<PublicPathRow[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [progressLoadingId, setProgressLoadingId] = useState<string | null>(null);
  const [selfEnrollLoadingId, setSelfEnrollLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      const [pathsResponse, publicPathsResponse, progressResponse, notificationsResponse] = await Promise.all([
        employeeApi.getMyPaths(token),
        employeeApi.getPublicPaths(token),
        employeeApi.getMyProgress(token),
        employeeApi.getNotifications(token)
      ]);

      setEnrollments(pathsResponse.enrollments);
      setPublicPaths(publicPathsResponse.learningPaths);
      setSummary(progressResponse.progress);
      setNotifications(notificationsResponse.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status !== 'COMPLETED'),
    [enrollments]
  );

  const handleProgressUpdate = async (enrollment: EnrollmentRow, nextProgress: number) => {
    const boundedProgress = Math.max(0, Math.min(100, nextProgress));
    setProgressLoadingId(enrollment.id);
    setError(null);
    setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      await employeeApi.updateMyProgress(token, enrollment.id, boundedProgress);
      setMessage(`Progress updated for "${enrollment.title}".`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress.');
    } finally {
      setProgressLoadingId(null);
    }
  };

  const handleSelfEnroll = async (path: PublicPathRow) => {
    setSelfEnrollLoadingId(path.id);
    setError(null);
    setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }
      await employeeApi.selfEnroll(token, path.id);
      setMessage(`You have enrolled in "${path.title}".`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to self-enroll.');
    } finally {
      setSelfEnrollLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Dashboard</h1>
        <p className="text-slate-500">Track your learning journey.</p>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}
      {message ? <Card className="text-green-700">{message}</Card> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">Active Learning Paths</h2>
          {loading ? (
            <Card>Loading enrollments...</Card>
          ) : activeEnrollments.length > 0 ? (
            activeEnrollments.map((enrollment) => (
              <Card key={enrollment.id}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Badge variant="info" className="mb-2">
                      {enrollment.status.replace('_', ' ')}
                    </Badge>
                    <h3 className="text-xl font-bold text-slate-900">{enrollment.title}</h3>
                    <p className="text-slate-500 text-sm mt-1">{enrollment.description}</p>
                  </div>
                  <p className="text-sm text-slate-500">{enrollment.total_duration}</p>
                </div>

                <ProgressBar progress={enrollment.progress} showLabel />

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleProgressUpdate(enrollment, enrollment.progress + 10)}
                    isLoading={progressLoadingId === enrollment.id}
                  >
                    +10% Progress
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleProgressUpdate(enrollment, 100)}
                    isLoading={progressLoadingId === enrollment.id}
                  >
                    Mark Complete
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="text-slate-500">No active learning paths.</Card>
          )}

          <Card title="Public Learning Paths">
            <div className="space-y-3">
              {publicPaths.length === 0 ? (
                <p className="text-sm text-slate-500">No public learning paths available.</p>
              ) : (
                publicPaths.map((path) => (
                  <div
                    key={path.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{path.title}</p>
                      <p className="text-xs text-slate-500">{path.description}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSelfEnroll(path)}
                      isLoading={selfEnrollLoadingId === path.id}
                      disabled={path.already_enrolled}
                    >
                      {path.already_enrolled ? 'Already Enrolled' : 'Self Enroll'}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="My Stats">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {summary ? summary.total_enrollments : '--'}
                </p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {summary ? summary.completed_enrollments : '--'}
                </p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-4">
              Average Progress: {summary ? `${summary.average_progress}%` : '--'}
            </p>
          </Card>

          <Card title="Notifications">
            <div className="space-y-4">
              {notifications.slice(0, 8).map((notification) => (
                <div key={notification.id} className="flex gap-3 items-start">
                  <div className="mt-1 p-1.5 rounded-full flex-shrink-0 bg-blue-100 text-blue-600">
                    <Bell className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                    <p className="text-xs text-slate-500">{notification.message}</p>
                  </div>
                </div>
              ))}
              {!loading && notifications.length === 0 ? (
                <p className="text-sm text-slate-500">No notifications.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
