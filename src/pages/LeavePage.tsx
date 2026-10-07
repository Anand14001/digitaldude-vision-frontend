import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import { Check, Palmtree, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiList, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate } from '@/lib/utils';
import type { LeaveBalance, LeaveRequest, LeaveType } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
} from '@/components/ui';
import { LeaveStatusBadge } from '@/components/domain';

export function LeavePage() {
  const { can } = useAuth();
  const { pathname } = useLocation();
  const linkedTab = pathname.endsWith('/my')
    ? 'mine'
    : pathname.includes('/leave/requests/')
      ? 'approvals'
      : null;
  const [tab, setTab] = useState(
    linkedTab ?? (can('leave.request.own') ? 'mine' : 'approvals'),
  );
  const [requesting, setRequesting] = useState(false);

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Balances, requests and approvals."
        actions={
          can('leave.request.own') ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setRequesting(true)}>
              Request leave
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          {can('leave.request.own') && <Tab value="mine">My leave</Tab>}
          {can('leave.approve') && <Tab value="approvals">Approvals</Tab>}
          {can('leave.view.all', 'leave.view.team') && <Tab value="team">Team calendar</Tab>}
        </TabList>

        <TabPanel value="mine">
          <MyLeave onRequest={() => setRequesting(true)} />
        </TabPanel>
        <TabPanel value="approvals">
          <LeaveApprovals />
        </TabPanel>
        <TabPanel value="team">
          <TeamLeave />
        </TabPanel>
      </Tabs>

      {requesting && <RequestLeaveModal onClose={() => setRequesting(false)} />}
    </div>
  );
}

function MyLeave({ onRequest }: { onRequest: () => void }) {
  const queryClient = useQueryClient();

  const balances = useQuery({
    queryKey: ['leave', 'balances', 'my'],
    queryFn: () => apiGet<LeaveBalance[]>('/leave/balances/my'),
  });

  const requests = useQuery({
    queryKey: ['leave', 'requests', 'my'],
    queryFn: () => apiList<LeaveRequest>('/leave/requests', { pageSize: 50 }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => apiPost(`/leave/requests/${id}/cancel`),
    onSuccess: () => {
      toast.success('Request cancelled');
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (balances.isLoading || requests.isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(balances.data ?? [])
          .filter((balance) => Number(balance.entitled) > 0)
          .map((balance) => {
            const available = balance.available ?? 0;
            const entitled = Number(balance.entitled) + Number(balance.carriedOver);
            return (
              <Card key={balance.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted">{balance.leaveType.name}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">
                      {available}
                      <span className="ml-1 text-sm font-normal text-muted">
                        / {entitled}
                      </span>
                    </p>
                  </div>
                  <Badge tone="neutral">{balance.leaveType.code}</Badge>
                </div>
                <ProgressBar
                  className="mt-3"
                  value={entitled ? (Number(balance.used) / entitled) * 100 : 0}
                  tone={available <= 1 ? 'danger' : available <= 3 ? 'warning' : 'success'}
                />
                <p className="mt-1.5 text-2xs text-muted">{Number(balance.used)} days used</p>
              </Card>
            );
          })}
      </div>

      <Card>
        <CardHeader
          title="My requests"
          action={
            <Button size="sm" variant="secondary" onClick={onRequest}>
              Request leave
            </Button>
          }
        />
        {requests.data?.data.length === 0 ? (
          <EmptyState
            compact
            icon={<Palmtree className="h-5 w-5" />}
            title="No leave requested yet"
          />
        ) : (
          <ul className="divide-y divide-border">
            {requests.data?.data.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">
                    {request.leaveType.name}
                    <span className="ml-2 font-normal text-muted">
                      {Number(request.totalDays)} day
                      {Number(request.totalDays) === 1 ? '' : 's'}
                    </span>
                  </p>
                  <p className="text-2xs text-muted">
                    {fmtDate(request.startDate)} — {fmtDate(request.endDate)}
                    {request.reason ? ` · ${request.reason}` : ''}
                  </p>
                  {request.decisionNote && (
                    <p className="mt-0.5 text-2xs text-danger">{request.decisionNote}</p>
                  )}
                </div>
                <LeaveStatusBadge value={request.status} />
                {request.status === 'PENDING' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={cancel.isPending}
                    onClick={() => cancel.mutate(request.id)}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LeaveApprovals() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leave', 'requests', 'pending'],
    queryFn: () => apiList<LeaveRequest>('/leave/requests', { status: 'PENDING', pageSize: 50 }),
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      note?: string;
    }) => apiPost(`/leave/requests/${id}/decision`, { decision, note }),
    onSuccess: () => {
      toast.success('Decision recorded');
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
      void queryClient.invalidateQueries({ queryKey: ['badges'] });
      setRejecting(null);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <>
      <Card>
        <CardHeader
          title="Pending requests"
          description="Approving also fills in attendance for those days."
        />
        {data?.data.length === 0 ? (
          <EmptyState compact icon={<Check className="h-5 w-5" />} title="Nothing to approve" />
        ) : (
          <ul className="divide-y divide-border">
            {data?.data.map((request) => {
              const notice = differenceInCalendarDays(new Date(request.startDate), new Date());
              return (
                <li key={request.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Avatar
                    name={request.employee.user.name}
                    src={request.employee.user.avatar?.url}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {request.employee.user.name}
                    </p>
                    <p className="text-2xs text-muted">
                      {request.leaveType.name} · {Number(request.totalDays)} day
                      {Number(request.totalDays) === 1 ? '' : 's'} ·{' '}
                      {fmtDate(request.startDate)} — {fmtDate(request.endDate)}
                    </p>
                    {request.reason && (
                      <p className="mt-0.5 text-xs text-fg">{request.reason}</p>
                    )}
                  </div>

                  {notice >= 0 && (
                    <Badge tone={notice <= 1 ? 'warning' : 'neutral'}>
                      {notice === 0 ? 'Starts today' : `in ${notice}d`}
                    </Badge>
                  )}
                  {request.proofFile && (
                    <a
                      href={request.proofFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Proof
                    </a>
                  )}

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<X className="h-3.5 w-3.5" />}
                      onClick={() => setRejecting(request)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      icon={<Check className="h-3.5 w-3.5" />}
                      loading={decide.isPending}
                      onClick={() => decide.mutate({ id: request.id, decision: 'APPROVED' })}
                    >
                      Approve
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {rejecting && (
        <RejectLeaveModal
          request={rejecting}
          loading={decide.isPending}
          onClose={() => setRejecting(null)}
          onReject={(note) => decide.mutate({ id: rejecting.id, decision: 'REJECTED', note })}
        />
      )}
    </>
  );
}

/** Rejection needs a reason, so the field and the button live in one component. */
function RejectLeaveModal({
  request,
  loading,
  onClose,
  onReject,
}: {
  request: LeaveRequest;
  loading: boolean;
  onClose: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title="Reject leave request"
      description={`${request.employee.user.name} · ${request.leaveType.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={note.trim().length < 3}
            onClick={() => onReject(note)}
          >
            Reject
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        required
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="e.g. Two people are already off that week."
      />
    </Modal>
  );
}

function TeamLeave() {
  const { data, isLoading } = useQuery({
    queryKey: ['leave', 'on-leave'],
    queryFn: () =>
      apiGet<
        {
          id: string;
          startDate: string;
          endDate: string;
          totalDays: string;
          leaveType: { name: string; code: string };
          employee: {
            id: string;
            user: { name: string; avatar: { url: string } | null };
            department: { name: string } | null;
          };
        }[]
      >('/leave/on-leave'),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <Card>
      <CardHeader title="Who is off" description="Approved leave for the next two weeks" />
      {data?.length === 0 ? (
        <EmptyState compact icon={<Palmtree className="h-5 w-5" />} title="Everyone is in" />
      ) : (
        <ul className="divide-y divide-border">
          {data?.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar
                name={entry.employee.user.name}
                src={entry.employee.user.avatar?.url}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  {entry.employee.user.name}
                </p>
                <p className="truncate text-2xs text-muted">
                  {entry.employee.department?.name ?? 'Team'} · {entry.leaveType.name}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted">
                {fmtDate(entry.startDate, 'dd MMM')} — {fmtDate(entry.endDate, 'dd MMM')}
              </span>
              <Badge tone="neutral">{Number(entry.totalDays)}d</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RequestLeaveModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    halfDay: false,
    reason: '',
  });

  const types = useQuery({
    queryKey: ['options', 'leave-types'],
    queryFn: () => apiGet<LeaveType[]>('/masters/leave-types'),
  });

  const balances = useQuery({
    queryKey: ['leave', 'balances', 'my'],
    queryFn: () => apiGet<LeaveBalance[]>('/leave/balances/my'),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiPost('/leave/requests', {
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.halfDay ? form.startDate : form.endDate,
        halfDay: form.halfDay,
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Leave requested — your manager has been notified');
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const selectedType = types.data?.find((type) => type.id === form.leaveTypeId);
  const balance = balances.data?.find((entry) => entry.leaveType.id === form.leaveTypeId);
  const ready = form.leaveTypeId && form.startDate && (form.halfDay || form.endDate);

  return (
    <Modal
      open
      onClose={onClose}
      title="Request leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submit.isPending} disabled={!ready} onClick={() => submit.mutate()}>
            Submit request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Leave type"
          required
          value={form.leaveTypeId}
          onChange={(event) => setForm({ ...form, leaveTypeId: event.target.value })}
          placeholder="Select a type"
          options={(types.data ?? [])
            .filter((type) => type.active)
            .map((type) => ({ value: type.id, label: `${type.name} (${type.code})` }))}
        />

        {balance && (
          <p
            className={cn(
              'rounded-lg px-3 py-2 text-xs',
              (balance.available ?? 0) > 0
                ? 'bg-success-soft text-success'
                : 'bg-danger-soft text-danger',
            )}
          >
            You have {balance.available ?? 0} day(s) of {balance.leaveType.name} available.
          </p>
        )}

        <Checkbox
          checked={form.halfDay}
          onChange={(event) => setForm({ ...form, halfDay: event.target.checked })}
          label="Half day"
          description="Covers a single date and counts as 0.5 days."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={form.halfDay ? 'Date' : 'From'}
            type="date"
            required
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
          />
          {!form.halfDay && (
            <Input
              label="To"
              type="date"
              required
              min={form.startDate}
              value={form.endDate}
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            />
          )}
        </div>

        <Textarea
          label="Reason"
          rows={2}
          value={form.reason}
          onChange={(event) => setForm({ ...form, reason: event.target.value })}
          placeholder="Helpful context for whoever approves it."
        />

        {selectedType?.requiresProof && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
            {selectedType.name} normally needs supporting documentation — please share it with
            HR.
          </p>
        )}

        <p className="text-2xs text-muted">
          Weekends and holidays are excluded automatically when counting days.
        </p>
      </div>
    </Modal>
  );
}
