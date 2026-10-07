import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtCurrency, fmtDate, humanise } from '@/lib/utils';
import type { RetainerDetail, TaskBoard as TaskBoardType } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  FieldGrid,
  LoadingBlock,
  PageHeader,
  Select,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@/components/ui';
import { CycleStatusBadge, RetainerStatusBadge, StageTrack } from '@/components/domain';
import { TaskBoard } from '@/features/TaskBoard';
import { CommentThread } from '@/features/CommentThread';

export function RetainerDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [tab, setTab] = useState('current');
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  const { data: retainer, isLoading, error, refetch } = useQuery({
    queryKey: ['retainer', id],
    queryFn: () => apiGet<RetainerDetail>(`/retainers/${id}`),
    enabled: Boolean(id),
  });

  const activeCycleId = selectedCycleId ?? retainer?.cycles[0]?.id ?? null;

  const board = useQuery({
    queryKey: ['tasks', 'board', { retainerCycleId: activeCycleId }],
    queryFn: () => apiGet<TaskBoardType>('/tasks/board', { retainerCycleId: activeCycleId }),
    enabled: Boolean(activeCycleId) && tab === 'current',
  });

  const openCycle = useMutation({
    mutationFn: () => apiPost(`/retainers/${id}/cycles`, {}),
    onSuccess: () => {
      toast.success('New cycle opened');
      void queryClient.invalidateQueries({ queryKey: ['retainer', id] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const setCycleStatus = useMutation({
    mutationFn: ({ cycleId, status }: { cycleId: string; status: string }) =>
      apiPatch(`/retainers/cycles/${cycleId}`, { status }),
    onSuccess: () => {
      toast.success('Cycle updated');
      void queryClient.invalidateQueries({ queryKey: ['retainer', id] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const moveCycleStage = useMutation({
    mutationFn: ({ cycleId, stageId }: { cycleId: string; stageId: string }) =>
      apiPatch(`/retainers/cycles/${cycleId}`, { currentStageId: stageId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['retainer', id] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!retainer) return null;

  const cycle = retainer.cycles.find((entry) => entry.id === activeCycleId);

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Link to="/retainers" className="hover:text-fg">
            Retainers
          </Link>
        }
        title={retainer.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="font-mono text-xs">{retainer.code}</span>
            <span>·</span>
            <Link to={`/clients/${retainer.client.id}`} className="text-primary hover:underline">
              {retainer.client.name}
            </Link>
          </span>
        }
        meta={
          <>
            <RetainerStatusBadge value={retainer.status} />
            <Badge tone="neutral">{humanise(retainer.billingCycle)}</Badge>
            {retainer.amountPerCycle && (
              <Badge tone="success">
                {fmtCurrency(retainer.amountPerCycle)} per cycle
              </Badge>
            )}
            {retainer.autoGenerateCycles && <Badge tone="info">Auto-opens cycles</Badge>}
          </>
        }
        actions={
          can('retainers.cycles.manage') && retainer.status === 'ACTIVE' ? (
            <Button
              icon={<CalendarPlus className="h-4 w-4" />}
              loading={openCycle.isPending}
              onClick={() => openCycle.mutate()}
            >
              Open next cycle
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab value="current">Current cycle</Tab>
          <Tab value="cycles" count={retainer.cycles.length}>
            All cycles
          </Tab>
          <Tab value="overview">Overview</Tab>
          <Tab value="discussion">Discussion</Tab>
        </TabList>

        <TabPanel value="current">
          {!cycle ? (
            <Card>
              <EmptyState
                icon={<Repeat className="h-5 w-5" />}
                title="No cycle open"
                description="Open one to start this period's work."
                action={
                  can('retainers.cycles.manage') ? (
                    <Button size="sm" onClick={() => openCycle.mutate()}>
                      Open a cycle
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="space-y-5">
              <Card className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-fg">{cycle.label}</h2>
                      <CycleStatusBadge value={cycle.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {fmtDate(cycle.periodStart)} — {fmtDate(cycle.periodEnd)} ·{' '}
                      {cycle._count.tasks} tasks, {cycle._count.deliverables} deliverables
                    </p>
                  </div>

                  {can('retainers.cycles.manage') && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={cycle.currentStage?.id ?? ''}
                        onChange={(event) =>
                          moveCycleStage.mutate({ cycleId: cycle.id, stageId: event.target.value })
                        }
                        placeholder="Set stage"
                        className="w-auto min-w-[11rem]"
                        options={retainer.workflow.stages.map((stage) => ({
                          value: stage.id,
                          label: stage.name,
                        }))}
                      />
                      <Select
                        value={cycle.status}
                        onChange={(event) =>
                          setCycleStatus.mutate({ cycleId: cycle.id, status: event.target.value })
                        }
                        className="w-auto min-w-[9rem]"
                        options={['UPCOMING', 'IN_PROGRESS', 'DELIVERED', 'CLOSED'].map(
                          (value) => ({ value, label: humanise(value) }),
                        )}
                      />
                    </div>
                  )}
                </div>

                <StageTrack
                  stages={retainer.workflow.stages}
                  currentStageId={cycle.currentStage?.id}
                  complete={cycle.status === 'CLOSED'}
                />
              </Card>

              {board.isLoading ? (
                <LoadingBlock />
              ) : (
                <TaskBoard
                  board={board.data}
                  retainerCycleId={cycle.id}
                  workflow={retainer.workflow}
                  stageId={cycle.currentStage?.id ?? null}
                />
              )}
            </div>
          )}
        </TabPanel>

        <TabPanel value="cycles">
          <Card>
            <CardHeader title="Cycle history" description="Newest first" />
            <ul className="divide-y divide-border">
              {retainer.cycles.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{entry.label}</p>
                    <p className="text-2xs text-muted">
                      {fmtDate(entry.periodStart, 'dd MMM')} —{' '}
                      {fmtDate(entry.periodEnd, 'dd MMM yyyy')}
                    </p>
                  </div>
                  {entry.currentStage && (
                    <span className="text-xs" style={{ color: entry.currentStage.color }}>
                      {entry.currentStage.name}
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {entry._count.tasks} tasks · {entry._count.deliverables} deliverables
                  </span>
                  <CycleStatusBadge value={entry.status} />
                  <Button
                    size="sm"
                    variant={entry.id === activeCycleId ? 'subtle' : 'ghost'}
                    onClick={() => {
                      setSelectedCycleId(entry.id);
                      setTab('current');
                    }}
                  >
                    Open board
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </TabPanel>

        <TabPanel value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Agreement" />
              <div className="px-5 py-4">
                <FieldGrid cols={2}>
                  <Field label="Client">{retainer.client.name}</Field>
                  <Field label="Service line">{retainer.serviceLine?.name}</Field>
                  <Field label="Billing cycle">{humanise(retainer.billingCycle)}</Field>
                  <Field label="Amount per cycle">
                    {retainer.amountPerCycle ? fmtCurrency(retainer.amountPerCycle) : null}
                  </Field>
                  <Field label="Start date">{fmtDate(retainer.startDate)}</Field>
                  <Field label="End date">
                    {retainer.endDate ? fmtDate(retainer.endDate) : 'Open-ended'}
                  </Field>
                  <Field label="Cycle starts on">Day {retainer.cycleStartDay}</Field>
                  <Field label="Workflow">
                    {can('settings.workflows.manage') ? (
                      <Link
                        to={`/workflows?open=${retainer.workflow.id}`}
                        className="text-primary hover:underline"
                      >
                        {retainer.workflow.name}
                      </Link>
                    ) : (
                      retainer.workflow.name
                    )}
                  </Field>
                </FieldGrid>
              </div>
            </Card>

            <Card>
              <CardHeader title="Scope" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm text-fg">
                {retainer.scopeNotes || 'No scope recorded.'}
              </p>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="discussion">
          <Card className="p-5">
            {cycle ? (
              <CommentThread entityType="RETAINER_CYCLE" entityId={cycle.id} />
            ) : (
              <p className="text-sm text-muted">Open a cycle to start a discussion.</p>
            )}
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
}
