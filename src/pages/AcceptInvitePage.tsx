import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { AuthShell, PasswordRules, passwordIsValid } from './AuthShell';

/** Turns an emailed invite into a working account by setting the first password. */
export function AcceptInvitePage({ portal }: { portal?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const acceptInvite = useAuth((state) => state.acceptInvite);
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
      const user = await acceptInvite(token, password);
      toast.success(`Welcome aboard, ${user.name.split(' ')[0]}`);
      // Accepting an invite signs them straight in, so go to their home.
      navigate(user.kind === 'CLIENT' ? '/portal' : '/', { replace: true });
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="This invitation is not valid">
        <p className="text-sm text-muted">
          The invitation link is missing its token. Ask whoever invited you to send it again.
        </p>
        <Link to="/login" className="mt-4 block text-sm text-primary hover:underline">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={portal ? 'Welcome to your project portal' : 'Welcome to Digital Dude'}
      subtitle="Choose a password to finish setting up your account."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Input
            label="Create a password"
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
        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!ready}>
          Create my account
        </Button>
      </form>
    </AuthShell>
  );
}
