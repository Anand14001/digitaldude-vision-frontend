import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  Workflow as WorkflowIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost, apiPut, errorMessage } from '@/lib/api';
import { cn, humanise } from '@/lib/utils';
import type { ProjectType, TaskStatusCategory, Workflow } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  Input,
  LoadingBlock,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';

const CATEGORIES: TaskStatusCategory[] = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'REVIEW',
  'DONE',
  'CANCELLED',
];

const STAGE_COLOURS = [
  '#8b5cf6',
  '#ec4899',
  '#3b82f6',
  '#14b8a6',
  '#f59e0b',
  '#22c55e',
  '#06b6d4',
  '#f97316',
  '#64748b',
];

interface StageDraft {
  id?: string;
  name: string;
  color: string;
  isTerminal: boolean;
  isClientFacing: boolean;
  description?: string;
  defaultTasks: { id?: string; title: string; dueOffsetDays: number; estimateHours?: string }[];
}

interface StatusDraft {
  id?: string;
  name: string;
  category: TaskStatusCategory;
  color: string;
  isDefault: boolean;
}

/**
 * The workflow builder. Workflows are the backbone of the whole CRM - stages
 * drive project boards, retainer cycles and the client portal's progress bar -
 * so this screen is deliberately explicit rather than clever.
 */
export function WorkflowsTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Workflow | 'new' | null>(null);
  const [duplicating, setDuplicating] = useState<Workflow | null>(null);

  const workflows = useQuery({
    queryKey: ['workflows', 'all'],
    queryFn: () => apiGet<Workflow[]>('/workflows?includeArchived=true'),
  });

  const archive = useMutation({
    mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
      apiPatch(`/workflows/${id}/archive`, { isArchived }),
    onSuccess: () => {
      toast.success('Workflow updated');
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (workflows.isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          A workflow defines the stages work moves through and the task statuses its board uses.
          Projects move between stages freely — entering a stage can seed a checklist of
          default tasks.
        </p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
          New workflow
        </Button>
      </div>

      {workflows.data?.length === 0 ? (
        <Card>
          <EmptyState
            icon={<WorkflowIcon className="h-5 w-5" />}
            title="No workflows yet"
            description="Create one per service line: web development, video, social media."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {workflows.data?.map((workflow) => (
            <Card key={workflow.id} className={cn(workflow.isArchived && 'opacity-60')}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {workflow.name}
                    {workflow.isArchived && <Badge tone="neutral">Archived</Badge>}
                  </span>
                }
                description={
                  workflow.projectType
                    ? `For ${workflow.projectType.name}`
                    : 'Not tied to a project type'
                }
                action={
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Copy className="h-3.5 w-3.5" />}
                      onClick={() => setDuplicating(workflow)}
                      aria-label="Duplicate"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Archive className="h-3.5 w-3.5" />}
                      onClick={() =>
                        archive.mutate({ id: workflow.id, isArchived: !workflow.isArchived })
                      }
                      aria-label={workflow.isArchived ? 'Restore' : 'Archive'}
                    />
                    <Button size="sm" variant="secondary" onClick={() => setEditing(workflow)}>
                      Edit
                    </Button>
                  </div>
                }
              />
              <div className="space-y-3 px-5 py-4">
                <div>
                  <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-subtle">
                    Stages
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {workflow.stages.map((stage) => (
                      <span
                        key={stage.id}
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium"
                        style={{
                          backgroundColor: `${stage.color}1f`,
                          color: stage.color,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                        {stage.defaultTasks?.length ? ` (${stage.defaultTasks.length})` : ''}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-subtle">
                    Task statuses
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {workflow.taskStatuses.map((status) => (
                      <span
                        key={status.id}
                        className="inline-flex items-center gap-1.5 text-2xs text-muted"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                        {status.isDefault && <span className="text-subtle">(default)</span>}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="border-t border-border pt-2.5 text-2xs text-muted">
                  In use by {workflow._count.projects} project
                  {workflow._count.projects === 1 ? '' : 's'} and {workflow._count.retainers}{' '}
                  retainer{workflow._count.retainers === 1 ? '' : 's'}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <WorkflowBuilder
          workflow={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {duplicating && (
        <DuplicateModal workflow={duplicating} onClose={() => setDuplicating(null)} />
      )}
    </div>
  );
}

function WorkflowBuilder({
  workflow,
  onClose,
}: {
  workflow: Workflow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [projectTypeId, setProjectTypeId] = useState(workflow?.projectTypeId ?? '');
  const [stages, setStages] = useState<StageDraft[]>(
    workflow?.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      isTerminal: stage.isTerminal ?? false,
      isClientFacing: stage.isClientFacing ?? false,
      description: stage.description ?? '',
      defaultTasks: stage.defaultTasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueOffsetDays: task.dueOffsetDays,
        estimateHours: task.estimateHours ? String(task.estimateHours) : '',
      })),
    })) ?? [
      {
        name: 'Discovery',
        color: STAGE_COLOURS[0] as string,
        isTerminal: false,
        isClientFacing: true,
        defaultTasks: [],
      },
      {
        name: 'Delivered',
        color: '#22c55e',
        isTerminal: true,
        isClientFacing: true,
        defaultTasks: [],
      },
    ],
  );
  const [statuses, setStatuses] = useState<StatusDraft[]>(
    workflow?.taskStatuses.map((status) => ({
      id: status.id,
      name: status.name,
      category: status.category,
      color: status.color,
      isDefault: status.isDefault ?? false,
    })) ?? [
      { name: 'To Do', category: 'TODO', color: '#64748b', isDefault: true },
      { name: 'In Progress', category: 'IN_PROGRESS', color: '#3b82f6', isDefault: false },
      { name: 'In Review', category: 'REVIEW', color: '#f59e0b', isDefault: false },
      { name: 'Done', category: 'DONE', color: '#22c55e', isDefault: false },
    ],
  );
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const projectTypes = useQuery({
    queryKey: ['options', 'project-types'],
    queryFn: () => apiGet<ProjectType[]>('/masters/project-types'),
  });

  const payload = () => ({
    name,
    description: description || undefined,
    projectTypeId: projectTypeId || null,
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      isTerminal: stage.isTerminal,
      isClientFacing: stage.isClientFacing,
      description: stage.description || undefined,
      defaultTasks: stage.defaultTasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueOffsetDays: Number(task.dueOffsetDays) || 0,
        estimateHours: task.estimateHours ? Number(task.estimateHours) : undefined,
      })),
    })),
    taskStatuses: statuses,
  });

  const save = useMutation({
    mutationFn: () =>
      workflow
        ? apiPut(`/workflows/${workflow.id}`, payload())
        : apiPost('/workflows', payload()),
    onSuccess: () => {
      toast.success(workflow ? 'Workflow saved' : 'Workflow created');
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= stages.length) return;
    setStages((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });
  };

  const defaultCount = statuses.filter((status) => status.isDefault).length;
  const hasDone = statuses.some((status) => status.category === 'DONE');
  const valid =
    name.trim().length >= 2 &&
    stages.length > 0 &&
    stages.every((stage) => stage.name.trim().length >= 2) &&
    statuses.length > 0 &&
    defaultCount === 1 &&
    hasDone;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={workflow ? `Edit ${workflow.name}` : 'New workflow'}
      description="Stages run left to right on the project board."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
            {workflow ? 'Save workflow' : 'Create workflow'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Workflow name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Website Development Pipeline"
          />
          <Select
            label="For project type"
            value={projectTypeId}
            onChange={(event) => setProjectTypeId(event.target.value)}
            placeholder="Any type"
            options={(projectTypes.data ?? []).map((type) => ({
              value: type.id,
              label: type.name,
            }))}
          />
        </div>

        <Textarea
          label="Description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {/* ---------------- stages ---------------- */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">Stages ({stages.length})</h3>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() =>
                setStages((current) => [
                  ...current,
                  {
                    name: '',
                    color: STAGE_COLOURS[current.length % STAGE_COLOURS.length] as string,
                    isTerminal: false,
                    isClientFacing: false,
                    defaultTasks: [],
                  },
                ])
              }
            >
              Add stage
            </Button>
          </div>

          <ul className="space-y-2">
            {stages.map((stage, index) => (
              <li key={stage.id ?? `new-${index}`} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="text-subtle hover:text-fg disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <span className="w-5 text-center text-2xs text-subtle">{index + 1}</span>

                  <input
                    type="color"
                    value={stage.color}
                    onChange={(event) =>
                      setStages((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, color: event.target.value } : entry,
                        ),
                      )
                    }
                    className="h-8 w-8 cursor-pointer rounded-lg border border-border bg-transparent"
                    aria-label="Stage colour"
                  />

                  <input
                    value={stage.name}
                    onChange={(event) =>
                      setStages((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, name: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder="Stage name"
                    className="dd-input flex-1 min-w-[10rem]"
                  />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedStage(expandedStage === index ? null : index)}
                  >
                    {stage.defaultTasks.length} task
                    {stage.defaultTasks.length === 1 ? '' : 's'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setStages((current) => current.filter((_, i) => i !== index))}
                    aria-label="Remove stage"
                    className="rounded-md p-1.5 text-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-4 pl-12">
                  <Checkbox
                    checked={stage.isTerminal}
                    onChange={(event) =>
                      setStages((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, isTerminal: event.target.checked } : entry,
                        ),
                      )
                    }
                    label="Completes the project"
                  />
                  <Checkbox
                    checked={stage.isClientFacing}
                    onChange={(event) =>
                      setStages((current) =>
                        current.map((entry, i) =>
                          i === index
                            ? { ...entry, isClientFacing: event.target.checked }
                            : entry,
                        ),
                      )
                    }
                    label="Waiting on the client"
                  />
                </div>

                {expandedStage === index && (
                  <div className="mt-3 rounded-lg bg-surface-2/60 p-3 pl-12">
                    <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-subtle">
                      Default tasks created on entering this stage
                    </p>
                    <ul className="space-y-1.5">
                      {stage.defaultTasks.map((task, taskIndex) => (
                        <li key={task.id ?? `t-${taskIndex}`} className="flex items-center gap-2">
                          <input
                            value={task.title}
                            onChange={(event) =>
                              setStages((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        defaultTasks: entry.defaultTasks.map((t, ti) =>
                                          ti === taskIndex
                                            ? { ...t, title: event.target.value }
                                            : t,
                                        ),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="Task title"
                            className="dd-input flex-1"
                          />
                          <input
                            type="number"
                            min={0}
                            value={task.dueOffsetDays}
                            onChange={(event) =>
                              setStages((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        defaultTasks: entry.defaultTasks.map((t, ti) =>
                                          ti === taskIndex
                                            ? { ...t, dueOffsetDays: Number(event.target.value) }
                                            : t,
                                        ),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            title="Due this many days after entering the stage"
                            className="dd-input w-20"
                          />
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={task.estimateHours ?? ''}
                            placeholder="h"
                            onChange={(event) =>
                              setStages((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        defaultTasks: entry.defaultTasks.map((t, ti) =>
                                          ti === taskIndex
                                            ? { ...t, estimateHours: event.target.value }
                                            : t,
                                        ),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            className="dd-input w-16"
                          />
                          <button
                            type="button"
                            aria-label="Remove task"
                            onClick={() =>
                              setStages((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        defaultTasks: entry.defaultTasks.filter(
                                          (_, ti) => ti !== taskIndex,
                                        ),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            className="text-subtle hover:text-danger"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setStages((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  defaultTasks: [
                                    ...entry.defaultTasks,
                                    { title: '', dueOffsetDays: 0, estimateHours: '' },
                                  ],
                                }
                              : entry,
                          ),
                        )
                      }
                    >
                      Add default task
                    </Button>
                    <p className="mt-1.5 text-2xs text-subtle">
                      Columns: title, days until due, estimated hours.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------- task statuses ---------------- */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">
              Task statuses ({statuses.length})
            </h3>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() =>
                setStatuses((current) => [
                  ...current,
                  { name: '', category: 'TODO', color: '#64748b', isDefault: false },
                ])
              }
            >
              Add status
            </Button>
          </div>

          <ul className="space-y-2">
            {statuses.map((status, index) => (
              <li key={status.id ?? `s-${index}`} className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={status.color}
                  onChange={(event) =>
                    setStatuses((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, color: event.target.value } : entry,
                      ),
                    )
                  }
                  className="h-8 w-8 cursor-pointer rounded-lg border border-border bg-transparent"
                  aria-label="Status colour"
                />
                <input
                  value={status.name}
                  onChange={(event) =>
                    setStatuses((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, name: event.target.value } : entry,
                      ),
                    )
                  }
                  placeholder="Status name"
                  className="dd-input flex-1 min-w-[9rem]"
                />
                <Select
                  value={status.category}
                  onChange={(event) =>
                    setStatuses((current) =>
                      current.map((entry, i) =>
                        i === index
                          ? { ...entry, category: event.target.value as TaskStatusCategory }
                          : entry,
                      ),
                    )
                  }
                  className="w-40"
                  options={CATEGORIES.map((value) => ({ value, label: humanise(value) }))}
                />
                <label className="flex items-center gap-1.5 text-2xs text-muted">
                  <input
                    type="radio"
                    name="default-status"
                    className="accent-primary"
                    checked={status.isDefault}
                    onChange={() =>
                      setStatuses((current) =>
                        current.map((entry, i) => ({ ...entry, isDefault: i === index })),
                      )
                    }
                  />
                  Default
                </label>
                <button
                  type="button"
                  aria-label="Remove status"
                  onClick={() => setStatuses((current) => current.filter((_, i) => i !== index))}
                  className="rounded-md p-1.5 text-subtle hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {(defaultCount !== 1 || !hasDone) && (
            <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              {defaultCount !== 1 && 'Mark exactly one status as the default for new tasks. '}
              {!hasDone && 'At least one status must use the Done category.'}
            </p>
          )}
        </section>

        {workflow && (workflow._count.projects > 0 || workflow._count.retainers > 0) && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            This workflow is live. Removing a stage or status that current work sits in will be
            refused rather than orphaning that work.
          </p>
        )}
      </div>
    </Modal>
  );
}

function DuplicateModal({
  workflow,
  onClose,
}: {
  workflow: Workflow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(`${workflow.name} (copy)`);

  const duplicate = useMutation({
    mutationFn: () => apiPost(`/workflows/${workflow.id}/duplicate`, { name }),
    onSuccess: () => {
      toast.success('Workflow duplicated');
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Duplicate workflow"
      description="Copies every stage, default task and status."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={duplicate.isPending}
            disabled={name.trim().length < 2}
            onClick={() => duplicate.mutate()}
          >
            Duplicate
          </Button>
        </>
      }
    >
      <Input
        label="New name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
    </Modal>
  );
}
