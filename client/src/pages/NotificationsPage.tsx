import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../api/lpmsApi';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/useAuth';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  is_read: boolean;
  created_at: string;
};

export function NotificationsPage() {
  const { getAccessToken } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      const response = await notificationsApi.getMyNotifications(token);
      setNotifications(response.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const markAsRead = async (id: string) => {
    try {
      setMarkingId(id);
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }
      await notificationsApi.markAsRead(token, id);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      );
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification.');
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAll(true);
      const token = await getAccessToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }
      await notificationsApi.markAllAsRead(token);
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notifications.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500">{unreadCount} unread notification(s)</p>
        </div>
        <Button
          variant="outline"
          onClick={markAllAsRead}
          isLoading={markingAll}
          disabled={unreadCount === 0}
        >
          Mark All as Read
        </Button>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      <Card>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-slate-500">No notifications available.</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${
                  notification.is_read ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Bell className="h-4 w-4 mt-0.5 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                      <p className="text-sm text-slate-600">{notification.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!notification.is_read ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsRead(notification.id)}
                      isLoading={markingId === notification.id}
                    >
                      Mark Read
                    </Button>
                  ) : (
                    <span className="text-xs text-green-700 font-medium">Read</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
