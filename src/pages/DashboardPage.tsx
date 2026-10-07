import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileCheck2,
  HeartPulse,
  ListChecks,
  LogIn,
  LogOut,
  Palmtree,
  Repeat,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  cn,
  fmtCompactCurrency,
  fmtDate,
  fmtDue,
  fmtRelative,
  humanise,
  isOverdue,
} from '@/lib/utils';
import type { AttendanceToday, DashboardPayload } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  StatTile,
} from '@/components/ui';
import { HealthBadge, PriorityBadge, ProjectStatusBadge } from '@/components/domain';

export function DashboardPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<DashboardPayload>('/dashboard'),
  });

  const attendance = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => apiGet<AttendanceToday>('/attendance/today'),
    enabled: can('attendance.mark.own'),
  });

  const punch = useMutation({
    mutationFn: (action: 'check-in' | 'check-out') => apiPost(`/attendance/${action}`),
    onSuccess: (_result, action) => {
      toast.success(action === 'check-in' ? 'Checked in. Have a good one.' : 'Checked out.');
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock label="Building your dashboard…" />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!data) return null;

  const firstName = user?.name.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const record = attendance.data?.record;
  const checkedIn = Boolean(record?.checkInAt);
  const checkedOut = Boolean(record?.checkOutAt);

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={
          data.role
            ? `${data.role} · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`
            : undefined
        }
        actions={
          can('attendance.mark.own') && attendance.data ? (
            <div className="flex items-center gap-2">
              {record && (
                <Badge tone={checkedOut ? 'neutral' : 'success'} dot>
                  {checkedOut
                    ? `Out at ${fmtDate(record.checkOutAt, 'h:mm a')}`
                    : checkedIn
                      ? `In since ${fmtDate(record.checkInAt, 'h:mm a')}`
                      : humanise(record.status)}
                </Badge>
              )}
              {!checkedIn ? (
                <Button
                  icon={<LogIn className="h-4 w-4" />}
                  loading={punch.isPending}
                  onClick={() => punch.mutate('check-in')}
                >
                  Check in
                </Button>
              ) : !checkedOut ? (
                <Button
                  variant="secondary"
                  icon={<LogOut className="h-4 w-4" />}
                  loading={punch.isPending}
                  onClick={() => punch.mutate('check-out')}
                >
                  Check out
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {/* ---- my work ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open tasks"
          value={data.me.openTasks}
          icon={<ListChecks className="h-4 w-4" />}
          onClick={() => navigate('/tasks')}
        />
        <StatTile
          label="Overdue"
          value={data.me.overdueTasks}
          tone={data.me.overdueTasks > 0 ? 'danger' : 'success'}
          icon={<AlarmClock className="h-4 w-4" />}
          sub={data.me.overdueTasks > 0 ? 'Needs attention today' : 'Nothing late'}
          onClick={() => navigate('/tasks?filter=overdue')}
        />
        <StatTile
          label="Due today"
          value={data.me.dueToday}
          tone={data.me.dueToday > 0 ? 'warning' : 'neutral'}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <StatTile
          label="Due this week"
          value={data.me.dueThisWeek}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* ---- commercial, for those cleared to see it ---- */}
      {data.commercial && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Active clients"
            value={data.commercial.activeClients}
            tone="primary"
            icon={<Briefcase className="h-4 w-4" />}
            onClick={() => navigate('/clients')}
          />
          <StatTile
            label="Monthly recurring"
            value={fmtCompactCurrency(data.commercial.monthlyRecurringValue)}
            sub={`${data.commercial.activeRetainers} active retainer${data.commercial.activeRetainers === 1 ? '' : 's'}`}
            tone="success"
            icon={<Repeat className="h-4 w-4" />}
            onClick={() => navigate('/retainers')}
          />
          <StatTile
            label="Open pipeline"
            value={fmtCompactCurrency(data.commercial.openPipelineValue)}
            sub={`${data.commercial.openLeads} live lead${data.commercial.openLeads === 1 ? '' : 's'}`}
            tone="info"
            icon={<TrendingUp className="h-4 w-4" />}
            onClick={() => navigate('/leads')}
          />
          <StatTile
            label="Renewals in 30 days"
            value={data.commercial.renewalsDueIn30Days}
            tone={data.commercial.renewalsDueIn30Days > 0 ? 'warning' : 'neutral'}
            icon={<Repeat className="h-4 w-4" />}
            onClick={() => navigate('/reports?report=retainers')}
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ---- my next tasks ---- */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="My next tasks"
            description="Soonest due date first"
            action={
              <Link to="/tasks" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          {data.upcomingTasks.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Nothing scheduled"
              description="You have no dated tasks open right now."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.upcomingTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    to={`/tasks/${task.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: task.status.color }}
                      title={task.status.name}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">
                        {task.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {task.reference}
                        {task.project ? ` · ${task.project.name}` : ''}
                      </span>
                    </span>
                    <PriorityBadge value={task.priority} compact />
                    <span
                      className={cn(
                        'w-20 shrink-0 text-right text-xs',
                        isOverdue(task.dueDate) ? 'font-medium text-danger' : 'text-muted',
                      )}
                    >
                      {fmtDue(task.dueDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ---- side column ---- */}
        <div className="space-y-6">
          {data.projects && (
            <Card>
              <CardHeader title="Project health" />
              <div className="space-y-3 px-5 py-4">
                {data.projects.byHealth.length === 0 ? (
                  <p className="text-sm text-muted">No live projects.</p>
                ) : (
                  (() => {
                    const total = data.projects.byHealth.reduce((sum, row) => sum + row.count, 0);
                    return data.projects.byHealth.map((row) => (
                      <div key={row.health}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <HealthBadge value={row.health} />
                          <span className="text-xs tabular-nums text-muted">
                            {row.count} of {total}
                          </span>
                        </div>
                        <ProgressBar
                          value={total ? (row.count / total) * 100 : 0}
                          tone={
                            row.health === 'ON_TRACK'
                              ? 'success'
                              : row.health === 'AT_RISK'
                                ? 'warning'
                                : 'danger'
                          }
                        />
                      </div>
                    ));
                  })()
                )}
                <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                  {data.projects.byStatus.map((row) => (
                    <span key={row.status} className="inline-flex items-center gap-1">
                      <ProjectStatusBadge value={row.status} />
                      <span className="text-2xs tabular-nums text-muted">{row.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {data.approvals && (
            <Card>
              <CardHeader title="Waiting on a decision" />
              <div className="divide-y divide-border">
                {data.approvals.deliverablesInternal !== undefined && (
                  <Link
                    to="/deliverables?status=INTERNAL_REVIEW"
                    className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-2 text-fg">
                      <FileCheck2 className="h-4 w-4 text-info" />
                      Internal review
                    </span>
                    <span className="font-semibold tabular-nums">
                      {data.approvals.deliverablesInternal}
                    </span>
                  </Link>
                )}
                {data.approvals.awaitingClient !== undefined && (
                  <Link
                    to="/deliverables?status=CLIENT_REVIEW"
                    className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-2 text-fg">
                      <Clock className="h-4 w-4 text-warning" />
                      With the client
                    </span>
                    <span className="font-semibold tabular-nums">
                      {data.approvals.awaitingClient}
                    </span>
                  </Link>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Who is off" description="Next seven days" />
            {data.whoIsOff.length === 0 ? (
              <EmptyState
                compact
                icon={<Palmtree className="h-5 w-5" />}
                title="Everyone is in"
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.whoIsOff.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Avatar name={entry.name} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{entry.name}</span>
                    <Badge tone="neutral">{entry.type}</Badge>
                    <span className="shrink-0 text-2xs text-muted">
                      {fmtDate(entry.from, 'dd MMM')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {data.upcomingHolidays.length > 0 && (
            <Card>
              <CardHeader title="Upcoming holidays" />
              <ul className="divide-y divide-border">
                {data.upcomingHolidays.map((holiday) => (
                  <li
                    key={holiday.id}
                    className="flex items-center justify-between px-5 py-2.5 text-sm"
                  >
                    <span className="text-fg">{holiday.name}</span>
                    <span className="text-xs text-muted">{fmtDate(holiday.date, 'dd MMM')}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* ---- team, for managers ---- */}
      {data.team && (
        <Card className="mt-6">
          <CardHeader
            title="My team"
            description={`${data.team.headcount} people · ${data.team.presentToday} in today`}
            action={
              <div className="flex gap-2">
                {data.team.pendingLeaveApprovals > 0 && (
                  <Link to="/leave">
                    <Badge tone="warning">
                      {data.team.pendingLeaveApprovals} leave request
                      {data.team.pendingLeaveApprovals === 1 ? '' : 's'}
                    </Badge>
                  </Link>
                )}
                {data.team.pendingTimesheetApprovals > 0 && (
                  <Link to="/timesheets">
                    <Badge tone="info">
                      {data.team.pendingTimesheetApprovals} timesheet
                      {data.team.pendingTimesheetApprovals === 1 ? '' : 's'}
                    </Badge>
                  </Link>
                )}
              </div>
            }
          />
          {data.team.members.length === 0 ? (
            <EmptyState compact icon={<Users className="h-5 w-5" />} title="No direct reports" />
          ) : (
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
              {data.team.members.map((member) => (
                <Link
                  key={member.id}
                  to={`/employees/${member.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                >
                  <Avatar name={member.name} src={member.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {member.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {member.designation ?? 'Team member'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-fg">
                      {member.openTasks}
                    </span>
                    {member.overdueTasks > 0 ? (
                      <span className="block text-2xs text-danger">
                        {member.overdueTasks} late
                      </span>
                    ) : (
                      <span className="block text-2xs text-subtle">open</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ---- due soon + activity ---- */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {data.projects && data.projects.dueSoon.length > 0 && (
          <Card>
            <CardHeader title="Projects due soon" description="Next fourteen days" />
            <ul className="divide-y divide-border">
              {data.projects.dueSoon.map((project) => (
                <li key={project.id}>
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <HeartPulse
                      className={cn(
                        'h-4 w-4 shrink-0',
                        project.health === 'ON_TRACK'
                          ? 'text-success'
                          : project.health === 'AT_RISK'
                            ? 'text-warning'
                            : 'text-danger',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">
                        {project.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {project.client?.name ?? 'Internal'}
                        {project.currentStage ? ` · ${project.currentStage.name}` : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-xs',
                        isOverdue(project.dueDate) ? 'font-medium text-danger' : 'text-muted',
                      )}
                    >
                      {fmtDue(project.dueDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data.recentActivity && data.recentActivity.length > 0 && (
          <Card>
            <CardHeader
              title="Recent activity"
              description="The latest five changes"
              action={
                <Link to="/logs" className="text-xs font-medium text-primary hover:underline">
                  Full log
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {data.recentActivity.slice(0, 5).map((entry) => (
                <li key={entry.id} className="px-5 py-2.5">
                  <p className="text-sm text-fg">{entry.summary}</p>
                  <p className="mt-0.5 text-2xs text-subtle">
                    {entry.actorLabel.split('<')[0]?.trim()} · {fmtRelative(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
