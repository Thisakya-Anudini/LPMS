import React from 'react';
import { Menu, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { Button } from '../ui/Button';
export function Header({ onMenuClick }: {onMenuClick: () => void;}) {
  const { user, logout } = useAuth();
  const roleLabel = user?.role
    ? user.role
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : '';
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#034c96] bg-[linear-gradient(90deg,#034c96_0%,#0563bb_38%,#3faa45_68%,#3faa45_100%)] px-4 lg:px-8 shadow-md">
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="mr-4 text-white/85 hover:text-white lg:hidden transition-colors">

          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold text-white lg:hidden">LPMS</h1>
      </div>

      <div className="flex items-center gap-5">
        {user ? (
          <span className="hidden md:inline-flex items-center rounded-md border border-white/35 bg-white/10 px-3 py-1 text-sm font-semibold tracking-wide text-white">
            {roleLabel}
          </span>
        ) : null}

        <button
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/35 bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-[#3faa45] ring-2 ring-[#3944c1]" />
        </button>

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
