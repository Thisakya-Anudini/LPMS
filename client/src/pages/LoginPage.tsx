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
  const [email, setEmail] = useState('');
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
      const loggedInUser = await login(email, password);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 p-4">

      <div className="relative w-full max-w-md">
        <div className="mb-12 text-center">
          <img
            src="/assets/slt-mobitel-logo.png"
            alt="SLT Mobitel"
            className="mx-auto h-20 w-auto"
          />
        </div>

        <Card className="w-full border-white/50 bg-white/80 shadow-xl shadow-[#034c96]/10 backdrop-blur-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0563bb] shadow-lg shadow-[#0563bb]/30">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome to LPMS</h1>
            <p className="mt-2 text-slate-700">Learning Path Management System</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              name="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
