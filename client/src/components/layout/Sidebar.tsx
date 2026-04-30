import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ChevronRight,
  UserCog } from
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
          isHeader: true,
          label: 'Learning Paths',
        
        },
        {
          to: '/learning-admin/paths/create',
          icon: ChevronRight,
          label: 'Create LP',
          isSubmenu: true
        },
        {
          to: '/learning-admin/paths/assign',
          icon: ChevronRight,
          label: 'Assign Enrollments',
          isSubmenu: true
        },
        {
          to: '/learning-admin/paths/manage',
          icon: BookOpen,
          label: 'Manage LPs',
          isSubmenu: true
        },
        {
          to: '/learning-admin/certificates',
          icon: ChevronRight,
          label: 'Certificate Customization',
          isSubmenu: true
        }];

      case 'EMPLOYEE':
        return [
          {
            to: '/learner',
                icon: UserCog,
                label: 'Learner Dashboard'
          
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
          ...(user.isLearningAdmin
            ? [
              {
                to: '/learning-admin',
                icon: UserCog,
                label: 'Learning Admin Dashboard'
              },
              
              {
                to: '/learning-admin/paths/create',
                icon: ChevronRight,
                label: 'Create LP',
                isSubmenu: true
              },
              {
                to: '/learning-admin/paths/assign',
                icon: ChevronRight,
                label: 'Assign Enrollments',
                isSubmenu: true
              },
              {
                to: '/learning-admin/paths/manage',
                icon: ChevronRight,
                label: 'Manage LPs',
                isSubmenu: true
              },
              {
                to: '/learning-admin/certificates',
                icon: ChevronRight,
                label: 'Certificate Customization',
                isSubmenu: true
              }
            ]
            : []),
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
        fixed top-0 left-0 z-50 h-screen w-64 bg-primary-700 border-r border-primary-800 shadow-medium transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        <div className="flex h-16 items-center px-6 border-b border-primary-600 bg-primary-800">
          <div className="flex items-center">
            <img
              src="/assets/logo-whitenew.png"
              alt="LPMS"
              className="h-12 w-auto"
            />
          </div>
        </div>

        <div className="px-3 py-6">
          
          <nav className="space-y-1">
            {links.map((link) =>
            link.isHeader ? (
              <div
                key={`hdr-${link.label}`}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary-300"
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
                  flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${link.isSubmenu ? 'ml-3' : ''}
                  ${
                    isActive
                      ? 'bg-primary-600 text-white border-l-2 border-white'
                      : 'text-primary-200 hover:bg-primary-600 hover:text-white'
                  }
                `}>

                <link.icon className="mr-3 h-5 w-5" />
                {link.label}
              </NavLink>
            )
            )}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-primary-600 bg-primary-800">
          <div className="flex items-center px-2">
            <div className="h-8 w-8 rounded-full bg-white text-primary-700 flex items-center justify-center text-sm font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user.name}</p>
            </div>
          </div>
        </div>
      </aside>
    </>);

}
