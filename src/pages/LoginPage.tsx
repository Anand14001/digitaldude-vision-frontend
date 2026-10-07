import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuth((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      // A forced password change takes priority over wherever they were going.
      if (user.mustChangePassword) {
        navigate('/profile?tab=security&forced=1', { replace: true });
      } else if (user.kind === 'CLIENT') {
        navigate('/portal', { replace: true });
      } else {
        navigate(from && from !== '/login' ? from : '/', { replace: true });
      }
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to the Digital Dude workspace."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@digital-dude.com"
          prefix={<Mail className="h-4 w-4" />}
        />

        <div>
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
              prefix={<Lock className="h-4 w-4" />}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-[2.1rem] text-subtle transition-colors hover:text-fg"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        Client of Digital Dude? Use the same form — your portal opens automatically.
      </p>
    </AuthShell>
  );
}
