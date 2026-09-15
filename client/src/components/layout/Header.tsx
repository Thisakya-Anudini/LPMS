import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
} from "lucide-react";
import { notificationsApi } from "../../api/lpmsApi";
import { useAuth } from "../../contexts/useAuth";
import { Button } from "../ui/Button";
import {
  getNavigationModel,
  isGroupActive,
  isLinkActive,
  NavigationGroup,
  NavigationLink,
} from "./navigation";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  is_read: boolean;
  created_at: string;
};

type OpenMenu =
  | "mobile"
  | "profile"
  | "notifications"
  | `group:${string}`
  | null;

function TopNavLink({
  link,
  pathname,
  suppressActive,
}: {
  link: NavigationLink;
  pathname: string;
  suppressActive?: boolean;
}) {
  const active = !suppressActive && isLinkActive(pathname, link);

  return (
    <NavLink
      to={link.to || "#"}
      end={link.matchMode === "exact"}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-slate-950/85 text-white shadow-sm"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {link.label}
    </NavLink>
  );
}

function DesktopDropdownLink({
  link,
  pathname,
  onClose,
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
            active
              ? "bg-slate-900 text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
          }`}
        >
          <link.icon className="h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">{link.label}</span>
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="invisible absolute left-[calc(100%-0.25rem)] top-0 z-50 w-80 rounded-3xl border border-slate-200 bg-white p-2 opacity-0 shadow-2xl transition group-hover/nested:visible group-hover/nested:opacity-100">
          {link.children.map((child) => (
            <DesktopDropdownLink
              key={`${child.to}-${child.label}`}
              link={child}
              pathname={pathname}
              onClose={onClose}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <NavLink
      key={link.to}
      to={link.to || "#"}
      end={link.matchMode === "exact"}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors ${
          isActive || active
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
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
  onClose,
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
            ? "bg-slate-950/85 text-white shadow-sm"
            : "text-white/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        <group.icon className="h-4 w-4" />
        {group.label}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${openMenu === menuKey ? "rotate-180" : ""}`}
        />
      </button>

      {openMenu === menuKey ? (
        <div className="absolute left-0 top-12 z-50 w-72 rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {group.label}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Jump straight to tools in this workspace.
            </p>
          </div>
          <div className="p-2">
            {group.links.map((link) => (
              <DesktopDropdownLink
                key={`${link.to}-${link.label}`}
                link={link}
                pathname={pathname}
                onClose={onClose}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileNavLink({
  link,
  pathname,
  onClose,
  isNested = false,
}: {
  link: NavigationLink;
  pathname: string;
  onClose: () => void;
  isNested?: boolean;
}) {
  return (
    <NavLink
      to={link.to || "#"}
      end={link.matchMode === "exact"}
      onClick={onClose}
      className={({ isActive }) =>
        `${isNested ? "ml-3 " : ""}flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors ${
          isActive || isLinkActive(pathname, link)
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
        }`
      }
    >
      <link.icon className="h-4 w-4" />
      {link.label}
    </NavLink>
  );
}

function MobileMenuGroup({
  group,
  pathname,
  onClose,
}: {
  group: NavigationGroup;
  pathname: string;
  onClose: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-2">
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
            <MobileNavLink link={link} pathname={pathname} onClose={onClose} />
          )}

          {link.children?.map((child) => (
            <MobileNavLink
              key={child.label}
              link={child}
              pathname={pathname}
              onClose={onClose}
              isNested
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

export function Header() {
  const { pathname } = useLocation();
  const { user, logout, getAccessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [showAllUnreadNotifications, setShowAllUnreadNotifications] =
    useState(false);

  const navigation = useMemo(
    () => (user ? getNavigationModel(user) : null),
    [user],
  );

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
      const unread = response.notifications.filter(
        (notification) => !notification.is_read,
      ).length;
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
    window.addEventListener("notifications:updated", onNotificationUpdated);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(
        "notifications:updated",
        onNotificationUpdated,
      );
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

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setShowAllUnreadNotifications(false);
  }, [pathname]);

  const handleToggleMenu = async (menu: OpenMenu) => {
    const nextMenu = openMenu === menu ? null : menu;
    setOpenMenu(nextMenu);
    setShowAllUnreadNotifications(false);

    if (nextMenu === "notifications") {
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
        setNotificationError("Session expired. Please login again.");
        return;
      }
      await notificationsApi.markAsRead(token, id);
      await loadNotifications();
      window.dispatchEvent(new Event("notifications:updated"));
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Failed to update notification.",
      );
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      const token = await getAccessToken();
      if (!token) {
        setNotificationError("Session expired. Please login again.");
        return;
      }
      await notificationsApi.markAllAsRead(token);
      await loadNotifications();
      window.dispatchEvent(new Event("notifications:updated"));
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Failed to update notifications.",
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) {
      return null;
    }
    if (unreadCount > 9) {
      return "9+";
    }
    return String(unreadCount);
  }, [unreadCount]);

  const unreadNotifications = useMemo(
    () =>
      notifications
        .filter((notification) => !notification.is_read)
        .sort(
          (firstNotification, secondNotification) =>
            new Date(secondNotification.created_at).getTime() -
            new Date(firstNotification.created_at).getTime(),
        ),
    [notifications],
  );

  const visibleUnreadNotifications = showAllUnreadNotifications
    ? unreadNotifications
    : unreadNotifications.slice(0, 1);

  const hiddenUnreadCount = Math.max(
    unreadNotifications.length - visibleUnreadNotifications.length,
    0,
  );

  if (!user || !navigation) {
    return null;
  }

  const currentSection =
    navigation.primaryLinks.find((link) => isLinkActive(pathname, link))
      ?.label ||
    navigation.groups.find((group) => isGroupActive(pathname, group))?.label ||
    "Workspace";

  const renderNotificationsMenu = () => {
    if (openMenu !== "notifications") return null;

    return (
      <div className="absolute right-0 top-14 z-50 w-[380px] max-w-[90vw] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
          <p className="text-lg font-semibold text-slate-900">Notifications</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMarkAllAsRead}
            isLoading={markingAll}
            disabled={unreadCount === 0}
            className="shrink-0 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
        <div className="max-h-80 overflow-auto">
          {loadingNotifications ? (
            <p className="px-4 py-2.5 text-sm text-slate-500">
              Loading notifications...
            </p>
          ) : notificationError ? (
            <p className="px-4 py-3 text-sm text-red-600">
              {notificationError}
            </p>
          ) : unreadNotifications.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              No unread notifications.
            </p>
          ) : (
            <>
              {visibleUnreadNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="border-b border-slate-100 bg-violet-50/60 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {notification.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={markingId === notification.id}
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      Read
                    </Button>
                  </div>
                </div>
              ))}

              {hiddenUnreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllUnreadNotifications(true)}
                  className="flex w-full items-center justify-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                >
                  Show {hiddenUnreadCount} more unread
                  <ChevronDown className="h-4 w-4" />
                </button>
              ) : null}
            </>
          )}
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          <NavLink
            to="/notifications"
            onClick={() => setOpenMenu(null)}
            className="text-sm font-semibold text-slate-700 hover:text-slate-950"
          >
            View all notifications
          </NavLink>
        </div>
      </div>
    );
  };

  const renderProfileMenu = () => {
    if (openMenu !== "profile") return null;

    return (
      <div className="absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-base font-semibold text-slate-900">{user.name}</p>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
        <div className="p-2">
          <NavLink
            to={navigation.primaryLinks[0]?.to || "/"}
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
    );
  };

  const renderMobileMenu = () => {
    if (openMenu !== "mobile") return null;

    return (
      <div
        className="border-t border-white/25 py-3 lg:hidden"
        data-header-menu-root="true"
      >
        <div className="space-y-2">
          {navigation.primaryLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.to || "#"}
              end={link.matchMode === "exact"}
              onClick={() => setOpenMenu(null)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive || isLinkActive(pathname, link)
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                }`
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}

          {navigation.groups.map((group) => (
            <MobileMenuGroup
              key={group.label}
              group={group}
              pathname={pathname}
              onClose={() => setOpenMenu(null)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/20 bg-[linear-gradient(90deg,#034c96_0%,#0563bb_25%,#3faa45_98%,#3faa45_100%)] backdrop-blur">
      <div className="w-full px-3 sm:px-5 lg:px-10 xl:px-14">
        <div className="flex h-16 items-center gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/50 bg-white/10 backdrop-blur-md text-white shadow-sm">
              <img
                src="/assets/ShortLogo2.png"
                alt="LPMS logo"
                className="h-7 w-7 object-contain"
              />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-white">
                LPMS
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/70">
                Learning Portal
              </p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2 lg:gap-3">
            <button
              type="button"
              onClick={() => handleToggleMenu("mobile")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/10 text-white transition-colors hover:bg-white/20 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative" data-header-menu-root="true">
              <button
                type="button"
                onClick={() => handleToggleMenu("notifications")}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5 stroke-[1.8]" />
                {unreadLabel ? (
                  <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadLabel}
                  </span>
                ) : null}
              </button>

              {renderNotificationsMenu()}
            </div>

            <div className="relative" data-header-menu-root="true">
              <button
                type="button"
                onClick={() => handleToggleMenu("profile")}
                className="inline-flex h-11 items-center gap-3 rounded-full border border-white/35 bg-white px-1.5 text-left shadow-sm transition-colors hover:bg-white/95 lg:w-[200px]"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden min-w-0 flex-1 pr-1 lg:block">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {currentSection}
                  </p>
                </div>
                <ChevronDown
                  className={`hidden h-4 w-4 shrink-0 text-slate-500 transition-transform lg:block ${
                    openMenu === "profile" ? "rotate-180" : ""
                  }`}
                />
              </button>

              {renderProfileMenu()}
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 border-t border-white/25 py-2 lg:flex">
          {navigation.primaryLinks.map((link) => (
            <TopNavLink
              key={link.to}
              link={link}
              pathname={pathname}
              suppressActive={
                typeof openMenu === "string" && openMenu.startsWith("group:")
              }
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

        {renderMobileMenu()}
      </div>
    </header>
  );
}
