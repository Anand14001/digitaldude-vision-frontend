import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Paperclip, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDue, isOverdue } from '@/lib/utils';
import type { TaskBoard as TaskBoardType, TaskListItem, TaskStatusRef } from '@/types/api';
import { Avatar, Badge, EmptyState } from '@/components/ui';
import { PriorityBadge } from '@/components/domain';
import { TaskComposer } from './TaskComposer';

/**
 * Status board with drag-and-drop between columns, implemented with the native
 * HTML drag API: no extra dependency, and it degrades to the task detail page
 * on touch devices where dragging is awkward anyway.
 */
export function TaskBoard({
  board,
  projectId,
  retainerCycleId,
  workflow,
  stageId,
}: {
  board: TaskBoardType | undefined;
  projectId?: string;
  retainerCycleId?: string;
  workflow: { taskStatuses: TaskStatusRef[] };
  stageId?: string | null;
}) {
  const queryClient = useQueryClient();
  const { can, user } = useAuth();
  const [dragging, setDragging] = useState<TaskListItem | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [composerStatus, setComposerStatus] = useState<string | null>(null);

  const move = useMutation({
    mutationFn: ({ taskId, statusId }: { taskId: string; statusId: string }) =>
      apiPost(`/tasks/${taskId}/move`, { statusId, sortOrder: 0 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (caught) => {
      toast.error(errorMessage(caught));
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Decided per card, not once for the board: someone who may only move their
  // own work should not be able to pick up a colleague's card and be refused by
  // the server after the fact.
  const canMoveAny = can('tasks.update');
  const canMove = (task: TaskListItem) =>
    canMoveAny ||
    (can('tasks.update.assigned', 'tasks.status.assigned') &&
      task.assignee?.id === user?.employee?.id);

  if (!board) return null;

  return (
    <>
      <div className="dd-board">
        {board.columns.map((column) => (
          <section
            key={column.status.id}
            onDragOver={(event) => {
              if (!dragging) return;
              event.preventDefault();
              setOverColumn(column.status.id);
            }}
            onDragLeave={() => setOverColumn(null)}
            onDrop={() => {
              setOverColumn(null);
              if (dragging && dragging.status.id !== column.status.id) {
                move.mutate({ taskId: dragging.id, statusId: column.status.id });
              }
              setDragging(null);
            }}
            className="flex w-[17.5rem] shrink-0 flex-col"
          >
            <header className="mb-2 flex items-center gap-2 px-1">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: column.status.color }}
              />
              <h3 className="text-sm font-semibold text-fg">{column.status.name}</h3>
              <span className="text-xs text-muted">{column.tasks.length}</span>
              {can('tasks.create') && (
                <button
                  type="button"
                  onClick={() => setComposerStatus(column.status.id)}
                  className="ml-auto rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                  aria-label={`Add a task in ${column.status.name}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </header>

            <div
              className={cn(
                'flex-1 space-y-2 rounded-xl p-2 transition-colors',
                overColumn === column.status.id
                  ? 'bg-primary-soft ring-2 ring-primary/40'
                  : 'bg-surface-2/50',
              )}
            >
              {column.tasks.length === 0 ? (
                <p className="py-6 text-center text-xs text-subtle">
                  {overColumn === column.status.id ? 'Drop here' : 'Nothing here'}
                </p>
              ) : (
                column.tasks.map((task) => (
                  <article
                    key={task.id}
                    draggable={canMove(task)}
                    onDragStart={() => setDragging(task)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOverColumn(null);
                    }}
                    className={cn(
                      'dd-card p-3 transition-all',
                      canMove(task) && 'cursor-grab active:cursor-grabbing',
                      dragging?.id === task.id && 'opacity-40',
                    )}
                  >
                    <Link to={`/tasks/${task.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-fg">
                          {task.title}
                        </p>
                        <PriorityBadge value={task.priority} compact />
                      </div>
                      <p className="mt-1 font-mono text-2xs text-subtle">{task.reference}</p>

                      {(task._count.checklist > 0 || task._count.files > 0) && (
                        <div className="mt-2 flex items-center gap-3 text-2xs text-muted">
                          {task._count.checklist > 0 && (
                            <span className="flex items-center gap-1">
                              <CheckSquare className="h-3 w-3" />
                              {task._count.checklist}
                            </span>
                          )}
                          {task._count.files > 0 && (
                            <span className="flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {task._count.files}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        {task.assignee ? (
                          <Avatar
                            name={task.assignee.user.name}
                            src={task.assignee.user.avatar?.url}
                            size="xs"
                          />
                        ) : (
                          <span className="text-2xs text-subtle">Unassigned</span>
                        )}
                        {task.dueDate && (
                          <span
                            className={cn(
                              'text-2xs',
                              isOverdue(task.dueDate) && !task.completedAt
                                ? 'font-medium text-danger'
                                : 'text-muted',
                            )}
                          >
                            {fmtDue(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </Link>
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      {board.columns.length === 0 && (
        <EmptyState
          title="This workflow has no task statuses"
          description="Add statuses to the workflow in Settings before using the board."
        />
      )}

      {composerStatus && (
        <TaskComposer
          onClose={() => setComposerStatus(null)}
          projectId={projectId}
          retainerCycleId={retainerCycleId}
          statusId={composerStatus}
          stageId={stageId ?? undefined}
          statuses={workflow.taskStatuses}
        />
      )}
    </>
  );
}

/** Compact status pill used in task lists. */
export function TaskStatusPill({ status }: { status: TaskStatusRef }) {
  return (
    <Badge
      tone="neutral"
      className="border-transparent"
      // Workflow colours are user-defined, so they come through as inline style.
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
      {status.name}
    </Badge>
  );
}
