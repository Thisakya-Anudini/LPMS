import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ChevronRight,
  UserCog,
  Shield } from
'lucide-react';
export function Sidebar({
  isOpen,
  onClose



}: {isOpen: boolean;onClose: () => void;}) {
  const { user } = useAuth();
  if (!user) return null;
  const getLinks = () => {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return [
        {
          to: '/admin/learners',
          icon: Users,
          label: 'Learners'
        },
        {
          to: '/admin/accounts',
          icon: LayoutDashboard,
          label: 'System Accounts'
        },
        {
          to: '/admin/learning-paths',
          icon: BookOpen,
          label: 'Learning Paths'
        }];

      case 'LEARNING_ADMIN':
        return [
        {
          to: '/learning-admin',
          icon: LayoutDashboard,
          label: 'Dashboard'
        },
        {
          to: '/learning-admin/paths',
          icon: BookOpen,
          label: 'Learning Paths'
        }];

      case 'EMPLOYEE':
        return [
          {
            isHeader: true,
            label: 'Learning Dashboard',
          
          },
          {
            to: '/learner/my-progress',
            icon: ChevronRight,
            label: 'My Learning Progress',
            isSubmenu: true
          },
          {
            to: '/learner/public-paths',
            icon: ChevronRight,
            label: 'Public Learning Paths',
            isSubmenu: true
          },
          {
            to: '/learner/certificates',
            icon: ChevronRight,
            label: 'Certificates',
            isSubmenu: true
          },
          ...(user.isSupervisor
            ? [{
              to: '/supervisor',
              icon: UserCog,
              label: 'Supervisor Dashboard'
            }]
            : [])
        ];

      default:
        return [];
    }
  };
  const links = getLinks();
  return (
    <>
      {/* Mobile overlay */}
      {isOpen &&
      <div
        className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
        onClick={onClose} />

      }

      {/* Sidebar */}
      <aside
        className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-[#034c96] text-white transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        <div className="flex h-16 items-center px-6 border-b border-white/20">
          <div className="flex items-center space-x-2">
            <div className="bg-[#57c84d] p-1.5 rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">LPMS</span>
          </div>
        </div>

        <div className="px-3 py-6">
          <div className="mb-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Menu
          </div>
          <nav className="space-y-1">
            {links.map((link) =>
            link.isHeader ? (
              <div
                key={`hdr-${link.label}`}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                {link.label}
              </div>
            ) : (
              <NavLink
                key={`${link.to}-${link.label}`}
                to={link.to}
                end
                onClick={() => window.innerWidth < 1024 && onClose()}
                className={({ isActive }) => `
                  flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${link.isSubmenu ? 'ml-3' : ''}
                  ${isActive ? 'bg-slate-200 text-slate-900' : 'text-white hover:bg-white/15'}
                `}>

                <link.icon className="mr-3 h-5 w-5" />
                {link.label}
              </NavLink>
            )
            )}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-white/20">
          <div className="flex items-center px-2">
            <div className="h-8 w-8 rounded-full bg-[#57c84d] text-[#034c96] flex items-center justify-center text-sm font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400 capitalize">
                {user.role === 'EMPLOYEE' ? 'learner' : user.role.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>);

}
