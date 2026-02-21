import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Shield, User, Users, GraduationCap, Briefcase } from 'lucide-react';
import { Role } from '../types';
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<Role | null>(null);
  const handleLogin = (role: Role) => {
    setLoading(role);
    setTimeout(() => {
      login(role);
      switch (role) {
        case 'SUPER_ADMIN':
          navigate('/admin');
          break;
        case 'LEARNING_ADMIN':
          navigate('/learning-admin');
          break;
        case 'SUPERVISOR':
          navigate('/supervisor');
          break;
        case 'EMPLOYEE':
          navigate('/employee');
          break;
      }
    }, 800);
  };
  const roles: {
    id: Role;
    label: string;
    icon: any;
    desc: string;
  }[] = [
  {
    id: 'SUPER_ADMIN',
    label: 'Super Admin',
    icon: Shield,
    desc: 'System configuration & user management'
  },
  {
    id: 'LEARNING_ADMIN',
    label: 'Learning Admin',
    icon: GraduationCap,
    desc: 'Manage courses, paths & reports'
  },
  {
    id: 'SUPERVISOR',
    label: 'Supervisor',
    icon: Briefcase,
    desc: 'Track team progress & enrollments'
  },
  {
    id: 'EMPLOYEE',
    label: 'Employee',
    icon: User,
    desc: 'Access courses & view progress'
  }];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="mx-auto bg-blue-600 h-12 w-12 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Welcome to LPMS
        </h1>
        <p className="text-slate-600 mt-2">Learning Path Management System</p>
      </div>

      <Card className="w-full max-w-2xl">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-6 text-center">
            Select a role to login (Demo)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) =>
            <button
              key={role.id}
              onClick={() => handleLogin(role.id)}
              disabled={!!loading}
              className="flex items-start p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">

                <div
                className={`p-2 rounded-lg mr-4 ${loading === role.id ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-blue-200'}`}>

                  <role.icon
                  className={`h-6 w-6 ${loading === role.id ? 'text-blue-600' : 'text-slate-600 group-hover:text-blue-700'}`} />

                </div>
                <div>
                  <h3 className="font-medium text-slate-900 group-hover:text-blue-700">
                    {role.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{role.desc}</p>
                </div>
              </button>
            )}
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
          System v1.0.0 • Secure Enterprise Access
        </div>
      </Card>
    </div>);

}