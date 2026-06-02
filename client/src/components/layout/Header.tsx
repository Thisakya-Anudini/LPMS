import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu
} from 'lucide-react';
import { notificationsApi } from '../../api/lpmsApi';
import { useAuth } from '../../contexts/useAuth';
import { Button } from '../ui/Button';
import { getNavigationModel, isGroupActive, isLinkActive, NavigationGroup, NavigationLink } from './navigation';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  is_read: boolean;
  created_at: string;
};

type OpenMenu = 'mobile' | 'profile' | 'notifications' | `group:${string}` | null;

function TopNavLink({
  link,
  pathname,
  suppressActive
}: {
  link: NavigationLink;
  pathname: string;
  suppressActive?: boolean;
}) {
  const active = !suppressActive && isLinkActive(pathname, link);

  return (
    <NavLink
      to={link.to || '#'}
      end={link.matchMode === 'exact'}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'bg-slate-950/85 text-white shadow-sm'
          : 'text-white/80 hover:bg-white/10 hover:text-white'
      }`}
    >
      {link.label}
    </NavLink>
  );
}

function DesktopDropdownLink({
  link,
  pathname,
  onClose
}: {
  link: NavigationLink;
  pathname: string;
  onClose: () => void;
}) {
  const active = isLinkActive(pathname, link);

  if (link.children?.length) {
    return (
      <div className="group/nested relative">
        <button
          type="button"
          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-colors ${
            active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          }`}
        >
          <link.icon className="h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">{link.label}</span>
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="invisible absolute left-[calc(100%-0.25rem)] top-0 z-50 w-80 rounded-3xl border border-slate-200 bg-white p-2 opacity-0 shadow-2xl transition group-hover/nested:visible group-hover/nested:opacity-100">
          {link.children.map((child) => (
            <DesktopDropdownLink key={`${child.to}-${child.label}`} link={child} pathname={pathname} onClose={onClose} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <NavLink
      key={link.to}
      to={link.to || '#'}
      end={link.matchMode === 'exact'}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors ${
          isActive || active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
        }`
      }
    >
      <link.icon className="h-4 w-4" />
      {link.label}
    </NavLink>
  );
}

function DesktopDropdown({
  group,
  pathname,
  menuKey,
  openMenu,
  onToggle,
  onClose
}: {
  group: NavigationGroup;
  pathname: string;
  menuKey: OpenMenu;
  openMenu: OpenMenu;
  onToggle: (menu: OpenMenu) => void;
  onClose: () => void;
}) {
  const active = isGroupActive(pathname, group);

  return (
    <div className="relative" data-header-menu-root="true">
      <button
        type="button"
        onClick={() => onToggle(menuKey)}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
          active || openMenu === menuKey
            ? 'bg-slate-950/85 text-white shadow-sm'
            : 'text-white/80 hover:bg-white/10 hover:text-white'
        }`}
      >
        <group.icon className="h-4 w-4" />
        {group.label}
        <ChevronDown className={`h-4 w-4 transition-transform ${openMenu === menuKey ? 'rotate-180' : ''}`} />
      </button>

      {openMenu === menuKey ? (
        <div className="absolute left-0 top-12 z-50 w-72 rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{group.label}</p>
            <p className="mt-1 text-xs text-slate-500">Jump straight to tools in this workspace.</p>
          </div>
          <div className="p-2">
            {group.links.map((link) => (
              <DesktopDropdownLink key={`${link.to}-${link.label}`} link={link} pathname={pathname} onClose={onClose} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Header() {
  const { pathname } = useLocation();
  const { user, logout, getAccessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const navigation = useMemo(() => (user ? getNavigationModel(user) : null), [user]);

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
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-header-menu-root="true"]')) {
        return;
      }
      setOpenMenu(null);
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  const handleToggleMenu = async (menu: OpenMenu) => {
    const nextMenu = openMenu === menu ? null : menu;
    setOpenMenu(nextMenu);

    if (nextMenu === 'notifications') {
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

  if (!user || !navigation) {
    return null;
  }

  const currentSection =
    navigation.primaryLinks.find((link) => isLinkActive(pathname, link))?.label ||
    navigation.groups.find((group) => isGroupActive(pathname, group))?.label ||
    'Workspace';

  return (
    <header className="sticky top-0 z-30 border-b border-white/20 bg-[linear-gradient(90deg,#034c96_0%,#0563bb_25%,#3faa45_98%,#3faa45_100%)] backdrop-blur">
      <div className="w-full px-3 sm:px-5 lg:px-10 xl:px-14">
        <div className="flex h-16 items-center gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/50 bg-white/10 backdrop-blur-md text-white shadow-sm">
              <img src="/assets/ShortLogo2.png" alt="LPMS logo" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-white">LPMS</p>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/70">Learning Portal</p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2 lg:gap-3">
            <button
              type="button"
              onClick={() => handleToggleMenu('mobile')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/10 text-white transition-colors hover:bg-white/20 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative" data-header-menu-root="true">
              <button
                type="button"
                onClick={() => handleToggleMenu('notifications')}
                className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  openMenu === 'notifications'
                    ? 'border-white bg-white/25 text-white shadow-lg scale-105'
                    : 'border-white/35 bg-white/10 text-white hover:bg-white/20 hover:border-white/50'
                }`}
                aria-label="Notifications"
              >
                <Bell className={`h-6 w-6 transition-transform duration-300 ${openMenu === 'notifications' ? 'scale-110' : ''}`} />
                {unreadLabel ? (
                  <span className={`absolute -right-2 -top-2 min-w-[24px] rounded-full px-1.5 py-0.5 text-xs font-bold leading-4 shadow-lg transition-all duration-300 ${
                    unreadCount > 0
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-white text-slate-950'
                  }`}>
                    {unreadLabel}
                  </span>
                ) : null}
              </button>

              {openMenu === 'notifications' ? (
                <div className="absolute right-0 top-16 z-50 w-[400px] max-w-[95vw] origin-top-right animate-in fade-in zoom-in-95 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200">
                  <div className="flex items-center justify-between border-b-2 border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 px-5 py-4">
                    <div>
                      <p className="text-base font-bold text-slate-900">Notifications</p>
                      <p className="text-xs text-slate-600">Stay updated with your learning progress</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMarkAllAsRead}
                      isLoading={markingAll}
                      disabled={unreadCount === 0}
                      className="whitespace-nowrap"
                    >
                      Mark all
                    </Button>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto">
                    {loadingNotifications ? (
                      <div className="flex items-center justify-center px-4 py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500"></div>
                      </div>
                    ) : notificationError ? (
                      <div className="border-l-4 border-red-500 bg-red-50 px-5 py-4 text-sm text-red-700 m-3 rounded">
                        {notificationError}
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-4 py-12">
                        <Bell className="h-12 w-12 text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-600">No notifications yet</p>
                        <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map((notification, index) => (
                          <div
                            key={notification.id}
                            className={`group/item px-5 py-4 transition-all duration-200 hover:bg-slate-50 animate-in fade-in slide-in-from-top-2`}
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{notification.title}</p>
                                  {!notification.is_read && (
                                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500 animate-pulse"></div>
                                  )}
                                </div>
                                <p className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</p>
                                <p className="mt-2 text-xs text-slate-500">
                                  {new Date(notification.created_at).toLocaleString()}
                                </p>
                              </div>
                              {!notification.is_read ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  isLoading={markingId === notification.id}
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="flex-shrink-0 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                >
                                  Mark read
                                </Button>
                              ) : (
                                <div className="flex-shrink-0 text-xs text-slate-500 font-medium">Read</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t-2 border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-3">
                    <NavLink
                      to="/notifications"
                      onClick={() => setOpenMenu(null)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors hover:underline"
                    >
                      View all notifications
                      <ChevronRight className="h-4 w-4" />
                    </NavLink>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative" data-header-menu-root="true">
              <button
                type="button"
                onClick={() => handleToggleMenu('profile')}
                className="inline-flex h-11 items-center gap-3 rounded-full border border-white/35 bg-white px-1.5 text-left shadow-sm transition-colors hover:bg-white/95 lg:w-[200px]"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden min-w-0 flex-1 pr-1 lg:block">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{currentSection}</p>
                </div>
                <ChevronDown
                  className={`hidden h-4 w-4 shrink-0 text-slate-500 transition-transform lg:block ${
                    openMenu === 'profile' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openMenu === 'profile' ? (
                <div className="absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b border-slate-100 px-4 py-4">
                    <p className="text-base font-semibold text-slate-900">{user.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                  </div>
                  <div className="p-2">
                    <NavLink
                      to={navigation.primaryLinks[0]?.to || '/'}
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
                    >
                      <GraduationCap className="h-4 w-4" />
                      Go to workspace
                    </NavLink>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 border-t border-white/25 py-2 lg:flex">
          {navigation.primaryLinks.map((link) => (
            <TopNavLink
              key={link.to}
              link={link}
              pathname={pathname}
              suppressActive={typeof openMenu === 'string' && openMenu.startsWith('group:')}
            />
          ))}

          {navigation.groups.map((group) => (
            <DesktopDropdown
              key={group.label}
              group={group}
              pathname={pathname}
              menuKey={`group:${group.label}`}
              openMenu={openMenu}
              onToggle={handleToggleMenu}
              onClose={() => setOpenMenu(null)}
            />
          ))}
        </div>

        {openMenu === 'mobile' ? (
          <div className="border-t border-white/25 py-3 lg:hidden" data-header-menu-root="true">
            <div className="space-y-2">
              {navigation.primaryLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.matchMode === 'exact'}
                  onClick={() => setOpenMenu(null)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive || isLinkActive(pathname, link)
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    }`
                  }
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ))}

              {navigation.groups.map((group) => (
                <div key={group.label} className="rounded-3xl border border-slate-200 bg-white p-2">
                  <div className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {group.label}
                  </div>
                  {group.links.map((link) => (
                    <React.Fragment key={`${link.to}-${link.label}`}>
                      {link.children?.length ? (
                        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {link.label}
                        </div>
                      ) : (
                        <NavLink
                          to={link.to || '#'}
                          end={link.matchMode === 'exact'}
                          onClick={() => setOpenMenu(null)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors ${
                              isActive || isLinkActive(pathname, link)
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                            }`
                          }
                        >
                          <link.icon className="h-4 w-4" />
                          {link.label}
                        </NavLink>
                      )}

                      {link.children?.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to || '#'}
                          end={child.matchMode === 'exact'}
                          onClick={() => setOpenMenu(null)}
                          className={({ isActive }) =>
                            `ml-3 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors ${
                              isActive || isLinkActive(pathname, child)
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                            }`
                          }
                        >
                          <child.icon className="h-4 w-4" />
                          {child.label}
                        </NavLink>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
