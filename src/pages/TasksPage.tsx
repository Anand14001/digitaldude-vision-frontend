import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, CalendarDays, CheckCircle2, Inbox, List, Plus } from 'lucide-react';
import { apiGet, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, fmtDate, fmtDue, fmtHours, isOverdue } from '@/lib/utils';
import type { EmployeeListItem, MyTasks, TaskListItem, TaskStatusRef } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  SegmentedControl,
  SkeletonRows,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  Table,
} from '@/components/ui';
import { PriorityBadge } from '@/components/domain';
import { FilterBar, FilterSelect, TableCard, ViewToggle } from '@/components/ListShell';
import { TaskComposer } from '@/features/TaskComposer';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const CATEGORIES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'CANCELLED'] as const;

export function TasksPage() {
  const { can } = useAuth();
  const [params] = useSearchParams();
  const [view, setView] = useState<'mine' | 'all'>(
    can('tasks.view.all') && params.get('view') === 'all' ? 'all' : 'mine',
  );
  const [composing, setComposing] = useState(false);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={
          view === 'mine'
            ? 'Your queue, grouped by when it is due.'
            : 'Every task you can see across the agency.'
        }
        actions={
          <>
            {can('tasks.view.all') && (
              <ViewToggle
                view={view}
                onChange={(value) => setView(value as 'mine' | 'all')}
                views={[
                  { value: 'mine', label: 'My tasks', icon: <Inbox className="h-3.5 w-3.5" /> },
                  { value: 'all', label: 'All tasks', icon: <List className="h-3.5 w-3.5" /> },
                ]}
              />
            )}
            {can('tasks.create') && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setComposing(true)}>
                New task
              </Button>
            )}
          </>
        }
      />

      {view === 'mine' ? <MyTasksView /> : <AllTasksView />}

      {composing && <StandaloneComposer onClose={() => setComposing(false)} />}
    </div>
  );
}

/** Grouped queue: overdue first, because that is what needs deciding. */
function MyTasksView() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tasks', 'my'],
    queryFn: () => apiGet<MyTasks>('/tasks/my'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="h-40 animate-pulse" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!data) return null;

  const groups = [
    { key: 'overdue', title: 'Overdue', tone: 'danger' as const, tasks: data.overdue, icon: AlarmClock },
    { key: 'today', title: 'Due today', tone: 'warning' as const, tasks: data.today, icon: CalendarDays },
    { key: 'upcoming', title: 'Coming up', tone: 'neutral' as const, tasks: data.upcoming, icon: CalendarDays },
    { key: 'unscheduled', title: 'No due date', tone: 'neutral' as const, tasks: data.unscheduled, icon: Inbox },
  ];

  const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);

  if (total === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Your queue is clear"
          description="Nothing open is assigned to you right now."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {groups
        .filter((group) => group.tasks.length > 0)
        .map((group) => (
          <Card key={group.key}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <group.icon
                    className={cn(
                      'h-4 w-4',
                      group.tone === 'danger'
                        ? 'text-danger'
                        : group.tone === 'warning'
                          ? 'text-warning'
                          : 'text-muted',
                    )}
                  />
                  {group.title}
                  <Badge tone={group.tone}>{group.tasks.length}</Badge>
                </span>
              }
            />
            <ul className="divide-y divide-border">
              {group.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}

function TaskRow({ task }: { task: TaskListItem }) {
  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: task.status.color }}
          title={task.status.name}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{task.title}</span>
          <span className="block truncate text-xs text-muted">
            <span className="font-mono">{task.reference}</span>
            {task.project
              ? ` · ${task.project.name} · ${task.project.client.name}`
              : task.retainerCycle
                ? ` · ${task.retainerCycle.retainer.name} · ${task.retainerCycle.label}`
                : ''}
          </span>
        </span>
        {task.estimateHours && (
          <span className="hidden shrink-0 text-2xs text-muted sm:block">
            {fmtHours(Number(task.estimateHours))}
          </span>
        )}
        <PriorityBadge value={task.priority} compact />
        <span
          className={cn(
            'w-20 shrink-0 text-right text-xs',
            isOverdue(task.dueDate) && !task.completedAt
              ? 'font-medium text-danger'
              : 'text-muted',
          )}
        >
          {fmtDue(task.dueDate)}
        </span>
      </Link>
    </li>
  );
}

function AllTasksView() {
  const navigate = useNavigate();
  const list = useListState(
    {
      category: undefined,
      priority: undefined,
      assigneeId: undefined,
      openOnly: 'true',
    },
    30,
  );

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<TaskListItem>(
    ['tasks', 'all'],
    '/tasks',
    list.queryParams,
  );

  const employees = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
    staleTime: 300_000,
  });

  return (
    <>
      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        placeholder="Search by title or reference…"
        activeCount={list.activeFilterCount}
        onReset={list.resetFilters}
      >
        <SegmentedControl
          size="sm"
          value={list.filters.openOnly === 'true' ? 'open' : 'all'}
          onChange={(value) => list.setFilter('openOnly', value === 'open' ? 'true' : undefined)}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'all', label: 'Everything' },
          ]}
        />
        <FilterSelect
          value={list.filters.category}
          onChange={(value) => list.setFilter('category', value)}
          options={CATEGORIES}
          allLabel="All statuses"
        />
        <FilterSelect
          value={list.filters.priority}
          onChange={(value) => list.setFilter('priority', value)}
          options={PRIORITIES}
          allLabel="All priorities"
        />
        <FilterSelect
          value={list.filters.assigneeId}
          onChange={(value) => list.setFilter('assigneeId', value)}
          options={(employees.data ?? []).map((employee) => ({
            value: employee.id,
            label: employee.user.name,
          }))}
          allLabel="Anyone"
        />
      </FilterBar>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <TableCard meta={data?.meta} onPageChange={list.setPage}>
          <Table className={cn(isFetching && 'opacity-60')}>
            <THead>
              <tr>
                <TH>Task</TH>
                <TH>Where</TH>
                <TH>Status</TH>
                <TH>Assignee</TH>
                <TH>Priority</TH>
                <TH>Due</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <SkeletonRows rows={10} cols={6} />
              ) : data?.data.length === 0 ? (
                <tr>
                  <TD colSpan={6}>
                    <EmptyState
                      icon={<List className="h-5 w-5" />}
                      title="No tasks match"
                      description="Try a different filter."
                    />
                  </TD>
                </tr>
              ) : (
                data?.data.map((task) => (
                  <TRow key={task.id} onClick={() => navigate(`/tasks/${task.id}`)}>
                    <TD>
                      <p className="truncate font-medium text-fg">{task.title}</p>
                      <p className="font-mono text-2xs text-subtle">{task.reference}</p>
                    </TD>
                    <TD className="text-xs text-muted">
                      {task.project ? (
                        <>
                          <span className="block truncate">{task.project.name}</span>
                          <span className="block truncate text-subtle">
                            {task.project.client.name}
                          </span>
                        </>
                      ) : task.retainerCycle ? (
                        <>
                          <span className="block truncate">
                            {task.retainerCycle.retainer.name}
                          </span>
                          <span className="block truncate text-subtle">
                            {task.retainerCycle.label}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD>
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{ color: task.status.color }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: task.status.color }}
                        />
                        {task.status.name}
                      </span>
                    </TD>
                    <TD>
                      {task.assignee ? (
                        <span className="flex items-center gap-2">
                          <Avatar
                            name={task.assignee.user.name}
                            src={task.assignee.user.avatar?.url}
                            size="xs"
                          />
                          <span className="truncate text-xs text-muted">
                            {task.assignee.user.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-subtle">Unassigned</span>
                      )}
                    </TD>
                    <TD>
                      <PriorityBadge value={task.priority} />
                    </TD>
                    <TD
                      className={cn(
                        'whitespace-nowrap text-xs',
                        isOverdue(task.dueDate) && !task.completedAt && 'font-medium text-danger',
                      )}
                    >
                      {task.dueDate ? fmtDate(task.dueDate, 'dd MMM yy') : '—'}
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

/**
 * Creating a task outside a project needs the project picked first, since the
 * available statuses come from that project's workflow.
 */
function StandaloneComposer({ onClose }: { onClose: () => void }) {
  const [projectId, setProjectId] = useState('');

  const projects = useQuery({
    queryKey: ['projects', 'picker'],
    queryFn: () =>
      apiGet<{ id: string; name: string; code: string; workflow?: unknown }[]>('/projects', {
        pageSize: 100,
        status: 'ACTIVE',
      }),
  });

  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () =>
      apiGet<{ workflow: { taskStatuses: TaskStatusRef[] }; currentStage: { id: string } | null }>(
        `/projects/${projectId}`,
      ),
    enabled: Boolean(projectId),
  });

  if (!projectId) {
    return (
      <Card className="fixed inset-x-4 top-24 z-50 mx-auto max-w-md p-5 shadow-pop">
        <h2 className="text-base font-semibold text-fg">Which project?</h2>
        <p className="mt-1 text-sm text-muted">
          A task belongs to a project or a retainer cycle, so pick one first.
        </p>
        <select
          className="dd-input mt-4"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">Select a project</option>
          {(projects.data ?? []).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.code} {entry.name}
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  if (project.isLoading || !project.data) return null;

  return (
    <TaskComposer
      onClose={onClose}
      projectId={projectId}
      statuses={project.data.workflow.taskStatuses}
      stageId={project.data.currentStage?.id}
    />
  );
}
