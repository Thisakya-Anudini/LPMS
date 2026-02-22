import React from 'react';
import { Menu, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { Button } from '../ui/Button';
export function Header({ onMenuClick }: {onMenuClick: () => void;}) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="mr-4 text-slate-500 hover:text-slate-700 lg:hidden">

          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold text-slate-800 lg:hidden">LPMS</h1>
      </div>

      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-2" />

        {user ?
        <span className="hidden md:inline text-sm text-slate-600">
            {user.name}
          </span> :
        null}

        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-slate-600 hover:text-red-600">

          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </header>);

}
