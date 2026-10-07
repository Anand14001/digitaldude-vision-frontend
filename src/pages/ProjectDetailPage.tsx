import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Flag,
  Plus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost, apiPut, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtCurrency, fmtDate, fmtHours, humanise, isOverdue } from '@/lib/utils';
import type {
  EmployeeListItem,
  ProjectDetail,
  TaskBoard as TaskBoardType,
} from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
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
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
} from '@/components/ui';
import { HealthBadge, PriorityBadge, ProjectStatusBadge, StageTrack } from '@/components/domain';
import { TaskBoard } from '@/features/TaskBoard';
import { CommentThread } from '@/features/CommentThread';
import { FileList } from '@/features/FileList';

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [tab, setTab] = useState('board');
  const [movingStage, setMovingStage] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);

  const { data: project, isLoading, error, refetch } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiGet<ProjectDetail>(`/projects/${id}`),
    enabled: Boolean(id),
  });

  const board = useQuery({
    queryKey: ['tasks', 'board', { projectId: id }],
    queryFn: () => apiGet<TaskBoardType>('/tasks/board', { projectId: id }),
    enabled: Boolean(id) && tab === 'board',
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!project) return null;

  const stages = project.workflow.stages;
  const currentIndex = stages.findIndex((stage) => stage.id === project.currentStage?.id);
  const nextStage = currentIndex >= 0 ? stages[currentIndex + 1] : stages[0];

  const doneCount = project.taskBreakdown.reduce((sum, row) => {
    const status = project.workflow.taskStatuses.find((entry) => entry.id === row.statusId);
    return status?.category === 'DONE' ? sum + row._count._all : sum;
  }, 0);
  const totalTasks = project.taskBreakdown.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Link to="/projects" className="hover:text-fg">
            Projects
          </Link>
        }
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="font-mono text-xs">{project.code}</span>
            <span>·</span>
            {project.client ? (
              <Link to={`/clients/${project.client.id}`} className="text-primary hover:underline">
                {project.client.name}
              </Link>
            ) : (
              <span>Internal project</span>
            )}
            {project.serviceLine && (
              <>
                <span>·</span>
                <span>{project.serviceLine.name}</span>
              </>
            )}
          </span>
        }
        meta={
          <>
            <ProjectStatusBadge value={project.status} />
            <HealthBadge value={project.health} />
            <PriorityBadge value={project.priority} />
            {project.kind === 'INTERNAL' && <Badge tone="neutral">Internal</Badge>}
            {project.kind === 'CLIENT' && project.visibleToClient && (
              <Badge tone="info">Visible to client</Badge>
            )}
          </>
        }
        actions={
          <>
            {can('projects.stage.move') && nextStage && project.status !== 'COMPLETED' && (
              <Button
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() => setMovingStage(true)}
              >
                Move to {nextStage.name}
              </Button>
            )}
            {can('projects.members.manage') && (
              <Button
                variant="secondary"
                icon={<Users className="h-4 w-4" />}
                onClick={() => setEditingTeam(true)}
              >
                Team
              </Button>
            )}
          </>
        }
      />

      {/* Stage track: the one thing everyone looks at first. */}
      <Card className="mb-6 p-5">
        <StageTrack
          stages={stages}
          currentStageId={project.currentStage?.id}
          complete={project.status === 'COMPLETED'}
        />
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Task progress</p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-fg">
            {doneCount} / {totalTasks}
          </p>
          <ProgressBar
            className="mt-2"
            value={totalTasks ? (doneCount / totalTasks) * 100 : 0}
            tone="success"
          />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Logged time</p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-fg">
            {fmtHours(Number(project.loggedHours))}
          </p>
          {project.estimateHours && (
            <p className="mt-1 text-2xs text-muted">
              of {fmtHours(Number(project.estimateHours))} estimated
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Due date</p>
          <p
            className={cn(
              'mt-1.5 text-lg font-semibold',
              isOverdue(project.dueDate) && project.status !== 'COMPLETED'
                ? 'text-danger'
                : 'text-fg',
            )}
          >
            {fmtDate(project.dueDate)}
          </p>
          {project.completedAt && (
            <p className="mt-1 text-2xs text-success">
              Delivered {fmtDate(project.completedAt)}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">
            {project.budgetAmount !== undefined ? 'Budget' : 'Deliverables'}
          </p>
          <p className="mt-1.5 text-lg font-semibold text-fg">
            {project.budgetAmount !== undefined
              ? fmtCurrency(project.budgetAmount, project.currency)
              : project._count.deliverables}
          </p>
        </Card>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab value="board">Board</Tab>
          <Tab value="overview">Overview</Tab>
          <Tab value="milestones" count={project.milestones.length}>
            Milestones
          </Tab>
          <Tab value="team" count={project.members.length}>
            Team
          </Tab>
          <Tab value="files" count={project._count.files}>
            Files
          </Tab>
          <Tab value="discussion">Discussion</Tab>
          <Tab value="history">History</Tab>
        </TabList>

        <TabPanel value="board">
          {board.isLoading ? (
            <LoadingBlock />
          ) : (
            <TaskBoard
              board={board.data}
              projectId={project.id}
              workflow={project.workflow}
              stageId={project.currentStage?.id ?? null}
            />
          )}
        </TabPanel>

        <TabPanel value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Details" />
              <div className="px-5 py-4">
                <FieldGrid>
                  <Field label="Client">
                    {project.client ? project.client.name : 'Internal — no client'}
                  </Field>
                  <Field label="Project type">{project.projectType?.name}</Field>
                  <Field label="Service line">{project.serviceLine?.name}</Field>
                  <Field label="Workflow">
                    {can('settings.workflows.manage') ? (
                      <Link
                        to={`/workflows?open=${project.workflow.id}`}
                        className="text-primary hover:underline"
                      >
                        {project.workflow.name}
                      </Link>
                    ) : (
                      project.workflow.name
                    )}
                  </Field>
                  <Field label="Manager">{project.manager?.user.name}</Field>
                  <Field label="Current stage">{project.currentStage?.name}</Field>
                  <Field label="Start date">{fmtDate(project.startDate)}</Field>
                  <Field label="Due date">{fmtDate(project.dueDate)}</Field>
                  <Field label="Created">{fmtDate(project.createdAt)}</Field>
                </FieldGrid>
                {project.description && (
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="text-2xs font-medium uppercase tracking-wide text-subtle">
                      Brief
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-fg">
                      {project.description}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Task breakdown" />
              <div className="space-y-2.5 px-5 py-4">
                {project.workflow.taskStatuses.map((status) => {
                  const count =
                    project.taskBreakdown.find((row) => row.statusId === status.id)?._count._all ?? 0;
                  return (
                    <div key={status.id} className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="flex-1 text-sm text-fg">{status.name}</span>
                      <span className="text-sm tabular-nums text-muted">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="milestones">
          <Card>
            <CardHeader
              title="Milestones"
              action={
                can('projects.update') ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setAddingMilestone(true)}
                  >
                    Add
                  </Button>
                ) : undefined
              }
            />
            {project.milestones.length === 0 ? (
              <EmptyState
                compact
                icon={<Flag className="h-5 w-5" />}
                title="No milestones"
                description="Add the dates the client is counting on."
              />
            ) : (
              <ul className="divide-y divide-border">
                {project.milestones.map((milestone) => (
                  <li key={milestone.id} className="flex items-start gap-3 px-5 py-3">
                    <Checkbox
                      checked={Boolean(milestone.completedAt)}
                      disabled={!can('projects.update')}
                      onChange={(event) => {
                        void apiPatch(`/projects/milestones/${milestone.id}`, {
                          completed: event.target.checked,
                        })
                          .then(() => {
                            void queryClient.invalidateQueries({ queryKey: ['project', id] });
                          })
                          .catch((caught) => toast.error(errorMessage(caught)));
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          milestone.completedAt ? 'text-muted line-through' : 'text-fg',
                        )}
                      >
                        {milestone.title}
                      </p>
                      {milestone.description && (
                        <p className="mt-0.5 text-xs text-muted">{milestone.description}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-xs',
                        !milestone.completedAt && isOverdue(milestone.dueDate)
                          ? 'font-medium text-danger'
                          : 'text-muted',
                      )}
                    >
                      {fmtDate(milestone.dueDate, 'dd MMM yy')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="team">
          <Card>
            <CardHeader
              title="Project team"
              description="Allocation feeds the workload report."
              action={
                can('projects.members.manage') ? (
                  <Button size="sm" variant="secondary" onClick={() => setEditingTeam(true)}>
                    Edit team
                  </Button>
                ) : undefined
              }
            />
            {project.members.length === 0 ? (
              <EmptyState compact icon={<Users className="h-5 w-5" />} title="Nobody assigned" />
            ) : (
              <ul className="divide-y divide-border">
                {project.members.map((member) => (
                  <li key={member.employee.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar
                      name={member.employee.user.name}
                      src={member.employee.user.avatar?.url}
                      size="sm"
                    />
                    <Link
                      to={`/employees/${member.employee.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <span className="block truncate text-sm font-medium text-fg">
                        {member.employee.user.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {member.employee.designation?.title ?? member.employee.employeeCode}
                      </span>
                    </Link>
                    <Badge tone={member.role === 'LEAD' ? 'primary' : 'neutral'}>
                      {humanise(member.role)}
                    </Badge>
                    {member.allocationHours && (
                      <span className="w-16 shrink-0 text-right text-xs text-muted">
                        {member.allocationHours}h/wk
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="files">
          <FileList projectId={project.id} />
        </TabPanel>

        <TabPanel value="discussion">
          <Card className="p-5">
            <CommentThread entityType="PROJECT" entityId={project.id} />
          </Card>
        </TabPanel>

        <TabPanel value="history">
          <Card>
            <CardHeader title="Stage history" description="How long each stage actually took" />
            {project.stageHistory.length === 0 ? (
              <EmptyState compact title="No stage changes yet" />
            ) : (
              <ol className="divide-y divide-border">
                {project.stageHistory.map((entry) => {
                  const days = entry.exitedAt
                    ? Math.max(
                        0,
                        Math.round(
                          (new Date(entry.exitedAt).getTime() -
                            new Date(entry.enteredAt).getTime()) /
                            86_400_000,
                        ),
                      )
                    : null;
                  return (
                    <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.stage.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">{entry.stage.name}</p>
                        <p className="text-2xs text-muted">
                          Entered {fmtDate(entry.enteredAt, 'dd MMM yyyy, h:mm a')}
                          {entry.note ? ` — ${entry.note}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {days === null ? (
                          <Badge tone="primary">Current</Badge>
                        ) : (
                          `${days} day${days === 1 ? '' : 's'}`
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </TabPanel>
      </Tabs>

      {movingStage && (
        <MoveStageModal
          project={project}
          onClose={() => setMovingStage(false)}
          defaultStageId={nextStage?.id}
        />
      )}
      {editingTeam && <EditTeamModal project={project} onClose={() => setEditingTeam(false)} />}
      {addingMilestone && (
        <AddMilestoneModal projectId={project.id} onClose={() => setAddingMilestone(false)} />
      )}
    </div>
  );
}

function MoveStageModal({
  project,
  onClose,
  defaultStageId,
}: {
  project: ProjectDetail;
  onClose: () => void;
  defaultStageId?: string;
}) {
  const queryClient = useQueryClient();
  const [stageId, setStageId] = useState(defaultStageId ?? '');
  const [note, setNote] = useState('');
  const [seed, setSeed] = useState(true);

  const move = useMutation({
    mutationFn: () =>
      apiPost(`/projects/${project.id}/stage`, { stageId, note: note || undefined, seedDefaultTasks: seed }),
    onSuccess: () => {
      toast.success('Stage updated');
      void queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const target = project.workflow.stages.find((stage) => stage.id === stageId);

  return (
    <Modal
      open
      onClose={onClose}
      title="Move stage"
      description="Stages move freely — there are no transition rules to satisfy."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={move.isPending} disabled={!stageId} onClick={() => move.mutate()}>
            Move project
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Stage"
          required
          value={stageId}
          onChange={(event) => setStageId(event.target.value)}
          placeholder="Select a stage"
          options={project.workflow.stages.map((stage) => ({
            value: stage.id,
            label: `${stage.name}${stage.isTerminal ? ' (closes the project)' : ''}`,
          }))}
        />
        {target?.isTerminal && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
            This is a terminal stage: the project will be marked completed.
          </p>
        )}
        <Textarea
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why is it moving? The team sees this in the history."
          rows={2}
        />
        <Checkbox
          checked={seed}
          onChange={(event) => setSeed(event.target.checked)}
          label="Create this stage’s default tasks"
          description="Skips any whose title already exists on the project."
        />
      </div>
    </Modal>
  );
}

function EditTeamModal({
  project,
  onClose,
}: {
  project: ProjectDetail;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const employees = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
  });

  const [members, setMembers] = useState(
    project.members.map((member) => ({
      employeeId: member.employee.id,
      role: member.role as string,
      allocationHours: member.allocationHours ?? '',
    })),
  );

  const save = useMutation({
    mutationFn: () =>
      apiPut(`/projects/${project.id}/members`, {
        members: members.map((member) => ({
          employeeId: member.employeeId,
          role: member.role,
          allocationHours: member.allocationHours === '' ? null : Number(member.allocationHours),
        })),
      }),
    onSuccess: () => {
      toast.success('Team updated');
      void queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const toggle = (employeeId: string) => {
    setMembers((current) =>
      current.some((member) => member.employeeId === employeeId)
        ? current.filter((member) => member.employeeId !== employeeId)
        : [...current, { employeeId, role: 'MEMBER', allocationHours: '' }],
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Project team"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save team
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-muted">
        Removing someone with open tasks is refused — reassign their work first.
      </p>
      <div className="max-h-[22rem] space-y-1 overflow-y-auto">
        {(employees.data ?? []).map((employee) => {
          const member = members.find((entry) => entry.employeeId === employee.id);
          return (
            <div
              key={employee.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-2.5 transition-colors',
                member ? 'border-primary/40 bg-primary-soft/40' : 'border-border',
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border-strong accent-primary"
                checked={Boolean(member)}
                onChange={() => toggle(employee.id)}
              />
              <Avatar name={employee.user.name} src={employee.user.avatar?.url} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{employee.user.name}</span>
                <span className="block truncate text-xs text-muted">
                  {employee.designation?.title}
                </span>
              </span>
              {member && (
                <>
                  <Select
                    value={member.role}
                    onChange={(event) =>
                      setMembers((current) =>
                        current.map((entry) =>
                          entry.employeeId === employee.id
                            ? { ...entry, role: event.target.value }
                            : entry,
                        ),
                      )
                    }
                    className="w-32"
                    options={['LEAD', 'MEMBER', 'REVIEWER', 'OBSERVER'].map((role) => ({
                      value: role,
                      label: humanise(role),
                    }))}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={80}
                    placeholder="h/wk"
                    value={String(member.allocationHours)}
                    onChange={(event) =>
                      setMembers((current) =>
                        current.map((entry) =>
                          entry.employeeId === employee.id
                            ? { ...entry, allocationHours: event.target.value }
                            : entry,
                        ),
                      )
                    }
                    className="w-20"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function AddMilestoneModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', dueDate: '', description: '' });

  const create = useMutation({
    mutationFn: () => apiPost(`/projects/${projectId}/milestones`, form),
    onSuccess: () => {
      toast.success('Milestone added');
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Add milestone"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.title.length < 2 || !form.dueDate}
            onClick={() => create.mutate()}
          >
            Add milestone
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="e.g. Design sign-off"
        />
        <Input
          label="Due date"
          type="date"
          required
          value={form.dueDate}
          onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
        />
        <Textarea
          label="Notes"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          rows={2}
        />
      </div>
    </Modal>
  );
}
