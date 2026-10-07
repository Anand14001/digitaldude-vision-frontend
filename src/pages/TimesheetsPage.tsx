import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addWeeks, format, startOfWeek } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Clock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiList, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, fmtHours, toISODate } from '@/lib/utils';
import type { MyTimesheet, Timesheet } from '@/types/api';
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Modal,
  PageHeader,
  StatTile,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
} from '@/components/ui';
import { TimesheetStatusBadge } from '@/components/domain';
import { LogTimeModal } from './TaskDetailPage';

export function TimesheetsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState(can('timesheets.log.own') ? 'mine' : 'approvals');

  return (
    <div>
      <PageHeader
        title="Timesheets"
        description="Hours logged against tasks, submitted weekly for approval."
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          {can('timesheets.log.own') && <Tab value="mine">My week</Tab>}
          {can('timesheets.approve') && <Tab value="approvals">Approvals</Tab>}
          {can('timesheets.view.all', 'timesheets.view.team') && (
            <Tab value="all">All timesheets</Tab>
          )}
        </TabList>

        <TabPanel value="mine">
          <MyWeek />
        </TabPanel>
        <TabPanel value="approvals">
          <TimesheetList statusFilter="SUBMITTED" approvable />
        </TabPanel>
        <TabPanel value="all">
          <TimesheetList />
        </TabPanel>
      </Tabs>
    </div>
  );
}

function MyWeek() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [logging, setLogging] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['timesheet', 'my', toISODate(weekStart)],
    queryFn: () =>
      apiGet<MyTimesheet>('/time/timesheets/my', { weekStart: toISODate(weekStart) }),
  });

  const submit = useMutation({
    mutationFn: () => apiPost('/time/timesheets/submit', { weekStart: toISODate(weekStart) }),
    onSuccess: () => {
      toast.success('Timesheet submitted for approval');
      void queryClient.invalidateQueries({ queryKey: ['timesheet'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const removeEntry = useMutation({
    mutationFn: (entryId: string) => apiDelete(`/time/entries/${entryId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timesheet'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  const entries = data?.timesheet?.entries ?? [];
  const status = data?.timesheet?.status ?? 'DRAFT';
  const locked = status === 'SUBMITTED' || status === 'APPROVED';
  const billable = entries.filter((entry) => entry.billable).reduce(
    (sum, entry) => sum + Number(entry.hours),
    0,
  );

  // One column per day, which is how people think about a week of work.
  const days = Array.from({ length: 7 }, (_, index) => addWeeks(weekStart, 0).getTime() + index * 86_400_000)
    .map((time) => new Date(time));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous week"
            onClick={() => setWeekStart((current) => addWeeks(current, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium text-fg">
            {format(weekStart, 'dd MMM')} — {format(addWeeks(weekStart, 1).getTime() - 86_400_000, 'dd MMM yyyy')}
          </span>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next week"
            onClick={() => setWeekStart((current) => addWeeks(current, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            This week
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <TimesheetStatusBadge value={status} />
          {!locked && (
            <>
              <Button
                variant="secondary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setLogging(true)}
              >
                Log time
              </Button>
              <Button
                loading={submit.isPending}
                disabled={entries.length === 0}
                onClick={() => submit.mutate()}
              >
                Submit week
              </Button>
            </>
          )}
        </div>
      </div>

      {data?.timesheet?.status === 'REJECTED' && data.timesheet.rejectReason && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <p className="font-medium">Sent back for changes</p>
          <p className="mt-0.5">{data.timesheet.rejectReason}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total hours" value={fmtHours(data?.totalHours ?? 0)} />
        <StatTile label="Billable" value={fmtHours(billable)} tone="success" />
        <StatTile
          label="Non-billable"
          value={fmtHours((data?.totalHours ?? 0) - billable)}
          tone="neutral"
        />
        <StatTile label="Entries" value={entries.length} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const dayEntries = entries.filter(
            (entry) => entry.workDate.slice(0, 10) === toISODate(day),
          );
          const total = dayEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
          const isToday = toISODate(day) === toISODate(new Date());

          return (
            <Card
              key={day.toISOString()}
              className={cn('p-3', isToday && 'ring-2 ring-primary/30')}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
                  {format(day, 'EEE dd')}
                </span>
                {total > 0 && (
                  <span className="text-2xs font-semibold tabular-nums text-fg">
                    {fmtHours(total)}
                  </span>
                )}
              </div>
              {dayEntries.length === 0 ? (
                <p className="py-2 text-center text-2xs text-subtle">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="group rounded-md bg-surface-2 px-2 py-1.5"
                    >
                      <p className="truncate text-2xs font-medium text-fg">
                        {entry.task?.title ?? entry.project?.name ?? 'Time'}
                      </p>
                      <div className="mt-0.5 flex items-center justify-between">
                        <span className="text-2xs tabular-nums text-muted">
                          {Number(entry.hours)}h
                          {!entry.billable && ' · NB'}
                        </span>
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => removeEntry.mutate(entry.id)}
                            aria-label="Remove entry"
                            className="hidden text-subtle hover:text-danger group-hover:block"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {logging && <LogTimeModal onClose={() => setLogging(false)} />}
    </div>
  );
}

function TimesheetList({
  statusFilter,
  approvable,
}: {
  statusFilter?: string;
  approvable?: boolean;
}) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<Timesheet | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['timesheets', statusFilter],
    queryFn: () =>
      apiList<Timesheet>('/time/timesheets', { status: statusFilter, pageSize: 50 }),
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
    }) => apiPost(`/time/timesheets/${id}/decision`, { decision, reason }),
    onSuccess: () => {
      toast.success('Decision recorded');
      void queryClient.invalidateQueries({ queryKey: ['timesheets'] });
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
          title={approvable ? 'Waiting for your approval' : 'Timesheets'}
          description={`${data?.meta.total ?? 0} total`}
        />
        {data?.data.length === 0 ? (
          <EmptyState
            compact
            icon={<Clock className="h-5 w-5" />}
            title={approvable ? 'Nothing to approve' : 'No timesheets'}
          />
        ) : (
          <ul className="divide-y divide-border">
            {data?.data.map((sheet) => (
              <li key={sheet.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar name={sheet.employee?.user.name ?? '?'} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {sheet.employee?.user.name}
                  </p>
                  <p className="text-2xs text-muted">
                    Week of {fmtDate(sheet.weekStart)} · {sheet.employee?.employeeCode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-fg">
                    {fmtHours(sheet.totalHours ?? 0)}
                  </p>
                  <p className="text-2xs text-muted">
                    {fmtHours(sheet.billableHours ?? 0)} billable
                  </p>
                </div>
                <TimesheetStatusBadge value={sheet.status} />
                {approvable && sheet.status === 'SUBMITTED' && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<X className="h-3.5 w-3.5" />}
                      onClick={() => setRejecting(sheet)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      icon={<Check className="h-3.5 w-3.5" />}
                      loading={decide.isPending}
                      onClick={() => decide.mutate({ id: sheet.id, decision: 'APPROVED' })}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {rejecting && (
        <RejectModal
          timesheet={rejecting}
          onClose={() => setRejecting(null)}
          onSubmit={(reason) =>
            decide.mutate({ id: rejecting.id, decision: 'REJECTED', reason })
          }
          loading={decide.isPending}
        />
      )}
    </>
  );
}

function RejectModal({
  timesheet,
  onClose,
  onSubmit,
  loading,
}: {
  timesheet: Timesheet;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title="Send this timesheet back"
      description={`${timesheet.employee?.user.name} · week of ${fmtDate(timesheet.weekStart)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={reason.trim().length < 3}
            onClick={() => onSubmit(reason)}
          >
            Send back
          </Button>
        </>
      }
    >
      <Textarea
        label="What needs fixing?"
        required
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="e.g. Thursday looks like it is missing the shoot hours."
      />
    </Modal>
  );
}
