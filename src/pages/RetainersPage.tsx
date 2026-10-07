import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, fmtCurrency, fmtDate, humanise } from '@/lib/utils';
import type {
  EmployeeListItem,
  MasterRecord,
  RetainerListItem,
  Workflow,
} from '@/types/api';
import {
  Badge,
  Button,
  Checkbox,
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
import { CycleStatusBadge, RetainerStatusBadge } from '@/components/domain';
import { FilterBar, FilterSelect, TableCard } from '@/components/ListShell';

const STATUSES = ['ACTIVE', 'PAUSED', 'ENDED'] as const;
const CYCLES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'] as const;

export function RetainersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);

  const list = useListState(
    {
      status: 'ACTIVE' as string | undefined,
      clientId: undefined,
      renewalWithinDays: undefined,
    },
    25,
  );

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<RetainerListItem>(
    ['retainers'],
    '/retainers',
    list.queryParams,
  );

  const clients = useQuery({
    queryKey: ['options', 'clients'],
    queryFn: () => apiGet<{ id: string; name: string }[]>('/clients/options/all'),
    staleTime: 300_000,
  });

  return (
    <div>
      <PageHeader
        title="Retainers"
        description="Recurring work: social media, maintenance and influencer management. Each billing period becomes its own cycle with its own board."
        actions={
          can('retainers.create') ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New retainer
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        placeholder="Search by name, code or client…"
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
          value={list.filters.clientId}
          onChange={(value) => list.setFilter('clientId', value)}
          options={(clients.data ?? []).map((client) => ({
            value: client.id,
            label: client.name,
          }))}
          allLabel="All clients"
        />
        <Button
          size="sm"
          variant={list.filters.renewalWithinDays ? 'subtle' : 'secondary'}
          onClick={() =>
            list.setFilter('renewalWithinDays', list.filters.renewalWithinDays ? undefined : '60')
          }
        >
          Renewing soon
        </Button>
      </FilterBar>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <TableCard meta={data?.meta} onPageChange={list.setPage}>
          <Table className={cn(isFetching && 'opacity-60')}>
            <THead>
              <tr>
                <TH>Retainer</TH>
                <TH>Client</TH>
                <TH>Cycle</TH>
                <TH>Current period</TH>
                <TH>Status</TH>
                <TH className="text-right">Value</TH>
                <TH>Ends</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <SkeletonRows rows={6} cols={7} />
              ) : data?.data.length === 0 ? (
                <tr>
                  <TD colSpan={7}>
                    <EmptyState
                      icon={<Repeat className="h-5 w-5" />}
                      title="No retainers"
                      description="Set one up for monthly social media or maintenance work."
                      action={
                        can('retainers.create') ? (
                          <Button size="sm" onClick={() => setCreating(true)}>
                            New retainer
                          </Button>
                        ) : undefined
                      }
                    />
                  </TD>
                </tr>
              ) : (
                data?.data.map((retainer) => {
                  const current = retainer.cycles[0];
                  return (
                    <TRow key={retainer.id} onClick={() => navigate(`/retainers/${retainer.id}`)}>
                      <TD>
                        <p className="truncate font-medium text-fg">{retainer.name}</p>
                        <p className="font-mono text-2xs text-subtle">{retainer.code}</p>
                      </TD>
                      <TD className="text-muted">{retainer.client.name}</TD>
                      <TD>
                        <Badge tone="neutral">{humanise(retainer.billingCycle)}</Badge>
                      </TD>
                      <TD>
                        {current ? (
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-fg">{current.label}</span>
                            <CycleStatusBadge value={current.status} />
                          </span>
                        ) : (
                          <span className="text-xs text-subtle">No cycle open</span>
                        )}
                      </TD>
                      <TD>
                        <RetainerStatusBadge value={retainer.status} />
                      </TD>
                      <TD className="text-right tabular-nums">
                        {retainer.amountPerCycle
                          ? fmtCurrency(retainer.amountPerCycle)
                          : '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-muted">
                        {retainer.endDate ? fmtDate(retainer.endDate, 'dd MMM yy') : 'Open-ended'}
                      </TD>
                    </TRow>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableCard>
      )}

      {creating && <CreateRetainerModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateRetainerModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    clientId: '',
    serviceLineId: '',
    workflowId: '',
    managerId: '',
    billingCycle: 'MONTHLY',
    amountPerCycle: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    cycleStartDay: '1',
    autoGenerateCycles: true,
    openFirstCycle: true,
    scopeNotes: '',
  });

  const clients = useQuery({
    queryKey: ['options', 'clients'],
    queryFn: () => apiGet<{ id: string; name: string }[]>('/clients/options/all'),
  });
  const serviceLines = useQuery({
    queryKey: ['options', 'service-lines'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/service-lines'),
  });
  const workflows = useQuery({
    queryKey: ['workflows'],
    queryFn: () => apiGet<Workflow[]>('/workflows'),
  });
  const managers = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>('/retainers', {
        name: form.name,
        clientId: form.clientId,
        serviceLineId: form.serviceLineId || null,
        workflowId: form.workflowId,
        managerId: form.managerId || null,
        billingCycle: form.billingCycle,
        amountPerCycle: form.amountPerCycle ? Number(form.amountPerCycle) : null,
        startDate: form.startDate,
        endDate: form.endDate || null,
        cycleStartDay: Number(form.cycleStartDay),
        autoGenerateCycles: form.autoGenerateCycles,
        openFirstCycle: form.openFirstCycle,
        scopeNotes: form.scopeNotes || undefined,
      }),
    onSuccess: (retainer) => {
      toast.success('Retainer created');
      void queryClient.invalidateQueries({ queryKey: ['retainers'] });
      onClose();
      navigate(`/retainers/${retainer.id}`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const ready = form.name.length >= 2 && form.clientId && form.workflowId && form.startDate;

  return (
    <Modal
      open
      onClose={onClose}
      title="New retainer"
      description="Each billing period opens as a cycle with its own tasks and deliverables."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={!ready} onClick={() => create.mutate()}>
            Create retainer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Retainer name"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="e.g. TinyLittleToes social media retainer"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Client"
            required
            value={form.clientId}
            onChange={(event) => setForm({ ...form, clientId: event.target.value })}
            placeholder="Select a client"
            options={(clients.data ?? []).map((client) => ({
              value: client.id,
              label: client.name,
            }))}
          />
          <Select
            label="Service line"
            value={form.serviceLineId}
            onChange={(event) => setForm({ ...form, serviceLineId: event.target.value })}
            placeholder="Select a service"
            options={(serviceLines.data ?? []).map((line) => ({
              value: line.id,
              label: String(line.name),
            }))}
          />
        </div>

        <Select
          label="Workflow"
          required
          value={form.workflowId}
          onChange={(event) => setForm({ ...form, workflowId: event.target.value })}
          placeholder="Select a workflow"
          hint="Every cycle runs through these stages."
          options={(workflows.data ?? []).map((workflow) => ({
            value: workflow.id,
            label: `${workflow.name} (${workflow.stages.length} stages)`,
          }))}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Billing cycle"
            value={form.billingCycle}
            onChange={(event) => setForm({ ...form, billingCycle: event.target.value })}
            options={CYCLES.map((value) => ({ value, label: humanise(value) }))}
          />
          <Input
            label="Amount per cycle"
            type="number"
            min={0}
            value={form.amountPerCycle}
            onChange={(event) => setForm({ ...form, amountPerCycle: event.target.value })}
            prefix="₹"
          />
          <Select
            label="Manager"
            value={form.managerId}
            onChange={(event) => setForm({ ...form, managerId: event.target.value })}
            placeholder="Unassigned"
            options={(managers.data ?? []).map((employee) => ({
              value: employee.id,
              label: employee.user.name,
            }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Start date"
            type="date"
            required
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
          />
          <Input
            label="End date"
            type="date"
            value={form.endDate}
            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            hint="Leave blank for open-ended"
          />
          <Input
            label="Cycle starts on day"
            type="number"
            min={1}
            max={28}
            value={form.cycleStartDay}
            onChange={(event) => setForm({ ...form, cycleStartDay: event.target.value })}
          />
        </div>

        <Textarea
          label="Scope"
          rows={3}
          value={form.scopeNotes}
          onChange={(event) => setForm({ ...form, scopeNotes: event.target.value })}
          placeholder="e.g. 16 static posts, 8 reels, community management, monthly report."
        />

        <div className="space-y-2 rounded-lg border border-border bg-surface-2/40 p-3">
          <Checkbox
            checked={form.autoGenerateCycles}
            onChange={(event) => setForm({ ...form, autoGenerateCycles: event.target.checked })}
            label="Open each new cycle automatically"
            description="A nightly job opens the next period once the current one ends."
          />
          <Checkbox
            checked={form.openFirstCycle}
            onChange={(event) => setForm({ ...form, openFirstCycle: event.target.checked })}
            label="Open the first cycle now"
            description="Creates the period and seeds its first stage of tasks."
          />
        </div>
      </div>
    </Modal>
  );
}
