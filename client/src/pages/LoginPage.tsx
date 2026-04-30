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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-4">

      <div className="relative w-full max-w-md">
        <div className="mb-12 text-center">
          <img
            src="/assets/logo.png"
            alt="SLT Mobitel"
            className="mx-auto h-20 w-auto"
          />
        </div>

        <Card className="w-full border-secondary-200/50 bg-white/90 shadow-large backdrop-blur-sm">
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
