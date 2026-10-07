import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  Clock,
  Link2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, fmtHours, isOverdue } from '@/lib/utils';
import type { EmployeeListItem, TaskDetail, TaskStatusRef } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FieldGrid,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Textarea,
} from '@/components/ui';
import { PriorityBadge } from '@/components/domain';
import { CommentThread } from '@/features/CommentThread';
import { FileList } from '@/features/FileList';
import { TaskComposer } from '@/features/TaskComposer';

export function TaskDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, user } = useAuth();

  const [checklistDraft, setChecklistDraft] = useState('');
  const [loggingTime, setLoggingTime] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: task, isLoading, error, refetch } = useQuery({
    queryKey: ['task', id],
    queryFn: () => apiGet<TaskDetail>(`/tasks/${id}`),
    enabled: Boolean(id),
  });

  const workflowStatuses = useQuery({
    queryKey: ['task-statuses', task?.projectId, task?.retainerCycleId],
    queryFn: async () => {
      if (task?.projectId) {
        const project = await apiGet<{ workflow: { taskStatuses: TaskStatusRef[] } }>(
          `/projects/${task.projectId}`,
        );
        return project.workflow.taskStatuses;
      }
      if (task?.retainerCycleId) {
        const cycle = await apiGet<{
          retainer: { workflow: { taskStatuses: TaskStatusRef[] } };
        }>(`/retainers/cycles/${task.retainerCycleId}`);
        return cycle.retainer.workflow.taskStatuses;
      }
      return [];
    },
    enabled: Boolean(task),
  });

  const employees = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
    enabled: can('tasks.assign'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['task', id] });
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => apiPatch(`/tasks/${id}`, patch),
    onSuccess: invalidate,
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const addChecklist = useMutation({
    mutationFn: (label: string) => apiPost(`/tasks/${id}/checklist`, { label }),
    onSuccess: () => {
      setChecklistDraft('');
      invalidate();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const toggleChecklist = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      apiPatch(`/tasks/checklist/${itemId}`, { completed }),
    onSuccess: invalidate,
  });

  const removeChecklist = useMutation({
    mutationFn: (itemId: string) => apiDelete(`/tasks/checklist/${itemId}`),
    onSuccess: invalidate,
  });

  const removeTask = useMutation({
    mutationFn: () => apiDelete(`/tasks/${id}`),
    onSuccess: () => {
      toast.success('Task deleted');
      navigate(task?.projectId ? `/projects/${task.projectId}` : '/tasks');
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!task) return null;

  const canEdit =
    can('tasks.update') || (can('tasks.update.assigned') && task.assigneeId === user?.employee?.id);
  const statuses = workflowStatuses.data ?? [];
  const doneChecklist = task.checklist.filter((item) => item.completedAt).length;
  const blockers = task.dependsOn.filter((entry) => !entry.blockingTask.completedAt);

  return (
    <div>
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-1.5">
            <Link to="/tasks" className="hover:text-fg">
              Tasks
            </Link>
            {task.project && (
              <>
                <span>/</span>
                <Link to={`/projects/${task.project.id}`} className="hover:text-fg">
                  {task.project.name}
                </Link>
              </>
            )}
          </span>
        }
        title={task.title}
        description={
          <span className="font-mono text-xs">
            {task.reference}
            {task.parentTask ? ' · subtask of ' : ''}
            {task.parentTask && (
              <Link to={`/tasks/${task.parentTask.id}`} className="text-primary hover:underline">
                {task.parentTask.reference}
              </Link>
            )}
          </span>
        }
        meta={
          <>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium"
              style={{
                backgroundColor: `${task.status.color}1f`,
                color: task.status.color,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: task.status.color }}
              />
              {task.status.name}
            </span>
            <PriorityBadge value={task.priority} />
            {task.visibleToClient && <Badge tone="info">Client-visible</Badge>}
            {task.completedAt && (
              <Badge tone="success" dot>
                Completed {fmtDate(task.completedAt)}
              </Badge>
            )}
          </>
        }
        actions={
          <>
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can('timesheets.log.own') && (
              <Button icon={<Clock className="h-4 w-4" />} onClick={() => setLoggingTime(true)}>
                Log time
              </Button>
            )}
            {can('tasks.delete') && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete task"
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        }
      />

      {blockers.length > 0 && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="text-sm text-warning">
            <p className="font-medium">
              Blocked by {blockers.length} open task{blockers.length === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 text-xs">
              {blockers.map((entry) => entry.blockingTask.reference).join(', ')} must be completed
              before this one can be marked done.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {task.description && (
            <Card>
              <CardHeader title="Details" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-fg">
                {task.description}
              </p>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Checklist"
              description={
                task.checklist.length
                  ? `${doneChecklist} of ${task.checklist.length} done`
                  : 'Break the task into steps'
              }
            />
            {task.checklist.length > 0 && (
              <div className="px-5 pt-3">
                <ProgressBar
                  value={(doneChecklist / task.checklist.length) * 100}
                  tone="success"
                  showLabel
                />
              </div>
            )}
            <ul className="divide-y divide-border">
              {task.checklist.map((item) => (
                <li key={item.id} className="group flex items-center gap-2 px-5 py-2.5">
                  <Checkbox
                    checked={Boolean(item.completedAt)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      toggleChecklist.mutate({
                        itemId: item.id,
                        completed: event.target.checked,
                      })
                    }
                    label={
                      <span
                        className={cn(
                          item.completedAt && 'text-muted line-through',
                        )}
                      >
                        {item.label}
                      </span>
                    }
                    className="flex-1"
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeChecklist.mutate(item.id)}
                      aria-label="Remove item"
                      className="hidden text-subtle hover:text-danger group-hover:block"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex gap-2 border-t border-border px-5 py-3">
                <input
                  value={checklistDraft}
                  onChange={(event) => setChecklistDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && checklistDraft.trim()) {
                      addChecklist.mutate(checklistDraft.trim());
                    }
                  }}
                  placeholder="Add a step…"
                  className="dd-input"
                />
                <Button
                  variant="secondary"
                  loading={addChecklist.isPending}
                  disabled={!checklistDraft.trim()}
                  onClick={() => addChecklist.mutate(checklistDraft.trim())}
                >
                  Add
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Subtasks"
              action={
                can('tasks.create') ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setAddingSubtask(true)}
                  >
                    Add
                  </Button>
                ) : undefined
              }
            />
            {task.subtasks.length === 0 ? (
              <EmptyState compact title="No subtasks" />
            ) : (
              <ul className="divide-y divide-border">
                {task.subtasks.map((subtask) => (
                  <li key={subtask.id}>
                    <Link
                      to={`/tasks/${subtask.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2"
                    >
                      {subtask.completedAt ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: subtask.status.color }}
                        />
                      )}
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm',
                          subtask.completedAt ? 'text-muted line-through' : 'text-fg',
                        )}
                      >
                        {subtask.title}
                      </span>
                      {subtask.assignee && (
                        <Avatar name={subtask.assignee.user.name} size="xs" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <FileList taskId={task.id} folder="tasks" title="Attachments" />

          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-fg">Discussion</h3>
            <CommentThread entityType="TASK" entityId={task.id} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Properties" />
            <div className="space-y-4 px-5 py-4">
              {canEdit && statuses.length > 0 && (
                <Select
                  label="Status"
                  value={task.statusId}
                  onChange={(event) => update.mutate({ statusId: event.target.value })}
                  options={statuses.map((status) => ({ value: status.id, label: status.name }))}
                />
              )}

              {can('tasks.assign') ? (
                <Select
                  label="Assignee"
                  value={task.assigneeId ?? ''}
                  onChange={(event) =>
                    update.mutate({ assigneeId: event.target.value || null })
                  }
                  placeholder="Unassigned"
                  options={(employees.data ?? []).map((employee) => ({
                    value: employee.id,
                    label: employee.user.name,
                  }))}
                />
              ) : (
                <Field label="Assignee">
                  {task.assignee ? (
                    <span className="flex items-center gap-2">
                      <Avatar
                        name={task.assignee.user.name}
                        src={task.assignee.user.avatar?.url}
                        size="xs"
                      />
                      {task.assignee.user.name}
                    </span>
                  ) : (
                    'Unassigned'
                  )}
                </Field>
              )}

              {canEdit && (
                <Input
                  label="Due date"
                  type="date"
                  value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                  onChange={(event) =>
                    update.mutate({ dueDate: event.target.value || null })
                  }
                  error={
                    isOverdue(task.dueDate) && !task.completedAt ? 'Past due' : undefined
                  }
                />
              )}

              <FieldGrid cols={2}>
                <Field label="Estimate">
                  {task.estimateHours ? fmtHours(Number(task.estimateHours)) : '—'}
                </Field>
                <Field label="Logged">{fmtHours(Number(task.loggedHours))}</Field>
              </FieldGrid>

              {canEdit && (
                <Checkbox
                  checked={task.visibleToClient}
                  onChange={(event) =>
                    update.mutate({ visibleToClient: event.target.checked })
                  }
                  label="Visible in the client portal"
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Dependencies" />
            <div className="px-5 py-4">
              {task.dependsOn.length === 0 && task.blocking.length === 0 ? (
                <p className="text-sm text-muted">Nothing blocking, nothing blocked.</p>
              ) : (
                <div className="space-y-4">
                  {task.dependsOn.length > 0 && (
                    <div>
                      <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-subtle">
                        Waiting on
                      </p>
                      <ul className="space-y-1.5">
                        {task.dependsOn.map((entry) => (
                          <li key={entry.id} className="flex items-center gap-2 text-sm">
                            {entry.blockingTask.completedAt ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                            ) : (
                              <Ban className="h-3.5 w-3.5 shrink-0 text-warning" />
                            )}
                            <Link
                              to={`/tasks/${entry.blockingTask.id}`}
                              className="min-w-0 flex-1 truncate text-fg hover:underline"
                            >
                              {entry.blockingTask.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {task.blocking.length > 0 && (
                    <div>
                      <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-subtle">
                        Blocking
                      </p>
                      <ul className="space-y-1.5">
                        {task.blocking.map((entry) => (
                          <li key={entry.id} className="flex items-center gap-2 text-sm">
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <Link
                              to={`/tasks/${entry.task.id}`}
                              className="min-w-0 flex-1 truncate text-fg hover:underline"
                            >
                              {entry.task.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {task.timeEntries.length > 0 && (
            <Card>
              <CardHeader title="Time log" />
              <ul className="divide-y divide-border">
                {task.timeEntries.slice(0, 8).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-fg">
                        {entry.employee?.user.name ?? 'Someone'}
                      </span>
                      <span className="block text-2xs text-muted">
                        {fmtDate(entry.workDate)}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {fmtHours(Number(entry.hours))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {loggingTime && (
        <LogTimeModal
          taskId={task.id}
          projectId={task.projectId}
          taskTitle={task.title}
          onClose={() => setLoggingTime(false)}
        />
      )}
      {addingSubtask && statuses.length > 0 && (
        <TaskComposer
          onClose={() => setAddingSubtask(false)}
          projectId={task.projectId ?? undefined}
          retainerCycleId={task.retainerCycleId ?? undefined}
          parentTaskId={task.id}
          statuses={statuses}
        />
      )}
      {editing && (
        <EditTaskModal task={task} onClose={() => setEditing(false)} statuses={statuses} />
      )}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => removeTask.mutate()}
        title="Delete this task?"
        message="The task and its subtasks will be removed. Logged time is kept."
        confirmLabel="Delete task"
        loading={removeTask.isPending}
      />
    </div>
  );
}

export function LogTimeModal({
  taskId,
  projectId,
  taskTitle,
  onClose,
}: {
  taskId?: string;
  projectId?: string | null;
  taskTitle?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    workDate: new Date().toISOString().slice(0, 10),
    hours: '1',
    billable: true,
    note: '',
  });

  const log = useMutation({
    mutationFn: () =>
      apiPost('/time/entries', {
        taskId: taskId ?? null,
        projectId: projectId ?? null,
        workDate: form.workDate,
        hours: Number(form.hours),
        billable: form.billable,
        note: form.note || undefined,
      }),
    onSuccess: () => {
      toast.success('Time logged');
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Log time"
      description={taskTitle}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={log.isPending}
            disabled={!form.hours || Number(form.hours) <= 0}
            onClick={() => log.mutate()}
          >
            Log time
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Date"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={form.workDate}
          onChange={(event) => setForm({ ...form, workDate: event.target.value })}
        />
        <Input
          label="Hours"
          type="number"
          min={0.25}
          max={16}
          step={0.25}
          required
          value={form.hours}
          onChange={(event) => setForm({ ...form, hours: event.target.value })}
          hint="A day cannot exceed 16 hours in total."
        />
        <Checkbox
          checked={form.billable}
          onChange={(event) => setForm({ ...form, billable: event.target.checked })}
          label="Billable"
          description="Counts towards the billable share in reports."
        />
        <Textarea
          label="Note"
          rows={2}
          value={form.note}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
          placeholder="What did you work on?"
        />
      </div>
    </Modal>
  );
}

function EditTaskModal({
  task,
  statuses,
  onClose,
}: {
  task: TaskDetail;
  statuses: TaskStatusRef[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    priority: task.priority as string,
    statusId: task.statusId,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    startDate: task.startDate ? task.startDate.slice(0, 10) : '',
    estimateHours: task.estimateHours ?? '',
  });

  const save = useMutation({
    mutationFn: () =>
      apiPatch(`/tasks/${task.id}`, {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        statusId: form.statusId,
        dueDate: form.dueDate || null,
        startDate: form.startDate || null,
        estimateHours: form.estimateHours === '' ? null : Number(form.estimateHours),
      }),
    onSuccess: () => {
      toast.success('Task updated');
      void queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit task"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <Textarea
          label="Details"
          rows={4}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Status"
            value={form.statusId}
            onChange={(event) => setForm({ ...form, statusId: event.target.value })}
            options={statuses.map((status) => ({ value: status.id, label: status.name }))}
          />
          <Select
            label="Priority"
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
            options={['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => ({
              value,
              label: value.charAt(0) + value.slice(1).toLowerCase(),
            }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Start date"
            type="date"
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
          />
          <Input
            label="Due date"
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
          />
          <Input
            label="Estimate (h)"
            type="number"
            min={0}
            step={0.5}
            value={String(form.estimateHours)}
            onChange={(event) => setForm({ ...form, estimateHours: event.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}
