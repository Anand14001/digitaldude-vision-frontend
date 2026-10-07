import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, humanise } from '@/lib/utils';
import type { AttendanceMonth, AttendanceRecord, AttendanceToday } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatTile,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@/components/ui';
import { AttendanceStatusBadge } from '@/components/domain';

/** One colour per state, reused by the month grid and its legend. */
const CELL_STYLES: Record<string, string> = {
  PRESENT: 'bg-success/80 text-white',
  WORK_FROM_HOME: 'bg-info/80 text-white',
  HALF_DAY: 'bg-warning/80 text-white',
  ON_LEAVE: 'bg-primary/70 text-white',
  HOLIDAY: 'bg-border-strong text-fg',
  WEEKLY_OFF: 'bg-surface-2 text-subtle',
  ABSENT: 'bg-danger/80 text-white',
};

export function AttendancePage() {
  const { can } = useAuth();
  const [tab, setTab] = useState(can('attendance.view.all', 'attendance.view.team') ? 'team' : 'mine');

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Check-ins, leave and absences across the team."
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          {can('attendance.mark.own') && <Tab value="mine">My attendance</Tab>}
          {can('attendance.view.all', 'attendance.view.team') && (
            <Tab value="team">Month view</Tab>
          )}
        </TabList>

        <TabPanel value="mine">
          <MyAttendance />
        </TabPanel>
        <TabPanel value="team">
          <MonthGrid />
        </TabPanel>
      </Tabs>
    </div>
  );
}

function MyAttendance() {
  const queryClient = useQueryClient();

  const today = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => apiGet<AttendanceToday>('/attendance/today'),
  });

  const history = useQuery({
    queryKey: ['attendance', 'my'],
    queryFn: () =>
      apiGet<{
        records: AttendanceRecord[];
        summary: {
          present: number;
          onLeave: number;
          absent: number;
          lateDays: number;
          totalHours: number;
        };
      }>('/attendance/my'),
  });

  const punch = useMutation({
    mutationFn: (action: 'check-in' | 'check-out') => apiPost(`/attendance/${action}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (today.isLoading || history.isLoading) return <LoadingBlock />;

  const record = today.data?.record;
  const checkedIn = Boolean(record?.checkInAt);
  const checkedOut = Boolean(record?.checkOutAt);
  const summary = history.data?.summary;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </p>
            {today.data?.holiday ? (
              <p className="mt-1 text-lg font-semibold text-fg">
                {today.data.holiday.name} — holiday
              </p>
            ) : !today.data?.isWorkingDay ? (
              <p className="mt-1 text-lg font-semibold text-fg">Weekly off</p>
            ) : record ? (
              <p className="mt-1 text-lg font-semibold text-fg">
                {checkedOut
                  ? `Worked ${Math.floor((record.workedMinutes ?? 0) / 60)}h ${(record.workedMinutes ?? 0) % 60}m`
                  : `Checked in at ${fmtDate(record.checkInAt, 'h:mm a')}`}
              </p>
            ) : (
              <p className="mt-1 text-lg font-semibold text-fg">Not checked in yet</p>
            )}
            {(record?.lateMinutes ?? 0) > 0 && (
              <Badge tone="warning" className="mt-2">
                {record?.lateMinutes} min late
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!checkedIn ? (
              <Button
                size="lg"
                icon={<LogIn className="h-4 w-4" />}
                loading={punch.isPending}
                onClick={() => punch.mutate('check-in')}
              >
                Check in
              </Button>
            ) : !checkedOut ? (
              <Button
                size="lg"
                variant="secondary"
                icon={<LogOut className="h-4 w-4" />}
                loading={punch.isPending}
                onClick={() => punch.mutate('check-out')}
              >
                Check out
              </Button>
            ) : (
              <Badge tone="success" dot>
                Day complete
              </Badge>
            )}
          </div>
        </div>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          Office hours {today.data?.schedule.startTime} — {today.data?.schedule.endTime}.
          Check-ins after a 15 minute grace period are marked late.
        </p>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Present" value={summary.present} tone="success" />
          <StatTile label="On leave" value={summary.onLeave} tone="primary" />
          <StatTile label="Absent" value={summary.absent} tone={summary.absent ? 'danger' : 'neutral'} />
          <StatTile label="Late days" value={summary.lateDays} tone={summary.lateDays ? 'warning' : 'neutral'} />
          <StatTile label="Hours this month" value={summary.totalHours} />
        </div>
      )}

      <Card>
        <CardHeader title="This month" />
        {history.data?.records.length === 0 ? (
          <EmptyState compact icon={<CalendarDays className="h-5 w-5" />} title="Nothing recorded" />
        ) : (
          <ul className="divide-y divide-border">
            {history.data?.records.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm"
              >
                <span className="w-28 shrink-0 text-fg">
                  {fmtDate(entry.workDate, 'EEE, dd MMM')}
                </span>
                <AttendanceStatusBadge value={entry.status} />
                <span className="text-xs text-muted">
                  {entry.checkInAt ? fmtDate(entry.checkInAt, 'h:mm a') : '—'}
                  {entry.checkOutAt ? ` — ${fmtDate(entry.checkOutAt, 'h:mm a')}` : ''}
                </span>
                {(entry.lateMinutes ?? 0) > 0 && (
                  <Badge tone="warning">{entry.lateMinutes}m late</Badge>
                )}
                {entry.workedMinutes && (
                  <span className="ml-auto text-xs tabular-nums text-muted">
                    {Math.floor(entry.workedMinutes / 60)}h {entry.workedMinutes % 60}m
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MonthGrid() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['attendance', 'monthly', month, year],
    queryFn: () => apiGet<AttendanceMonth>('/attendance/monthly', { month, year }),
  });

  const step = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setMonth(next.getMonth() + 1);
    setYear(next.getFullYear());
  };

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" aria-label="Previous month" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium text-fg">
            {format(new Date(year, month - 1, 1), 'MMMM yyyy')}
          </span>
          <Button variant="secondary" size="icon" aria-label="Next month" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-2xs">
          {Object.entries(CELL_STYLES).map(([status, className]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded', className)} />
              <span className="text-muted">{humanise(status)}</span>
            </span>
          ))}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="dd-th sticky left-0 z-10 bg-surface-2">Employee</th>
              {data?.days.map((day) => (
                <th
                  key={day}
                  className="px-1 py-2 text-center text-2xs font-medium text-muted"
                  title={day}
                >
                  {day.slice(-2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((row) => (
              <tr key={row.employee.id} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                  <p className="truncate text-sm font-medium text-fg">{row.employee.name}</p>
                  <p className="truncate text-2xs text-muted">{row.employee.code}</p>
                </td>
                {row.days.map((cell) => (
                  <td key={cell.date} className="px-0.5 py-1 text-center">
                    <span
                      title={`${cell.date}: ${cell.status ? humanise(cell.status) : 'No record'}${
                        cell.leaveCode ? ` (${cell.leaveCode})` : ''
                      }`}
                      className={cn(
                        'mx-auto flex h-6 w-6 items-center justify-center rounded text-2xs font-semibold',
                        cell.status ? CELL_STYLES[cell.status] : 'bg-transparent text-subtle',
                      )}
                    >
                      {cell.status === 'PRESENT'
                        ? 'P'
                        : cell.status === 'WORK_FROM_HOME'
                          ? 'W'
                          : cell.status === 'HALF_DAY'
                            ? 'H'
                            : cell.status === 'ON_LEAVE'
                              ? (cell.leaveCode ?? 'L')
                              : cell.status === 'HOLIDAY'
                                ? 'X'
                                : cell.status === 'ABSENT'
                                  ? 'A'
                                  : cell.status === 'WEEKLY_OFF'
                                    ? '·'
                                    : ''}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
