import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/useAuth';
import { getDefaultRouteForRole } from '../utils/navigation';

export function LoginPage() {
  const { login, user, isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isBootstrapping && user) {
    if (user.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const loggedInUser = await login(username, password);
      if (loggedInUser.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }
      navigate(getDefaultRouteForRole(loggedInUser.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50/70 p-4">
      {/* 4-Corner / 4-Side Logo Color Shadow Orbs */}
      {/* Top-Left: SLT Cyan / Sky Blue Glow */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-cyan-400/25 blur-[100px] animate-pulse" style={{ animationDuration: '6s' }} />

      {/* Top-Right: Mobitel Green / Emerald Glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-emerald-500/25 blur-[100px] animate-pulse" style={{ animationDuration: '7s' }} />

      {/* Bottom-Left: Teal / Lime Green Glow */}
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-teal-400/25 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />

      {/* Bottom-Right: SLT Royal Blue Glow */}
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-sky-600/25 blur-[100px] animate-pulse" style={{ animationDuration: '6.5s' }} />

      {/* 4-Side Perimeter Vignette / Ambient Inner Shadows */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sky-500/5 via-transparent to-emerald-500/5" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-teal-500/5" />

      <div className="relative w-full max-w-md">
        <div className="relative mb-10 text-center">
          {/* Subtle Ambient Glow behind logo */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-300/30 to-emerald-300/30 blur-2xl" />
          <img
            src="/assets/logo.png"
            alt="SLT Mobitel"
            className="relative mx-auto h-20 w-auto drop-shadow-sm transition-transform duration-300 hover:scale-105"
          />
        </div>

        <Card className="w-full border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/5 backdrop-blur-md transition-all duration-300 hover:border-slate-300">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500 shadow-lg shadow-primary-500/30">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-secondary-900">Welcome to LPMS</h1>
            <p className="mt-2 text-secondary-600">Learning Path Management System</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Username (Email or Employee ID)"
              type="text"
              name="username"
              placeholder="user@lpms.com or 12345"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="border-slate-200/90 bg-slate-50/90 transition-colors focus:bg-white"
              required
            />
            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="Enter password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-slate-200/90 bg-slate-50/90 transition-colors focus:bg-white"
              required
            />

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
