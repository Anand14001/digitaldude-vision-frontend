import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { apiPost, errorMessage } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { AuthShell, PasswordRules, passwordIsValid } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/auth/forgot-password', { email });
      // The API answers the same way whether or not the address exists.
      setSent(true);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your inbox">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="mt-4 text-sm text-fg">
            If an account exists for <span className="font-medium">{email}</span>, a reset link
            is on its way.
          </p>
          <p className="mt-2 text-xs text-muted">The link is valid for one hour.</p>
          <Link to="/login" className="mt-6 text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a link to set a new one."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          prefix={<Mail className="h-4 w-4" />}
          placeholder="you@digital-dude.com"
        />
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Send reset link
        </Button>
        <Link to="/login" className="block text-center text-sm text-muted hover:text-fg">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = passwordIsValid(password) && !mismatch && confirm.length > 0;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    try {
      await apiPost('/auth/reset-password', { token, newPassword: password });
      toast.success('Password updated. Please sign in.');
      navigate('/login', { replace: true });
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="This link is not valid">
        <p className="text-sm text-muted">
          The reset link is missing its token. Please request a new one.
        </p>
        <Link to="/forgot-password" className="mt-4 block text-sm text-primary hover:underline">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Input
            label="New password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordRules value={password} />
        </div>
        <Input
          label="Confirm password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={mismatch ? 'The two passwords do not match' : undefined}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={submitting}
          disabled={!ready}
        >
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
