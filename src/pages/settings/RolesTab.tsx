import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PermissionGroup, PermissionKey, Role } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Input,
  LoadingBlock,
  Modal,
  Textarea,
} from '@/components/ui';

/**
 * The permission matrix. The catalogue comes from the API's registry, so a
 * permission that no longer exists simply stops being offered - the UI cannot
 * invent one, and the API ignores anything it does not recognise.
 */
export function RolesTab() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<PermissionKey>>(new Set());
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const roles = useQuery({ queryKey: ['roles'], queryFn: () => apiGet<Role[]>('/roles') });
  const catalogue = useQuery({
    queryKey: ['permissions'],
    queryFn: () => apiGet<{ groups: PermissionGroup[] }>('/roles/permissions'),
    staleTime: Infinity,
  });

  const selected = roles.data?.find((role) => role.id === selectedId) ?? roles.data?.[0] ?? null;

  // Reset the draft whenever a different role is opened.
  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
  }, [selected?.id, selected?.permissions.length, selected]);

  const save = useMutation({
    mutationFn: () =>
      apiPatch(`/roles/${selected?.id}`, { permissions: [...draft] }),
    onSuccess: () => {
      toast.success('Permissions saved');
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/roles/${id}`),
    onSuccess: () => {
      toast.success('Role deleted');
      setDeleting(null);
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const dirty = useMemo(() => {
    if (!selected) return false;
    if (selected.permissions.length !== draft.size) return true;
    return selected.permissions.some((permission) => !draft.has(permission));
  }, [selected, draft]);

  if (roles.isLoading || catalogue.isLoading) return <LoadingBlock />;

  const toggle = (key: PermissionKey) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleGroup = (group: PermissionGroup) => {
    const keys = group.permissions.map((permission) => permission.key);
    const allOn = keys.every((key) => draft.has(key));
    setDraft((current) => {
      const next = new Set(current);
      keys.forEach((key) => (allOn ? next.delete(key) : next.add(key)));
      return next;
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <Card className="h-fit">
        <CardHeader
          title="Roles"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setCreating(true)}
            >
              New
            </Button>
          }
        />
        <ul className="divide-y divide-border">
          {roles.data?.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                onClick={() => setSelectedId(role.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-5 py-3 text-left transition-colors',
                  selected?.id === role.id ? 'bg-primary-soft' : 'hover:bg-surface-2',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-medium',
                      selected?.id === role.id ? 'text-primary' : 'text-fg',
                    )}
                  >
                    {role.name}
                  </p>
                  <p className="truncate text-2xs text-muted">
                    {role._count?.users ?? 0} user{(role._count?.users ?? 0) === 1 ? '' : 's'}
                    {role.isAdmin ? ' · full access' : ` · ${role.permissions.length} permissions`}
                  </p>
                </div>
                {role.isAdmin && <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {selected && (
        <Card>
          <CardHeader
            title={selected.name}
            description={selected.description ?? undefined}
            action={
              <div className="flex items-center gap-2">
                {!selected.isSystem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setDeleting(selected)}
                  >
                    Delete
                  </Button>
                )}
                {!selected.isAdmin && (
                  <Button
                    size="sm"
                    loading={save.isPending}
                    disabled={!dirty}
                    onClick={() => save.mutate()}
                  >
                    {dirty ? 'Save changes' : 'Saved'}
                  </Button>
                )}
              </div>
            }
          />

          {selected.isAdmin ? (
            <div className="px-5 py-6">
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="text-sm text-primary">
                  <p className="font-medium">This role always holds every permission</p>
                  <p className="mt-0.5 text-xs">
                    It cannot be edited or stripped, so the organisation can never lock itself out
                    of Settings. Assign a narrower role to limit what someone can do.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {catalogue.data?.groups.map((group) => {
                const keys = group.permissions.map((permission) => permission.key);
                const onCount = keys.filter((key) => draft.has(key)).length;
                return (
                  <section key={group.module} className="px-5 py-4">
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-fg">{group.label}</h3>
                        <Badge tone={onCount ? 'primary' : 'neutral'}>
                          {onCount}/{keys.length}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="flex items-center gap-1 text-2xs font-medium text-primary hover:underline"
                      >
                        {onCount === keys.length ? (
                          <>
                            <Minus className="h-3 w-3" />
                            Clear all
                          </>
                        ) : (
                          <>
                            <Check className="h-3 w-3" />
                            Select all
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const on = draft.has(permission.key);
                        return (
                          <label
                            key={permission.key}
                            className={cn(
                              'flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
                              on
                                ? 'border-primary/40 bg-primary-soft/50'
                                : 'border-border hover:bg-surface-2',
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-border-strong accent-primary"
                              checked={on}
                              onChange={() => toggle(permission.key)}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm text-fg">{permission.label}</span>
                              <code className="block truncate text-2xs text-subtle">
                                {permission.key}
                              </code>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {creating && <CreateRoleModal onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="Delete this role?"
        message={`"${deleting?.name}" will be removed. Users still holding it must be reassigned first.`}
        confirmLabel="Delete role"
        loading={remove.isPending}
      />
    </div>
  );
}

function CreateRoleModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '' });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/roles', {
        name: form.name,
        description: form.description || undefined,
        permissions: [],
      }),
    onSuccess: () => {
      toast.success('Role created — now pick its permissions');
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New role"
      description="Starts with nothing granted, so you can build it up deliberately."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.name.trim().length < 2}
            onClick={() => create.mutate()}
          >
            Create role
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Role name"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="e.g. Content Reviewer"
        />
        <Textarea
          label="What is this role for?"
          rows={2}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </div>
    </Modal>
  );
}
