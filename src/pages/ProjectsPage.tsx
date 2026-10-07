import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Building2, FolderKanban, LayoutGrid, List, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, fmtDate, fmtDue, isOverdue } from '@/lib/utils';
import type {
  ClientListItem,
  EmployeeListItem,
  ProjectBoard,
  ProjectListItem,
  ProjectType,
  Workflow,
} from '@/types/api';
import {
  AvatarGroup,
  Badge,
  Button,
  Card,
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
import { HealthBadge, PriorityBadge, ProjectStatusBadge } from '@/components/domain';
import { FilterBar, FilterSelect, TableCard, ViewToggle } from '@/components/ListShell';

const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const HEALTHS = ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'] as const;

export function ProjectsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [view, setView] = useState<'list' | 'board'>('list');
  const [creating, setCreating] = useState(false);

  const list = useListState(
    {
      kind: undefined,
      status: undefined,
      priority: undefined,
      health: undefined,
      clientId: undefined,
    },
    25,
  );

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<ProjectListItem>(
    ['projects'],
    '/projects',
    list.queryParams,
    { enabled: view === 'list' },
  );

  const clients = useQuery({
    queryKey: ['options', 'clients'],
    queryFn: () => apiGet<{ id: string; name: string }[]>('/clients/options/all'),
    staleTime: 300_000,
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every piece of delivery work, grouped the way its workflow defines."
        actions={
          <>
            <ViewToggle
              view={view}
              onChange={(value) => setView(value as 'list' | 'board')}
              views={[
                { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" /> },
                { value: 'board', label: 'Board', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
              ]}
            />
            {can('projects.create') && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                New project
              </Button>
            )}
          </>
        }
      />

      {view === 'list' ? (
        <>
          <FilterBar
            search={list.search}
            onSearch={list.setSearch}
            placeholder="Search by name, code or client…"
            activeCount={list.activeFilterCount}
            onReset={list.resetFilters}
          >
            <FilterSelect
              value={list.filters.kind}
              onChange={(value) => list.setFilter('kind', value)}
              options={[
                { value: 'CLIENT', label: 'Client work' },
                { value: 'INTERNAL', label: 'Internal' },
              ]}
              allLabel="Client and internal"
            />
            <FilterSelect
              value={list.filters.status}
              onChange={(value) => list.setFilter('status', value)}
              options={STATUSES}
              allLabel="All statuses"
            />
            <FilterSelect
              value={list.filters.health}
              onChange={(value) => list.setFilter('health', value)}
              options={HEALTHS}
              allLabel="All health"
            />
            <FilterSelect
              value={list.filters.priority}
              onChange={(value) => list.setFilter('priority', value)}
              options={PRIORITIES}
              allLabel="All priorities"
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
          </FilterBar>

          {error ? (
            <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
          ) : (
            <TableCard meta={data?.meta} onPageChange={list.setPage}>
              <Table className={cn(isFetching && 'opacity-60 transition-opacity')}>
                <THead>
                  <tr>
                    <TH>Project</TH>
                    <TH>Client</TH>
                    <TH>Stage</TH>
                    <TH>Status</TH>
                    <TH>Health</TH>
                    <TH>Team</TH>
                    <TH>Due</TH>
                  </tr>
                </THead>
                <TBody>
                  {isLoading ? (
                    <SkeletonRows rows={8} cols={7} />
                  ) : data?.data.length === 0 ? (
                    <tr>
                      <TD colSpan={7}>
                        <EmptyState
                          icon={<FolderKanban className="h-5 w-5" />}
                          title="No projects match"
                          description={
                            list.activeFilterCount
                              ? 'Try clearing a filter.'
                              : 'Create the first project to get started.'
                          }
                          action={
                            can('projects.create') ? (
                              <Button size="sm" onClick={() => setCreating(true)}>
                                New project
                              </Button>
                            ) : undefined
                          }
                        />
                      </TD>
                    </tr>
                  ) : (
                    data?.data.map((project) => (
                      <TRow key={project.id} onClick={() => navigate(`/projects/${project.id}`)}>
                        <TD>
                          <div className="flex items-center gap-2">
                            <PriorityBadge value={project.priority} compact />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-fg">{project.name}</p>
                              <p className="text-2xs text-muted">
                                {project.code}
                                {project.serviceLine ? ` · ${project.serviceLine.name}` : ''}
                              </p>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          {project.client ? (
                            <span className="text-muted">{project.client.name}</span>
                          ) : (
                            <Badge tone="neutral">Internal</Badge>
                          )}
                        </TD>
                        <TD>
                          {project.currentStage ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs"
                              style={{ color: project.currentStage.color }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: project.currentStage.color }}
                              />
                              {project.currentStage.name}
                            </span>
                          ) : (
                            <span className="text-xs text-subtle">—</span>
                          )}
                        </TD>
                        <TD>
                          <ProjectStatusBadge value={project.status} />
                        </TD>
                        <TD>
                          <HealthBadge value={project.health} />
                        </TD>
                        <TD>
                          <AvatarGroup
                            people={project.members.map((member) => ({
                              name: member.employee.user.name,
                              src: member.employee.user.avatar?.url,
                            }))}
                            max={3}
                          />
                        </TD>
                        <TD
                          className={cn(
                            'whitespace-nowrap text-xs',
                            isOverdue(project.dueDate) &&
                              project.status !== 'COMPLETED' &&
                              'font-medium text-danger',
                          )}
                        >
                          {project.dueDate ? fmtDate(project.dueDate, 'dd MMM yy') : '—'}
                        </TD>
                      </TRow>
                    ))
                  )}
                </TBody>
              </Table>
            </TableCard>
          )}
        </>
      ) : (
        <ProjectBoardView />
      )}

      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}

/** Kanban across the stages of one workflow - the agency's pipeline view. */
function ProjectBoardView() {
  const navigate = useNavigate();
  const [workflowId, setWorkflowId] = useState<string>('');

  const workflows = useQuery({
    queryKey: ['workflows'],
    queryFn: () => apiGet<Workflow[]>('/workflows'),
    staleTime: 300_000,
  });

  const selected = workflowId || workflows.data?.[0]?.id || '';

  const board = useQuery({
    queryKey: ['projects', 'board', selected],
    queryFn: () => apiGet<ProjectBoard>('/projects/board', { workflowId: selected }),
    enabled: Boolean(selected),
  });

  if (workflows.isLoading) return <Card className="h-64 animate-pulse" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={selected}
          onChange={(event) => setWorkflowId(event.target.value)}
          className="w-auto min-w-[16rem]"
        >
          {workflows.data?.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name} ({workflow._count.projects})
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted">
          Projects move freely between stages — entering a stage adds its checklist tasks.
        </p>
      </div>

      {board.isLoading ? (
        <div className="dd-board">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="dd-skeleton h-72 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <div className="dd-board">
          {board.data?.stages.map((stage) => (
            <section key={stage.id} className="flex w-72 shrink-0 flex-col">
              <header className="mb-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="text-sm font-semibold text-fg">{stage.name}</h3>
                <span className="text-xs text-muted">{stage.projects.length}</span>
                {stage.isClientFacing && (
                  <Badge tone="info" className="ml-auto">
                    Client
                  </Badge>
                )}
              </header>
              <div className="flex-1 space-y-2 rounded-xl bg-surface-2/50 p-2">
                {stage.projects.length === 0 ? (
                  <p className="py-6 text-center text-xs text-subtle">Nothing here</p>
                ) : (
                  stage.projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="dd-card w-full p-3 text-left transition-shadow hover:shadow-pop"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                          {project.name}
                        </p>
                        <PriorityBadge value={project.priority} compact />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {project.client?.name ?? 'Internal'}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <AvatarGroup
                          people={project.members.map((member) => ({
                            name: member.employee.user.name,
                            src: member.employee.user.avatar?.url,
                          }))}
                          max={3}
                        />
                        <span
                          className={cn(
                            'text-2xs',
                            isOverdue(project.dueDate) ? 'font-medium text-danger' : 'text-muted',
                          )}
                        >
                          {fmtDue(project.dueDate)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    kind: 'CLIENT' as 'CLIENT' | 'INTERNAL',
    clientId: '',
    projectTypeId: '',
    workflowId: '',
    managerId: '',
    priority: 'MEDIUM',
    startDate: '',
    dueDate: '',
    budgetAmount: '',
    description: '',
    memberIds: [] as string[],
    seedDefaultTasks: true,
  });

  const clients = useQuery({
    queryKey: ['options', 'clients'],
    queryFn: () => apiGet<ClientListItem[]>('/clients/options/all'),
  });
  const projectTypes = useQuery({
    queryKey: ['options', 'project-types'],
    queryFn: () => apiGet<ProjectType[]>('/masters/project-types'),
  });
  const workflows = useQuery({
    queryKey: ['workflows'],
    queryFn: () => apiGet<Workflow[]>('/workflows'),
  });
  const employees = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>('/projects', {
        name: form.name,
        kind: form.kind,
        clientId: form.kind === 'INTERNAL' ? null : form.clientId,
        projectTypeId: form.projectTypeId || null,
        workflowId: form.workflowId,
        managerId: form.managerId || null,
        priority: form.priority,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : null,
        description: form.description || undefined,
        memberIds: form.memberIds,
        seedDefaultTasks: form.seedDefaultTasks,
      }),
    onSuccess: (project) => {
      toast.success('Project created');
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
      navigate(`/projects/${project.id}`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  // Picking a project type pre-selects its default workflow, which is almost
  // always the one wanted.
  const onTypeChange = (typeId: string) => {
    const type = projectTypes.data?.find((entry) => entry.id === typeId);
    setForm((current) => ({
      ...current,
      projectTypeId: typeId,
      workflowId: type?.defaultWorkflowId ?? current.workflowId,
    }));
  };

  const typeOptions = projectTypes.data ?? [];

  const ready =
    form.name.length >= 2 &&
    form.workflowId &&
    (form.kind === 'INTERNAL' || Boolean(form.clientId));

  return (
    <Modal
      open
      onClose={onClose}
      title="New project"
      description="Pick a workflow and the stages come with it."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!ready}
            onClick={() => create.mutate()}
          >
            Create project
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Asked first, because it decides whether a client is needed at all. */}
        <div>
          <span className="dd-label">What kind of project is this?</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  value: 'CLIENT' as const,
                  title: 'Client project',
                  hint: 'Delivered for a client. Appears in their portal.',
                  icon: <Briefcase className="h-4 w-4" />,
                },
                {
                  value: 'INTERNAL' as const,
                  title: 'Internal project',
                  hint: "Our own work — no client, never shown in a portal.",
                  icon: <Building2 className="h-4 w-4" />,
                },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    kind: option.value,
                    // Dropping the client avoids sending a stale one after a switch.
                    clientId: option.value === 'INTERNAL' ? '' : form.clientId,
                  })
                }
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                  form.kind === option.value
                    ? 'border-primary bg-primary-soft'
                    : 'border-border hover:border-border-strong',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5',
                    form.kind === option.value ? 'text-primary' : 'text-muted',
                  )}
                >
                  {option.icon}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      form.kind === option.value ? 'text-primary' : 'text-fg',
                    )}
                  >
                    {option.title}
                  </span>
                  <span className="block text-2xs text-muted">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Project name"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder={
            form.kind === 'INTERNAL'
              ? 'e.g. Digital Dude website refresh'
              : 'e.g. LetsPropStore website revamp'
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {form.kind === 'CLIENT' ? (
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
          ) : (
            <div>
              <span className="dd-label">Client</span>
              <div className="flex h-9 items-center rounded-lg border border-dashed border-border px-3 text-sm text-muted">
                Not applicable for internal work
              </div>
            </div>
          )}
          <Select
            label="Project type"
            value={form.projectTypeId}
            onChange={(event) => onTypeChange(event.target.value)}
            placeholder="Select a type"
            options={typeOptions.map((type) => ({ value: type.id, label: type.name }))}
          />
        </div>

        <Select
          label="Workflow"
          required
          value={form.workflowId}
          onChange={(event) => setForm({ ...form, workflowId: event.target.value })}
          placeholder="Select a workflow"
          hint="Stages and task statuses come from the workflow and cannot change later."
          options={(workflows.data ?? []).map((workflow) => ({
            value: workflow.id,
            label: `${workflow.name} (${workflow.stages.length} stages)`,
          }))}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Priority"
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
            options={PRIORITIES.map((value) => ({
              value,
              label: value.charAt(0) + value.slice(1).toLowerCase(),
            }))}
          />
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Project manager"
            value={form.managerId}
            onChange={(event) => setForm({ ...form, managerId: event.target.value })}
            placeholder="Unassigned"
            options={(employees.data ?? []).map((employee) => ({
              value: employee.id,
              label: employee.user.name,
            }))}
          />
          <Input
            label="Budget"
            type="number"
            min={0}
            value={form.budgetAmount}
            onChange={(event) => setForm({ ...form, budgetAmount: event.target.value })}
            prefix="₹"
            placeholder="0"
          />
        </div>

        <div>
          <span className="dd-label">Team</span>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
            {(employees.data ?? []).map((employee) => (
              <label
                key={employee.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border-strong accent-primary"
                  checked={form.memberIds.includes(employee.id)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      memberIds: event.target.checked
                        ? [...form.memberIds, employee.id]
                        : form.memberIds.filter((id) => id !== employee.id),
                    })
                  }
                />
                <span className="text-sm text-fg">{employee.user.name}</span>
                <span className="text-xs text-muted">{employee.designation?.title}</span>
              </label>
            ))}
          </div>
          <p className="dd-hint">
            {form.memberIds.length} selected · they will be notified
          </p>
        </div>

        <Textarea
          label="Brief"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="Scope, deliverables, anything the team should know."
        />

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border-strong accent-primary"
            checked={form.seedDefaultTasks}
            onChange={(event) => setForm({ ...form, seedDefaultTasks: event.target.checked })}
          />
          <span>
            <span className="block text-sm text-fg">Create the first stage’s tasks</span>
            <span className="block text-xs text-muted">
              Adds the checklist defined on the workflow’s first stage.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

export { CreateProjectModal };
