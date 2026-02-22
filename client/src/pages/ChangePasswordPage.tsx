import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/useAuth';
import { getDefaultRouteForRole } from '../utils/navigation';

export function ChangePasswordPage() {
  const { user, isBootstrapping, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isBootstrapping && user && !user.mustChangePassword) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await changePassword(oldPassword, newPassword);
      navigate(getDefaultRouteForRole(updated.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" title="Change Password">
        <p className="text-sm text-slate-600 mb-4">
          You must change your password before accessing the system.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Current Password"
            type="password"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            required
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" isLoading={isSubmitting}>
              Update Password
            </Button>
            <Button type="button" variant="outline" onClick={logout}>
              Logout
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
