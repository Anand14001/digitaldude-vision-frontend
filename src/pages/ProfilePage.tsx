import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Camera, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { apiPost, apiUpload, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { FileObject } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  FieldGrid,
  Input,
  PageHeader,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@/components/ui';
import { PasswordRules, passwordIsValid } from './AuthShell';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun; hint: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, hint: 'Always light' },
  { value: 'dark', label: 'Dark', icon: Moon, hint: 'Always dark' },
  { value: 'system', label: 'System', icon: Monitor, hint: 'Follows your device' },
];

export function ProfilePage() {
  const [params] = useSearchParams();
  const { user, updateProfile, reload } = useAuth();
  const { mode, setMode } = useTheme();
  const [tab, setTab] = useState(params.get('tab') ?? 'profile');
  const forced = params.get('forced') === '1';
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
  });

  const saveProfile = useMutation({
    mutationFn: () => updateProfile({ name: form.name, phone: form.phone }),
    onSuccess: () => toast.success('Profile updated'),
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const [uploaded] = await apiUpload<FileObject[]>('/files', [file], { folder: 'avatars' });
      if (!uploaded) throw new Error('Upload failed');
      await apiPost(`/files/${uploaded.id}/set-avatar`);
    },
    onSuccess: async () => {
      toast.success('Photo updated');
      await reload();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  /** The theme is stored per user, so it follows them to another device. */
  const persistTheme = (next: ThemeMode) => {
    setMode(next);
    void updateProfile({ theme: next.toUpperCase() as 'LIGHT' | 'DARK' | 'SYSTEM' }).catch(
      () => undefined,
    );
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My profile" description="Your details, appearance and password." />

      {forced && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="text-sm text-warning">
            <p className="font-medium">Please set a new password</p>
            <p className="mt-0.5 text-xs">
              Your account was set up with a temporary password. The rest of the CRM unlocks once
              you have changed it.
            </p>
          </div>
        </div>
      )}

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab value="profile">Profile</Tab>
          <Tab value="appearance">Appearance</Tab>
          <Tab value="security">Security</Tab>
        </TabList>

        <TabPanel value="profile">
          <div className="space-y-5">
            <Card>
              <CardHeader title="Photo" />
              <div className="flex items-center gap-4 px-5 py-4">
                <Avatar name={user.name} src={user.avatarUrl} size="lg" />
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Camera className="h-3.5 w-3.5" />}
                    loading={uploadAvatar.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    Change photo
                  </Button>
                  <p className="mt-1.5 text-2xs text-muted">JPG, PNG or WebP, up to 50 MB.</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadAvatar.mutate(file);
                    event.target.value = '';
                  }}
                />
              </div>
            </Card>

            <Card>
              <CardHeader title="Details" />
              <div className="space-y-4 px-5 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                  <Input
                    label="Phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </div>

                <FieldGrid cols={2}>
                  <Field label="Email">{user.email}</Field>
                  <Field label="Role">
                    {user.role ? (
                      <Badge tone={user.role.isAdmin ? 'primary' : 'neutral'}>
                        {user.role.name}
                      </Badge>
                    ) : (
                      'No role'
                    )}
                  </Field>
                  {user.employee && (
                    <>
                      <Field label="Employee code">{user.employee.code}</Field>
                      <Field label="Designation">{user.employee.designation}</Field>
                      <Field label="Department">{user.employee.department}</Field>
                    </>
                  )}
                  {user.client && <Field label="Client">{user.client.name}</Field>}
                </FieldGrid>

                <p className="text-2xs text-muted">
                  Your email, role and designation are managed by an administrator.
                </p>

                <div className="flex justify-end border-t border-border pt-4">
                  <Button
                    loading={saveProfile.isPending}
                    disabled={form.name.trim().length < 2}
                    onClick={() => saveProfile.mutate()}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="appearance">
          <Card>
            <CardHeader
              title="Theme"
              description="Saved to your account, so it follows you to another device."
            />
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => persistTheme(option.value)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
                    mode === option.value
                      ? 'border-primary bg-primary-soft'
                      : 'border-border hover:border-border-strong',
                  )}
                >
                  <option.icon
                    className={cn(
                      'h-5 w-5',
                      mode === option.value ? 'text-primary' : 'text-muted',
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      mode === option.value ? 'text-primary' : 'text-fg',
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-2xs text-muted">{option.hint}</span>
                </button>
              ))}
            </div>
          </Card>
        </TabPanel>

        <TabPanel value="security">
          <ChangePasswordCard forced={forced} />
        </TabPanel>
      </Tabs>
    </div>
  );
}

function ChangePasswordCard({ forced }: { forced: boolean }) {
  const { reload } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });

  const change = useMutation({
    mutationFn: () =>
      apiPost('/auth/change-password', {
        currentPassword: form.current,
        newPassword: form.next,
      }),
    onSuccess: async () => {
      toast.success('Password changed. Other sessions have been signed out.');
      setForm({ current: '', next: '', confirm: '' });
      await reload();
      if (forced) window.location.assign('/');
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;
  const ready = form.current.length > 0 && passwordIsValid(form.next) && !mismatch && form.confirm;

  return (
    <Card>
      <CardHeader
        title="Change password"
        description="Changing it signs out every other session."
      />
      <div className="space-y-4 px-5 py-4">
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={form.current}
          onChange={(event) => setForm({ ...form, current: event.target.value })}
        />
        <div>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={form.next}
            onChange={(event) => setForm({ ...form, next: event.target.value })}
          />
          <PasswordRules value={form.next} />
        </div>
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(event) => setForm({ ...form, confirm: event.target.value })}
          error={mismatch ? 'The two passwords do not match' : undefined}
        />
        <div className="flex justify-end border-t border-border pt-4">
          <Button
            loading={change.isPending}
            disabled={!ready}
            onClick={() => change.mutate()}
          >
            Change password
          </Button>
        </div>
      </div>
    </Card>
  );
}
