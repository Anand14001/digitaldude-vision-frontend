import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  LayoutGrid,
  List,
  Phone,
  Plus,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, fmtCompactCurrency, fmtDate, fmtRelative, humanise, isOverdue } from '@/lib/utils';
import type { EmployeeListItem, Lead, LeadPipeline, MasterRecord } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FieldGrid,
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
import { LeadStatusBadge } from '@/components/domain';
import { FilterBar, FilterSelect, TableCard, ViewToggle } from '@/components/ListShell';

const STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;

const SOURCES = [
  'REFERRAL',
  'INSTAGRAM',
  'FACEBOOK',
  'GOOGLE',
  'LINKEDIN',
  'WALK_IN',
  'COLD_OUTREACH',
  'WEBSITE',
  'EXISTING_CLIENT',
  'OTHER',
] as const;

export function LeadsPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [creating, setCreating] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(id ?? null);

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Enquiries from referrals, Instagram, walk-ins and the website."
        actions={
          <>
            <ViewToggle
              view={view}
              onChange={(value) => setView(value as 'pipeline' | 'list')}
              views={[
                {
                  value: 'pipeline',
                  label: 'Pipeline',
                  icon: <LayoutGrid className="h-3.5 w-3.5" />,
                },
                { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" /> },
              ]}
            />
            {can('leads.create') && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                New lead
              </Button>
            )}
          </>
        }
      />

      {view === 'pipeline' ? (
        <PipelineView onOpen={setOpenLeadId} />
      ) : (
        <LeadListView onOpen={setOpenLeadId} />
      )}

      {creating && <CreateLeadModal onClose={() => setCreating(false)} />}
      {openLeadId && (
        <LeadDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />
      )}
    </div>
  );
}

function PipelineView({ onOpen }: { onOpen: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [dragging, setDragging] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leads', 'pipeline'],
    queryFn: () => apiGet<LeadPipeline>('/leads/pipeline'),
  });

  const moveStage = useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: string }) =>
      apiPatch(`/leads/${leadId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) {
    return (
      <div className="dd-board">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="dd-skeleton h-72 w-64 shrink-0" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <div className="dd-board">
      {data?.columns.map((column) => (
        <section
          key={column.status}
          onDragOver={(event) => {
            if (!dragging) return;
            event.preventDefault();
            setOverColumn(column.status);
          }}
          onDragLeave={() => setOverColumn(null)}
          onDrop={() => {
            setOverColumn(null);
            if (dragging) moveStage.mutate({ leadId: dragging, status: column.status });
            setDragging(null);
          }}
          className="flex w-64 shrink-0 flex-col"
        >
          <header className="mb-2 flex items-center gap-2 px-1">
            <h3 className="text-sm font-semibold text-fg">{humanise(column.status)}</h3>
            <span className="text-xs text-muted">{column.count}</span>
            {column.value && (
              <span className="ml-auto text-2xs font-medium text-success">
                {fmtCompactCurrency(column.value)}
              </span>
            )}
          </header>
          <div
            className={cn(
              'flex-1 space-y-2 rounded-xl p-2 transition-colors',
              overColumn === column.status
                ? 'bg-primary-soft ring-2 ring-primary/40'
                : 'bg-surface-2/50',
            )}
          >
            {column.leads.length === 0 ? (
              <p className="py-6 text-center text-xs text-subtle">
                {overColumn === column.status ? 'Drop here' : 'Empty'}
              </p>
            ) : (
              column.leads.map((lead) => (
                <article
                  key={lead.id}
                  draggable={can('leads.update')}
                  onDragStart={() => setDragging(lead.id)}
                  onDragEnd={() => {
                    setDragging(null);
                    setOverColumn(null);
                  }}
                  onClick={() => onOpen(lead.id)}
                  className={cn(
                    'dd-card cursor-pointer p-3 transition-all hover:shadow-pop',
                    dragging === lead.id && 'opacity-40',
                  )}
                >
                  <p className="text-sm font-medium leading-snug text-fg">{lead.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {lead.companyName ?? lead.contactName}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    {lead.estimatedValue ? (
                      <span className="text-xs font-semibold tabular-nums text-fg">
                        {fmtCompactCurrency(lead.estimatedValue)}
                      </span>
                    ) : (
                      <span className="text-2xs text-subtle">No value</span>
                    )}
                    <Badge tone="neutral">{humanise(lead.source)}</Badge>
                  </div>
                  {lead.nextFollowUpAt && (
                    <p
                      className={cn(
                        'mt-2 flex items-center gap-1 text-2xs',
                        isOverdue(lead.nextFollowUpAt) ? 'font-medium text-danger' : 'text-muted',
                      )}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {fmtDate(lead.nextFollowUpAt, 'dd MMM')}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function LeadListView({ onOpen }: { onOpen: (id: string) => void }) {
  const list = useListState(
    {
      status: undefined,
      source: undefined,
      ownerId: undefined,
      overdueFollowUp: undefined,
    },
    25,
  );

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<Lead>(
    ['leads', 'list'],
    '/leads',
    list.queryParams,
  );

  const owners = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
    staleTime: 300_000,
  });

  return (
    <>
      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        placeholder="Search title, company or phone…"
        activeCount={list.activeFilterCount}
        onReset={list.resetFilters}
      >
        <FilterSelect
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value)}
          options={STATUSES}
          allLabel="All stages"
        />
        <FilterSelect
          value={list.filters.source}
          onChange={(value) => list.setFilter('source', value)}
          options={SOURCES}
          allLabel="All sources"
        />
        <FilterSelect
          value={list.filters.ownerId}
          onChange={(value) => list.setFilter('ownerId', value)}
          options={(owners.data ?? []).map((employee) => ({
            value: employee.id,
            label: employee.user.name,
          }))}
          allLabel="All owners"
        />
        <Button
          size="sm"
          variant={list.filters.overdueFollowUp ? 'subtle' : 'secondary'}
          onClick={() =>
            list.setFilter('overdueFollowUp', list.filters.overdueFollowUp ? undefined : 'true')
          }
        >
          Follow-up due
        </Button>
      </FilterBar>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <TableCard meta={data?.meta} onPageChange={list.setPage}>
          <Table className={cn(isFetching && 'opacity-60')}>
            <THead>
              <tr>
                <TH>Lead</TH>
                <TH>Source</TH>
                <TH>Stage</TH>
                <TH>Owner</TH>
                <TH className="text-right">Value</TH>
                <TH>Follow-up</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <SkeletonRows rows={8} cols={6} />
              ) : data?.data.length === 0 ? (
                <tr>
                  <TD colSpan={6}>
                    <EmptyState
                      icon={<TrendingUp className="h-5 w-5" />}
                      title="No leads match"
                    />
                  </TD>
                </tr>
              ) : (
                data?.data.map((lead) => (
                  <TRow key={lead.id} onClick={() => onOpen(lead.id)}>
                    <TD>
                      <p className="truncate font-medium text-fg">{lead.title}</p>
                      <p className="truncate text-2xs text-muted">
                        {lead.companyName ?? lead.contactName}
                        {lead.phone ? ` · ${lead.phone}` : ''}
                      </p>
                    </TD>
                    <TD>
                      <Badge tone="neutral">{humanise(lead.source)}</Badge>
                    </TD>
                    <TD>
                      <LeadStatusBadge value={lead.status} />
                    </TD>
                    <TD className="text-xs text-muted">{lead.owner?.user.name ?? '—'}</TD>
                    <TD className="text-right tabular-nums">
                      {lead.estimatedValue ? fmtCompactCurrency(lead.estimatedValue) : '—'}
                    </TD>
                    <TD
                      className={cn(
                        'whitespace-nowrap text-xs',
                        isOverdue(lead.nextFollowUpAt) && 'font-medium text-danger',
                      )}
                    >
                      {lead.nextFollowUpAt ? fmtDate(lead.nextFollowUpAt, 'dd MMM') : '—'}
                    </TD>
                  </TRow>
                ))
              )}
            </TBody>
          </Table>
        </TableCard>
      )}
    </>
  );
}

/** Lead detail as a drawer, so the pipeline stays behind it. */
function LeadDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [activity, setActivity] = useState({ type: 'CALL', summary: '', nextFollowUpAt: '' });
  const [converting, setConverting] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead & { activities: { id: string; type: string; summary: string; occurredAt: string }[] }>(
      `/leads/${leadId}`,
    ),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    void queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  const setStatus = useMutation({
    mutationFn: (status: string) => apiPatch(`/leads/${leadId}`, { status }),
    onSuccess: invalidate,
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const logActivity = useMutation({
    mutationFn: () =>
      apiPost(`/leads/${leadId}/activities`, {
        type: activity.type,
        summary: activity.summary,
        nextFollowUpAt: activity.nextFollowUpAt || undefined,
      }),
    onSuccess: () => {
      setActivity({ type: 'CALL', summary: '', nextFollowUpAt: '' });
      invalidate();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={lead?.title ?? 'Lead'}
      footer={
        lead && can('leads.convert') && !lead.client ? (
          <Button
            icon={<UserCheck className="h-4 w-4" />}
            onClick={() => setConverting(true)}
          >
            Convert to client
          </Button>
        ) : undefined
      }
    >
      {isLoading || !lead ? (
        <div className="space-y-3">
          <div className="dd-skeleton h-6 w-1/2" />
          <div className="dd-skeleton h-24" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <LeadStatusBadge value={lead.status} />
            <Badge tone="neutral">{humanise(lead.source)}</Badge>
            {lead.estimatedValue && (
              <Badge tone="success">{fmtCompactCurrency(lead.estimatedValue)}</Badge>
            )}
            {lead.client && <Badge tone="primary">Converted</Badge>}
          </div>

          {can('leads.update') && !lead.client && (
            <Select
              label="Stage"
              value={lead.status}
              onChange={(event) => setStatus.mutate(event.target.value)}
              options={STATUSES.map((value) => ({ value, label: humanise(value) }))}
            />
          )}

          <FieldGrid cols={2}>
            <Field label="Contact">{lead.contactName}</Field>
            <Field label="Company">{lead.companyName}</Field>
            <Field label="Email">
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                  {lead.email}
                </a>
              ) : null}
            </Field>
            <Field label="Phone">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {lead.phone}
                </a>
              ) : null}
            </Field>
            <Field label="Owner">{lead.owner?.user.name}</Field>
            <Field label="Next follow-up">
              {lead.nextFollowUpAt ? fmtDate(lead.nextFollowUpAt) : 'Not scheduled'}
            </Field>
          </FieldGrid>

          {lead.requirement && (
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-subtle">
                Requirement
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{lead.requirement}</p>
            </div>
          )}

          {can('leads.update') && (
            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold text-fg">Log an interaction</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={activity.type}
                    onChange={(event) => setActivity({ ...activity, type: event.target.value })}
                    options={['CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'NOTE'].map((value) => ({
                      value,
                      label: humanise(value),
                    }))}
                  />
                  <Input
                    type="date"
                    value={activity.nextFollowUpAt}
                    onChange={(event) =>
                      setActivity({ ...activity, nextFollowUpAt: event.target.value })
                    }
                    placeholder="Next follow-up"
                  />
                </div>
                <Textarea
                  rows={2}
                  value={activity.summary}
                  onChange={(event) => setActivity({ ...activity, summary: event.target.value })}
                  placeholder="What was discussed?"
                />
                <Button
                  size="sm"
                  loading={logActivity.isPending}
                  disabled={activity.summary.trim().length < 2}
                  onClick={() => logActivity.mutate()}
                >
                  Save interaction
                </Button>
              </div>
            </Card>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-fg">Timeline</p>
            {lead.activities.length === 0 ? (
              <p className="text-sm text-muted">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {lead.activities.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm text-fg">{entry.summary}</p>
                    <p className="text-2xs text-subtle">
                      {humanise(entry.type)} · {fmtRelative(entry.occurredAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {converting && lead && (
        <ConvertLeadModal lead={lead} onClose={() => setConverting(false)} onDone={onClose} />
      )}
    </Drawer>
  );
}

function ConvertLeadModal({
  lead,
  onClose,
  onDone,
}: {
  lead: Lead;
  onClose: () => void;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState(lead.companyName ?? lead.contactName);
  const [serviceLineIds, setServiceLineIds] = useState<string[]>([]);

  const serviceLines = useQuery({
    queryKey: ['options', 'service-lines'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/service-lines'),
  });

  const convert = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>(`/leads/${lead.id}/convert`, { clientName, serviceLineIds }),
    onSuccess: (client) => {
      toast.success('Lead converted');
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
      onDone();
      navigate(`/clients/${client.id}`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Convert to client"
      description="The lead is kept and linked, so the pipeline history survives."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={convert.isPending}
            disabled={clientName.trim().length < 2}
            onClick={() => convert.mutate()}
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
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
        />
        <div>
          <span className="dd-label">Services</span>
          <div className="flex flex-wrap gap-1.5">
            {(serviceLines.data ?? []).map((line) => {
              const selected = serviceLineIds.includes(line.id);
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() =>
                    setServiceLineIds((current) =>
                      selected ? current.filter((id) => id !== line.id) : [...current, line.id],
                    )
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-muted',
                  )}
                >
                  {String(line.name)}
                </button>
              );
            })}
          </div>
        </div>
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          {lead.contactName} will be added as the primary contact.
        </p>
      </div>
    </Modal>
  );
}

function CreateLeadModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    contactName: '',
    companyName: '',
    email: '',
    phone: '',
    source: 'INSTAGRAM',
    status: 'NEW',
    estimatedValue: '',
    requirement: '',
    nextFollowUpAt: '',
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/leads', {
        ...form,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        nextFollowUpAt: form.nextFollowUpAt || null,
        email: form.email || '',
      }),
    onSuccess: () => {
      toast.success('Lead added');
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New lead"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.title.length < 2 || form.contactName.length < 2}
            onClick={() => create.mutate()}
          >
            Add lead
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="What do they want?"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="e.g. Website revamp enquiry"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Contact name"
            required
            value={form.contactName}
            onChange={(event) => setForm({ ...form, contactName: event.target.value })}
          />
          <Input
            label="Company"
            value={form.companyName}
            onChange={(event) => setForm({ ...form, companyName: event.target.value })}
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
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Source"
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
            options={SOURCES.map((value) => ({ value, label: humanise(value) }))}
          />
          <Input
            label="Estimated value"
            type="number"
            min={0}
            value={form.estimatedValue}
            onChange={(event) => setForm({ ...form, estimatedValue: event.target.value })}
            prefix="₹"
          />
          <Input
            label="Follow up on"
            type="date"
            value={form.nextFollowUpAt}
            onChange={(event) => setForm({ ...form, nextFollowUpAt: event.target.value })}
          />
        </div>
        <Textarea
          label="Requirement"
          rows={3}
          value={form.requirement}
          onChange={(event) => setForm({ ...form, requirement: event.target.value })}
          placeholder="What they asked for, budget hints, timelines."
        />
      </div>
    </Modal>
  );
}
