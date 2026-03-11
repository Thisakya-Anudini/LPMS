import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Bell, LogOut } from 'lucide-react';
import { notificationsApi } from '../../api/lpmsApi';
import { useAuth } from '../../contexts/useAuth';
import { Button } from '../ui/Button';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  is_read: boolean;
  created_at: string;
};

export function Header({ onMenuClick }: {onMenuClick: () => void;}) {
  const { user, logout, getAccessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    try {
      setNotificationError(null);
      const token = await getAccessToken();
      if (!token) {
        setUnreadCount(0);
        setNotifications([]);
        return;
      }
      const response = await notificationsApi.getMyNotifications(token);
      const unread = response.notifications.filter((notification) => !notification.is_read).length;
      setUnreadCount(unread);
      setNotifications(response.notifications);
    } catch {
      setUnreadCount(0);
      setNotifications([]);
    }
  }, [getAccessToken, user]);

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 15000);
    const onNotificationUpdated = () => {
      loadNotifications();
    };
    window.addEventListener('notifications:updated', onNotificationUpdated);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('notifications:updated', onNotificationUpdated);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!isPopupOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popupRef.current?.contains(target) ||
        bellRef.current?.contains(target)
      ) {
        return;
      }
      setIsPopupOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isPopupOpen]);

  const togglePopup = async () => {
    const nextOpen = !isPopupOpen;
    setIsPopupOpen(nextOpen);
    if (nextOpen) {
      try {
        setLoadingNotifications(true);
        await loadNotifications();
      } finally {
        setLoadingNotifications(false);
      }
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      setMarkingId(id);
      const token = await getAccessToken();
      if (!token) {
        setNotificationError('Session expired. Please login again.');
        return;
      }
      await notificationsApi.markAsRead(token, id);
      await loadNotifications();
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Failed to update notification.');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      const token = await getAccessToken();
      if (!token) {
        setNotificationError('Session expired. Please login again.');
        return;
      }
      await notificationsApi.markAllAsRead(token);
      await loadNotifications();
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Failed to update notifications.');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) {
      return null;
    }
    if (unreadCount > 9) {
      return '9+';
    }
    return String(unreadCount);
  }, [unreadCount]);

  const roleLabel = user?.role
    ? user.role
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : '';
  const displayRoleLabel = roleLabel === 'Employee' ? 'Learner' : roleLabel;
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#034c96] bg-[linear-gradient(90deg,#034c96_0%,#0563bb_25%,#3faa45_98%,#3faa45_100%)] px-4 lg:px-8 shadow-md">
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="mr-4 text-white/85 hover:text-white lg:hidden transition-colors">

          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold text-white lg:hidden">LPMS</h1>
      </div>

      <div className="flex items-center gap-5 relative">
        {user ? (
          <span className="hidden md:inline-flex items-center rounded-md border border-white/35 bg-white/10 px-3 py-1 text-sm font-semibold tracking-wide text-white">
            {displayRoleLabel}
          </span>
        ) : null}

        <button
          ref={bellRef}
          onClick={togglePopup}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/35 bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadLabel ? (
            <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-[#3faa45] text-[10px] leading-4 text-white text-center font-bold ring-2 ring-[#034c96]">
              {unreadLabel}
            </span>
          ) : null}
        </button>
        {isPopupOpen ? (
          <div
            ref={popupRef}
            className="absolute right-0 top-12 w-[360px] max-w-[90vw] rounded-lg border border-slate-200 bg-white shadow-xl z-50"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAllAsRead}
                isLoading={markingAll}
                disabled={unreadCount === 0}
              >
                Mark all read
              </Button>
            </div>
            <div className="max-h-96 overflow-auto">
              {loadingNotifications ? (
                <p className="px-3 py-3 text-sm text-slate-500">Loading notifications...</p>
              ) : notificationError ? (
                <p className="px-3 py-3 text-sm text-red-600">{notificationError}</p>
              ) : notifications.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-500">No notifications.</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-3 py-3 border-b border-slate-100 ${
                      notification.is_read ? 'bg-white' : 'bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{notification.message}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!notification.is_read ? (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={markingId === notification.id}
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          Read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="md"
          onClick={logout}
          className="text-white hover:text-white hover:bg-white/20 text-sm font-semibold px-3 h-8 border border-white/35 bg-white/10">

          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </header>);

}
