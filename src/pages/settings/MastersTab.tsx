import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { fmtCurrency, fmtDate, humanise } from '@/lib/utils';
import type { MasterRecord } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingBlock,
  Modal,
  SegmentedControl,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  Table,
} from '@/components/ui';

type FieldKind = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'days';

interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
  hint?: string;
  /** Hidden from the table, shown in the form. */
  formOnly?: boolean;
}

interface MasterSpec {
  key: string;
  label: string;
  endpoint: string;
  /** The field used as the display name. */
  nameField: string;
  fields: FieldSpec[];
  description: string;
}

/**
 * All the flat reference tables in one place. Each is described by a small spec
 * rather than its own screen, which keeps nine CRUD UIs from drifting apart.
 */
const SPECS: MasterSpec[] = [
  {
    key: 'departments',
    label: 'Departments',
    endpoint: '/masters/departments',
    nameField: 'name',
    description: 'Used for grouping people and filtering reports.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true },
      { key: 'code', label: 'Code', kind: 'text' },
    ],
  },
  {
    key: 'designations',
    label: 'Designations',
    endpoint: '/masters/designations',
    nameField: 'title',
    description: 'Job titles, with a level used for ordering.',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', required: true },
      { key: 'level', label: 'Level', kind: 'number', hint: 'Higher is more senior' },
    ],
  },
  {
    key: 'skills',
    label: 'Skills',
    endpoint: '/masters/skills',
    nameField: 'name',
    description: 'Tagged on people so you can find the right person for a job.',
    fields: [
      { key: 'name', label: 'Skill', kind: 'text', required: true },
      { key: 'category', label: 'Category', kind: 'text' },
    ],
  },
  {
    key: 'service-lines',
    label: 'Service lines',
    endpoint: '/masters/service-lines',
    nameField: 'name',
    description: 'What the agency sells. Attached to clients, projects and retainers.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true },
      { key: 'code', label: 'Code', kind: 'text', required: true },
      { key: 'active', label: 'Active', kind: 'boolean' },
    ],
  },
  {
    key: 'project-types',
    label: 'Project types',
    endpoint: '/masters/project-types',
    nameField: 'name',
    description: 'Each type can carry a default workflow.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true },
      { key: 'code', label: 'Code', kind: 'text', required: true },
      { key: 'description', label: 'Description', kind: 'text', formOnly: true },
      { key: 'active', label: 'Active', kind: 'boolean' },
    ],
  },
  {
    key: 'project-roles',
    label: 'Project roles',
    endpoint: '/masters/project-roles',
    nameField: 'name',
    description:
      'What someone does on a project - Video Editor, QA, Copywriter. Descriptive only: access always comes from the person Vision role.',
    fields: [
      { key: 'name', label: 'Role', kind: 'text', required: true },
      { key: 'description', label: 'Description', kind: 'text', formOnly: true },
      { key: 'sortOrder', label: 'Order', kind: 'number' },
      { key: 'active', label: 'Active', kind: 'boolean' },
    ],
  },
  {
    key: 'leave-types',
    label: 'Leave types',
    endpoint: '/masters/leave-types',
    nameField: 'name',
    description: 'Quotas feed the balances every employee sees.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true },
      { key: 'code', label: 'Code', kind: 'text', required: true },
      { key: 'annualQuota', label: 'Days per year', kind: 'number', hint: '0 means unaccrued' },
      { key: 'isPaid', label: 'Paid', kind: 'boolean' },
      { key: 'carryForward', label: 'Carries forward', kind: 'boolean' },
      { key: 'requiresProof', label: 'Needs proof', kind: 'boolean' },
      { key: 'active', label: 'Active', kind: 'boolean' },
    ],
  },
  {
    key: 'holidays',
    label: 'Holidays',
    endpoint: '/masters/holidays',
    nameField: 'name',
    description: 'Excluded from leave day counts and marked on the calendar.',
    fields: [
      { key: 'name', label: 'Holiday', kind: 'text', required: true },
      { key: 'date', label: 'Date', kind: 'date', required: true },
      { key: 'isOptional', label: 'Optional', kind: 'boolean' },
    ],
  },
  {
    key: 'work-schedules',
    label: 'Work schedules',
    endpoint: '/masters/work-schedules',
    nameField: 'name',
    description: 'Defines the working week behind attendance and due dates.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true },
      { key: 'workingDays', label: 'Working days', kind: 'days', required: true },
      { key: 'startTime', label: 'Start time', kind: 'text' },
      { key: 'endTime', label: 'End time', kind: 'text' },
      { key: 'isDefault', label: 'Default', kind: 'boolean' },
    ],
  },
  {
    key: 'assets',
    label: 'Assets',
    endpoint: '/masters/assets',
    nameField: 'name',
    description: 'Laptops, cameras, lenses and licences issued to the team.',
    fields: [
      { key: 'assetTag', label: 'Asset tag', kind: 'text', required: true },
      { key: 'name', label: 'Name', kind: 'text', required: true },
      {
        key: 'category',
        label: 'Category',
        kind: 'select',
        required: true,
        options: [
          'LAPTOP',
          'DESKTOP',
          'MONITOR',
          'PHONE',
          'CAMERA',
          'LENS',
          'AUDIO',
          'LIGHTING',
          'DRONE',
          'ACCESSORY',
          'SOFTWARE_LICENSE',
          'OTHER',
        ],
      },
      { key: 'serialNumber', label: 'Serial number', kind: 'text', formOnly: true },
      { key: 'purchaseDate', label: 'Purchased', kind: 'date', formOnly: true },
      { key: 'purchaseCost', label: 'Cost', kind: 'number', formOnly: true },
      { key: 'warrantyEnd', label: 'Warranty until', kind: 'date', formOnly: true },
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: ['AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED', 'LOST'],
      },
    ],
  },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MastersTab() {
  const [specKey, setSpecKey] = useState(SPECS[0]?.key ?? 'departments');
  const spec = SPECS.find((entry) => entry.key === specKey) as MasterSpec;

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <SegmentedControl
          value={specKey}
          onChange={setSpecKey}
          options={SPECS.map((entry) => ({ value: entry.key, label: entry.label }))}
        />
      </div>
      <MasterTable spec={spec} />
    </div>
  );
}

function MasterTable({ spec }: { spec: MasterSpec }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MasterRecord | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MasterRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['masters', spec.key],
    queryFn: () => apiGet<MasterRecord[]>(spec.endpoint, { pageSize: 200 }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`${spec.endpoint}/${id}`),
    onSuccess: () => {
      toast.success(`${spec.label.replace(/s$/, '')} deleted`);
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ['masters', spec.key] });
      void queryClient.invalidateQueries({ queryKey: ['options'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const columns = spec.fields.filter((field) => !field.formOnly);

  const render = (record: MasterRecord, field: FieldSpec) => {
    const value = record[field.key];
    if (value === null || value === undefined || value === '') return '—';
    if (field.kind === 'boolean') {
      return value ? (
        <Badge tone="success">Yes</Badge>
      ) : (
        <Badge tone="neutral">No</Badge>
      );
    }
    if (field.kind === 'date') return fmtDate(String(value));
    if (field.kind === 'days') {
      const days = value as number[];
      return days.map((day) => DAY_LABELS[day]).join(', ');
    }
    if (field.key === 'purchaseCost') return fmtCurrency(Number(value));
    if (field.kind === 'select') return humanise(String(value));
    return String(value);
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <>
      <Card>
        <CardHeader
          title={spec.label}
          description={spec.description}
          action={
            <Button
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setEditing('new')}
            >
              Add
            </Button>
          }
        />
        {data?.length === 0 ? (
          <EmptyState compact title={`No ${spec.label.toLowerCase()} yet`} />
        ) : (
          <Table>
            <THead>
              <tr>
                {columns.map((field) => (
                  <TH key={field.key}>{field.label}</TH>
                ))}
                <TH>In use</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {data?.map((record) => {
                const counts = record._count as Record<string, number> | undefined;
                const inUse = counts
                  ? Object.entries(counts)
                      .filter(([, count]) => count > 0)
                      .map(([key, count]) => `${count} ${key}`)
                      .join(', ')
                  : '';
                return (
                  <TRow key={record.id}>
                    {columns.map((field) => (
                      <TD key={field.key}>{render(record, field)}</TD>
                    ))}
                    <TD className="text-2xs text-muted">{inUse || '—'}</TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Edit"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => setEditing(record)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Delete"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => setDeleting(record)}
                        />
                      </div>
                    </TD>
                  </TRow>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {editing && (
        <MasterForm
          spec={spec}
          record={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="Delete this record?"
        message="If anything still references it, the API will refuse rather than break that link."
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </>
  );
}

function MasterForm({
  spec,
  record,
  onClose,
}: {
  spec: MasterSpec;
  record: MasterRecord | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of spec.fields) {
      const existing = record?.[field.key];
      if (field.kind === 'boolean') initial[field.key] = existing ?? true;
      else if (field.kind === 'days') initial[field.key] = existing ?? [1, 2, 3, 4, 5, 6];
      else if (field.kind === 'date') {
        initial[field.key] = existing ? String(existing).slice(0, 10) : '';
      } else initial[field.key] = existing ?? (field.kind === 'number' ? 0 : '');
    }
    return initial;
  });

  const save = useMutation({
    mutationFn: () => {
      // Empty optional strings are sent as undefined, not '', so the API's
      // nullable validators accept them.
      const payload: Record<string, unknown> = {};
      for (const field of spec.fields) {
        const value = values[field.key];
        if (value === '' && !field.required) continue;
        payload[field.key] = field.kind === 'number' ? Number(value) : value;
      }
      return record
        ? apiPatch(`${spec.endpoint}/${record.id}`, payload)
        : apiPost(spec.endpoint, payload);
    },
    onSuccess: () => {
      toast.success(record ? 'Saved' : 'Added');
      void queryClient.invalidateQueries({ queryKey: ['masters', spec.key] });
      void queryClient.invalidateQueries({ queryKey: ['options'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const set = (key: string, value: unknown) =>
    setValues((current) => ({ ...current, [key]: value }));

  const ready = spec.fields
    .filter((field) => field.required)
    .every((field) => {
      const value = values[field.key];
      return Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0;
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${record ? 'Edit' : 'Add'} ${spec.label.replace(/s$/, '').toLowerCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!ready} onClick={() => save.mutate()}>
            {record ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {spec.fields.map((field) => {
          if (field.kind === 'boolean') {
            return (
              <Checkbox
                key={field.key}
                checked={Boolean(values[field.key])}
                onChange={(event) => set(field.key, event.target.checked)}
                label={field.label}
                description={field.hint}
              />
            );
          }
          if (field.kind === 'select') {
            return (
              <Select
                key={field.key}
                label={field.label}
                required={field.required}
                value={String(values[field.key] ?? '')}
                onChange={(event) => set(field.key, event.target.value)}
                placeholder="Select"
                options={(field.options ?? []).map((option) => ({
                  value: option,
                  label: humanise(option),
                }))}
              />
            );
          }
          if (field.kind === 'days') {
            const selected = (values[field.key] as number[]) ?? [];
            return (
              <div key={field.key}>
                <span className="dd-label">{field.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, day) => {
                    const on = selected.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          set(
                            field.key,
                            on
                              ? selected.filter((entry) => entry !== day)
                              : [...selected, day].sort(),
                          )
                        }
                        className={
                          on
                            ? 'rounded-lg border border-primary bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary'
                            : 'rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-border-strong'
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
          return (
            <Input
              key={field.key}
              label={field.label}
              required={field.required}
              hint={field.hint}
              type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
              value={String(values[field.key] ?? '')}
              onChange={(event) => set(field.key, event.target.value)}
            />
          );
        })}
      </div>
    </Modal>
  );
}
