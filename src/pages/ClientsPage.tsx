import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Building2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, fmtDate } from '@/lib/utils';
import type { ClientListItem, EmployeeListItem, MasterRecord } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonRows,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  Table,
  Textarea,
} from '@/components/ui';
import { ClientStatusBadge } from '@/components/domain';
import { FilterBar, FilterSelect, TableCard } from '@/components/ListShell';

const STATUSES = ['PROSPECT', 'ACTIVE', 'PAUSED', 'CHURNED'] as const;

export function ClientsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);

  const list = useListState(
    {
      status: undefined,
      serviceLineId: undefined,
      accountManagerId: undefined,
    },
    25,
  );

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<ClientListItem>(
    ['clients'],
    '/clients',
    list.queryParams,
  );

  const serviceLines = useQuery({
    queryKey: ['options', 'service-lines'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/service-lines'),
    staleTime: 300_000,
  });

  const managers = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
    staleTime: 300_000,
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Accounts, their contacts and everything running for them."
        actions={
          can('clients.create') ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New client
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        placeholder="Search name, email or city…"
        activeCount={list.activeFilterCount}
        onReset={list.resetFilters}
      >
        <FilterSelect
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value)}
          options={STATUSES}
          allLabel="All statuses"
        />
        <FilterSelect
          value={list.filters.serviceLineId}
          onChange={(value) => list.setFilter('serviceLineId', value)}
          options={(serviceLines.data ?? []).map((line) => ({
            value: line.id,
            label: String(line.name),
          }))}
          allLabel="All services"
        />
        <FilterSelect
          value={list.filters.accountManagerId}
          onChange={(value) => list.setFilter('accountManagerId', value)}
          options={(managers.data ?? []).map((employee) => ({
            value: employee.id,
            label: employee.user.name,
          }))}
          allLabel="All managers"
        />
      </FilterBar>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <TableCard meta={data?.meta} onPageChange={list.setPage}>
          <Table className={cn(isFetching && 'opacity-60')}>
            <THead>
              <tr>
                <TH>Client</TH>
                <TH>Services</TH>
                <TH>Status</TH>
                <TH>Account manager</TH>
                <TH className="text-right">Projects</TH>
                <TH className="text-right">Retainers</TH>
                <TH>Since</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <SkeletonRows rows={8} cols={7} />
              ) : data?.data.length === 0 ? (
                <tr>
                  <TD colSpan={7}>
                    <EmptyState
                      icon={<Briefcase className="h-5 w-5" />}
                      title="No clients yet"
                      description="Add your first client, or convert a won lead."
                      action={
                        can('clients.create') ? (
                          <Button size="sm" onClick={() => setCreating(true)}>
                            New client
                          </Button>
                        ) : undefined
                      }
                    />
                  </TD>
                </tr>
              ) : (
                data?.data.map((client) => (
                  <TRow key={client.id} onClick={() => navigate(`/clients/${client.id}`)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        {client.logo ? (
                          <img
                            src={client.logo.url}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-border"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                            <Building2 className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{client.name}</p>
                          <p className="truncate text-2xs text-muted">
                            {[client.industry, client.city].filter(Boolean).join(' · ') ||
                              'No industry set'}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {client.serviceLines.slice(0, 2).map((entry) => (
                          <Badge key={entry.serviceLine.id} tone="neutral">
                            {entry.serviceLine.name}
                          </Badge>
                        ))}
                        {client.serviceLines.length > 2 && (
                          <Badge tone="neutral">+{client.serviceLines.length - 2}</Badge>
                        )}
                      </div>
                    </TD>
                    <TD>
                      <ClientStatusBadge value={client.status} />
                    </TD>
                    <TD>
                      {client.accountManager ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={client.accountManager.user.name} size="xs" />
                          <span className="truncate text-xs text-muted">
                            {client.accountManager.user.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-subtle">Unassigned</span>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">{client._count.projects}</TD>
                    <TD className="text-right tabular-nums">{client._count.retainers}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted">
                      {fmtDate(client.createdAt, 'MMM yyyy')}
                    </TD>
                  </TRow>
                ))
              )}
            </TBody>
          </Table>
        </TableCard>
      )}

      {creating && <CreateClientModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    industry: '',
    status: 'ACTIVE',
    email: '',
    phone: '',
    website: '',
    gstin: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    accountManagerId: '',
    notes: '',
    serviceLineIds: [] as string[],
    contactName: '',
    contactEmail: '',
  });

  const serviceLines = useQuery({
    queryKey: ['options', 'service-lines'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/service-lines'),
  });
  const managers = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
  });

  const create = useMutation({
    mutationFn: async () => {
      const client = await apiPost<{ id: string }>('/clients', {
        name: form.name,
        industry: form.industry || undefined,
        status: form.status,
        email: form.email || '',
        phone: form.phone || undefined,
        website: form.website || '',
        gstin: form.gstin || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        accountManagerId: form.accountManagerId || null,
        notes: form.notes || undefined,
        serviceLineIds: form.serviceLineIds,
        onboardedAt: new Date().toISOString(),
      });

      // A client without a contact is not much use, so create one up front.
      if (form.contactName && form.contactEmail) {
        await apiPost(`/clients/${client.id}/contacts`, {
          name: form.contactName,
          email: form.contactEmail,
          isPrimary: true,
        });
      }
      return client;
    },
    onSuccess: (client) => {
      toast.success('Client created');
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
      navigate(`/clients/${client.id}`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New client"
      size="lg"
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
            Create client
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Client name"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="e.g. TinyLittleToes"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Industry"
            value={form.industry}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
            placeholder="e.g. Kids Retail"
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            options={STATUSES.map((value) => ({
              value,
              label: value.charAt(0) + value.slice(1).toLowerCase(),
            }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="+91"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Website"
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
            placeholder="https://"
          />
          <Input
            label="GSTIN"
            value={form.gstin}
            onChange={(event) => setForm({ ...form, gstin: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="City"
            value={form.city}
            onChange={(event) => setForm({ ...form, city: event.target.value })}
          />
          <Select
            label="Account manager"
            value={form.accountManagerId}
            onChange={(event) => setForm({ ...form, accountManagerId: event.target.value })}
            placeholder="Unassigned"
            options={(managers.data ?? []).map((employee) => ({
              value: employee.id,
              label: employee.user.name,
            }))}
          />
        </div>

        <div>
          <span className="dd-label">Services they buy</span>
          <div className="flex flex-wrap gap-1.5">
            {(serviceLines.data ?? []).map((line) => {
              const selected = form.serviceLineIds.includes(line.id);
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      serviceLineIds: selected
                        ? form.serviceLineIds.filter((id) => id !== line.id)
                        : [...form.serviceLineIds, line.id],
                    })
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-muted hover:border-border-strong',
                  )}
                >
                  {String(line.name)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <p className="mb-3 text-xs font-medium text-fg">Primary contact (optional)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Name"
              value={form.contactName}
              onChange={(event) => setForm({ ...form, contactName: event.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={form.contactEmail}
              onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
            />
          </div>
          <p className="dd-hint">
            Portal access is granted separately, from the client’s page.
          </p>
        </div>

        <Textarea
          label="Notes"
          rows={2}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </div>
    </Modal>
  );
}
