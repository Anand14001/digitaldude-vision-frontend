import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPut, errorMessage } from '@/lib/api';
import { humanise } from '@/lib/utils';
import type { OrgSettings } from '@/types/api';
import {
  Button,
  Card,
  CardHeader,
  Input,
  LoadingBlock,
  Select,
  Switch,
} from '@/components/ui';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function OrgSettingsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'org'],
    queryFn: () => apiGet<OrgSettings>('/settings/org'),
  });

  const [profile, setProfile] = useState<OrgSettings['profile'] | null>(null);

  // Seed the form once the server state arrives.
  useEffect(() => {
    if (data && !profile) setProfile(data.profile);
  }, [data, profile]);

  const saveProfile = useMutation({
    mutationFn: () => apiPut('/settings/org', profile ?? {}),
    onSuccess: () => {
      toast.success('Organisation profile saved');
      void queryClient.invalidateQueries({ queryKey: ['settings', 'org'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const saveFeatures = useMutation({
    mutationFn: (features: Record<string, boolean>) => apiPut('/settings/features', features),
    onSuccess: () => {
      toast.success('Modules updated');
      void queryClient.invalidateQueries({ queryKey: ['settings', 'org'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading || !profile) return <LoadingBlock />;

  const set = <K extends keyof OrgSettings['profile']>(
    key: K,
    value: OrgSettings['profile'][K],
  ) => setProfile((current) => (current ? { ...current, [key]: value } : current));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Organisation profile"
          description="Appears on emails, exports and the client portal."
        />
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              value={profile.name}
              onChange={(event) => set('name', event.target.value)}
            />
            <Input
              label="Legal name"
              value={profile.legalName ?? ''}
              onChange={(event) => set('legalName', event.target.value)}
            />
          </div>

          <Input
            label="Tagline"
            value={profile.tagline ?? ''}
            onChange={(event) => set('tagline', event.target.value)}
            placeholder="Your Digital Partner"
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Email"
              type="email"
              value={profile.email ?? ''}
              onChange={(event) => set('email', event.target.value)}
            />
            <Input
              label="Phone"
              value={profile.phone ?? ''}
              onChange={(event) => set('phone', event.target.value)}
            />
            <Input
              label="Website"
              value={profile.website ?? ''}
              onChange={(event) => set('website', event.target.value)}
            />
          </div>

          <Input
            label="Address"
            value={profile.addressLine ?? ''}
            onChange={(event) => set('addressLine', event.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-4">
            <Input
              label="City"
              value={profile.city ?? ''}
              onChange={(event) => set('city', event.target.value)}
            />
            <Input
              label="State"
              value={profile.state ?? ''}
              onChange={(event) => set('state', event.target.value)}
            />
            <Input
              label="Pincode"
              value={profile.pincode ?? ''}
              onChange={(event) => set('pincode', event.target.value)}
            />
            <Input
              label="GSTIN"
              value={profile.gstin ?? ''}
              onChange={(event) => set('gstin', event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Currency"
              value={profile.currency}
              onChange={(event) => set('currency', event.target.value.toUpperCase())}
              maxLength={3}
            />
            <Input
              label="Timezone"
              value={profile.timezone}
              onChange={(event) => set('timezone', event.target.value)}
            />
            <Select
              label="Financial year starts"
              value={String(profile.financialYearStartMonth)}
              onChange={(event) =>
                set('financialYearStartMonth', Number(event.target.value))
              }
              options={MONTHS.map((month, index) => ({
                value: String(index + 1),
                label: month,
              }))}
            />
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button loading={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
              Save profile
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Modules"
          description="Turning one off hides it from navigation; data is kept."
        />
        <div className="space-y-3.5 px-5 py-4">
          {Object.entries(data?.features ?? {}).map(([key, value]) => (
            <Switch
              key={key}
              checked={value}
              label={humanise(key.replace(/([A-Z])/g, ' $1'))}
              onChange={(next) => saveFeatures.mutate({ [key]: next })}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
