import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Target } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiList, apiPatch, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, humanise } from '@/lib/utils';
import type { Goal, PerformanceReview, ReviewCycle } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
} from '@/components/ui';
import { GoalStatusBadge, ReviewStatusBadge } from '@/components/domain';

export function PerformancePage() {
  const { can, user } = useAuth();
  const { pathname } = useLocation();
  const { id: linkedReviewId } = useParams();
  const [tab, setTab] = useState(pathname.endsWith('/my') ? 'mine' : 'mine');
  const [openReview, setOpenReview] = useState<PerformanceReview | null>(null);

  // A notification can link straight at one review. Which side of it the reader
  // is on decides whether they are writing the self-assessment or the manager's,
  // so the review itself is fetched and the right form opened.
  const linkedReview = useQuery({
    queryKey: ['performance', 'review', linkedReviewId],
    queryFn: () => apiGet<PerformanceReview>(`/performance/reviews/${linkedReviewId}`),
    enabled: Boolean(linkedReviewId),
  });

  useEffect(() => {
    if (!linkedReview.data || openReview) return;
    const isSubject = linkedReview.data.employeeId === user?.employee?.id;
    setTab(isSubject ? 'mine' : 'team');
    setOpenReview(linkedReview.data);
  }, [linkedReview.data, openReview, user?.employee?.id]);
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [creatingGoal, setCreatingGoal] = useState(false);

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Review cycles, self-assessments and goals."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Target className="h-4 w-4" />}
              onClick={() => setCreatingGoal(true)}
            >
              Add goal
            </Button>
            {can('performance.manage') && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreatingCycle(true)}>
                New cycle
              </Button>
            )}
          </>
        }
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab value="mine">My reviews</Tab>
          <Tab value="goals">Goals</Tab>
          {can('performance.view.team', 'performance.view.all') && (
            <Tab value="team">Team reviews</Tab>
          )}
          {can('performance.manage') && <Tab value="cycles">Cycles</Tab>}
        </TabList>

        <TabPanel value="mine">
          <MyReviews />
        </TabPanel>
        <TabPanel value="goals">
          <GoalsList onAdd={() => setCreatingGoal(true)} />
        </TabPanel>
        <TabPanel value="team">
          <TeamReviews />
        </TabPanel>
        <TabPanel value="cycles">
          <CyclesList />
        </TabPanel>
      </Tabs>

      {openReview && (
        <ReviewModal
          review={openReview}
          mode={openReview.employeeId === user?.employee?.id ? 'self' : 'manager'}
          onClose={() => setOpenReview(null)}
        />
      )}
      {creatingCycle && <CreateCycleModal onClose={() => setCreatingCycle(false)} />}
      {creatingGoal && <CreateGoalModal onClose={() => setCreatingGoal(false)} />}
    </div>
  );
}

function RatingStars({ value }: { value: number | null }) {
  if (!value) return <span className="text-xs text-subtle">Not rated</span>;
  return (
    <span className="flex items-center gap-0.5" title={`${value} of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            'h-3.5 w-3.5',
            index < value ? 'fill-warning text-warning' : 'text-border-strong',
          )}
        />
      ))}
    </span>
  );
}

function MyReviews() {
  const [open, setOpen] = useState<PerformanceReview | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'reviews', 'my'],
    queryFn: () => apiGet<PerformanceReview[]>('/performance/reviews/my'),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <>
      <Card>
        <CardHeader title="My reviews" />
        {data?.length === 0 ? (
          <EmptyState compact title="No review cycles have included you yet" />
        ) : (
          <ul className="divide-y divide-border">
            {data?.map((review) => (
              <li key={review.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{review.cycle.name}</p>
                  <p className="text-2xs text-muted">
                    {fmtDate(review.cycle.periodStart)} — {fmtDate(review.cycle.periodEnd)}
                    {review.reviewer ? ` · reviewer ${review.reviewer.user.name}` : ''}
                  </p>
                </div>
                {review.status === 'COMPLETED' && (
                  <RatingStars value={review.managerRating} />
                )}
                <ReviewStatusBadge value={review.status} />
                <Button
                  size="sm"
                  variant={review.status === 'PENDING_SELF' ? 'primary' : 'secondary'}
                  onClick={() => setOpen(review)}
                >
                  {review.status === 'PENDING_SELF' ? 'Write self-review' : 'View'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && <ReviewModal review={open} mode="self" onClose={() => setOpen(null)} />}
    </>
  );
}

function TeamReviews() {
  const [open, setOpen] = useState<PerformanceReview | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'reviews', 'team'],
    queryFn: () => apiList<PerformanceReview>('/performance/reviews', { pageSize: 100 }),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <>
      <Card>
        <CardHeader title="Team reviews" description="Those awaiting your input appear first" />
        {data?.data.length === 0 ? (
          <EmptyState compact title="No reviews to show" />
        ) : (
          <ul className="divide-y divide-border">
            {data?.data.map((review) => (
              <li key={review.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar
                  name={review.employee?.user.name ?? '?'}
                  src={review.employee?.user.avatar?.url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {review.employee?.user.name}
                  </p>
                  <p className="truncate text-2xs text-muted">
                    {review.employee?.designation?.title} · {review.cycle.name}
                  </p>
                </div>
                <RatingStars value={review.selfRating} />
                <ReviewStatusBadge value={review.status} />
                <Button
                  size="sm"
                  variant={review.status === 'PENDING_MANAGER' ? 'primary' : 'secondary'}
                  onClick={() => setOpen(review)}
                >
                  {review.status === 'PENDING_MANAGER' ? 'Review' : 'View'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && <ReviewModal review={open} mode="manager" onClose={() => setOpen(null)} />}
    </>
  );
}

function ReviewModal({
  review,
  mode,
  onClose,
}: {
  review: PerformanceReview;
  mode: 'self' | 'manager';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: full, isLoading } = useQuery({
    queryKey: ['performance', 'review', review.id],
    queryFn: () => apiGet<PerformanceReview>(`/performance/reviews/${review.id}`),
  });

  const [selfForm, setSelfForm] = useState({ selfRating: '4', selfComments: '' });
  const [managerForm, setManagerForm] = useState({
    managerRating: '4',
    managerComments: '',
    strengths: '',
    improvements: '',
    complete: true,
  });

  const submitSelf = useMutation({
    mutationFn: () =>
      apiPost(`/performance/reviews/${review.id}/self`, {
        selfRating: Number(selfForm.selfRating),
        selfComments: selfForm.selfComments,
      }),
    onSuccess: () => {
      toast.success('Self-review submitted');
      void queryClient.invalidateQueries({ queryKey: ['performance'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const submitManager = useMutation({
    mutationFn: () =>
      apiPost(`/performance/reviews/${review.id}/manager`, {
        managerRating: Number(managerForm.managerRating),
        managerComments: managerForm.managerComments,
        strengths: managerForm.strengths || undefined,
        improvements: managerForm.improvements || undefined,
        complete: managerForm.complete,
      }),
    onSuccess: () => {
      toast.success('Review saved');
      void queryClient.invalidateQueries({ queryKey: ['performance'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const canWriteSelf = mode === 'self' && full?.status === 'PENDING_SELF';
  const canWriteManager = mode === 'manager' && full?.status === 'PENDING_MANAGER';

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={review.cycle.name}
      description={
        mode === 'manager'
          ? `Manager review for ${review.employee?.user.name}`
          : 'Your self-assessment'
      }
      footer={
        canWriteSelf ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={submitSelf.isPending}
              disabled={selfForm.selfComments.trim().length < 10}
              onClick={() => submitSelf.mutate()}
            >
              Submit self-review
            </Button>
          </>
        ) : canWriteManager ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={submitManager.isPending}
              disabled={managerForm.managerComments.trim().length < 10}
              onClick={() => submitManager.mutate()}
            >
              {managerForm.complete ? 'Complete review' : 'Save draft'}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {isLoading || !full ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <ReviewStatusBadge value={full.status} />
            <Badge tone="neutral">
              {fmtDate(full.cycle.periodStart)} — {fmtDate(full.cycle.periodEnd)}
            </Badge>
          </div>

          {canWriteSelf ? (
            <>
              <Select
                label="How would you rate your own period?"
                value={selfForm.selfRating}
                onChange={(event) =>
                  setSelfForm({ ...selfForm, selfRating: event.target.value })
                }
                options={[1, 2, 3, 4, 5].map((value) => ({
                  value: String(value),
                  label: `${value} — ${['Needs work', 'Developing', 'Solid', 'Strong', 'Outstanding'][value - 1]}`,
                }))}
              />
              <Textarea
                label="Your comments"
                required
                rows={6}
                value={selfForm.selfComments}
                onChange={(event) =>
                  setSelfForm({ ...selfForm, selfComments: event.target.value })
                }
                placeholder="What went well, what was hard, what you want next."
              />
            </>
          ) : (
            full.selfComments && (
              <section>
                <p className="mb-1.5 flex items-center gap-2 text-2xs font-medium uppercase tracking-wide text-subtle">
                  Self-assessment
                  <RatingStars value={full.selfRating} />
                </p>
                <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-fg">
                  {full.selfComments}
                </p>
              </section>
            )
          )}

          {canWriteManager && (
            <>
              <Select
                label="Manager rating"
                value={managerForm.managerRating}
                onChange={(event) =>
                  setManagerForm({ ...managerForm, managerRating: event.target.value })
                }
                options={[1, 2, 3, 4, 5].map((value) => ({
                  value: String(value),
                  label: `${value} — ${['Needs work', 'Developing', 'Solid', 'Strong', 'Outstanding'][value - 1]}`,
                }))}
              />
              <Textarea
                label="Manager comments"
                required
                rows={5}
                value={managerForm.managerComments}
                onChange={(event) =>
                  setManagerForm({ ...managerForm, managerComments: event.target.value })
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Textarea
                  label="Strengths"
                  rows={3}
                  value={managerForm.strengths}
                  onChange={(event) =>
                    setManagerForm({ ...managerForm, strengths: event.target.value })
                  }
                />
                <Textarea
                  label="Areas to improve"
                  rows={3}
                  value={managerForm.improvements}
                  onChange={(event) =>
                    setManagerForm({ ...managerForm, improvements: event.target.value })
                  }
                />
              </div>
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                Completing the review is what makes it visible to the employee.
              </p>
            </>
          )}

          {full.status === 'COMPLETED' && (
            <section className="space-y-3">
              <p className="mb-1.5 flex items-center gap-2 text-2xs font-medium uppercase tracking-wide text-subtle">
                Manager review
                <RatingStars value={full.managerRating} />
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-fg">
                {full.managerComments}
              </p>
              {full.strengths && (
                <div>
                  <p className="text-2xs font-medium uppercase tracking-wide text-subtle">
                    Strengths
                  </p>
                  <p className="mt-1 text-sm text-fg">{full.strengths}</p>
                </div>
              )}
              {full.improvements && (
                <div>
                  <p className="text-2xs font-medium uppercase tracking-wide text-subtle">
                    Areas to improve
                  </p>
                  <p className="mt-1 text-sm text-fg">{full.improvements}</p>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

function GoalsList({ onAdd }: { onAdd: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'goals'],
    queryFn: () => apiList<Goal>('/performance/goals', { pageSize: 100 }),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      apiPatch(`/performance/goals/${id}`, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['performance', 'goals'] }),
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <Card>
      <CardHeader
        title="Goals"
        action={
          <Button size="sm" variant="secondary" onClick={onAdd}>
            Add goal
          </Button>
        }
      />
      {data?.data.length === 0 ? (
        <EmptyState compact icon={<Target className="h-5 w-5" />} title="No goals set" />
      ) : (
        <ul className="divide-y divide-border">
          {data?.data.map((goal) => (
            <li key={goal.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{goal.title}</p>
                <p className="text-2xs text-muted">
                  {goal.employee?.user.name}
                  {goal.metric ? ` · ${goal.metric}` : ''}
                  {goal.target ? ` · target ${goal.target}` : ''}
                  {goal.dueDate ? ` · by ${fmtDate(goal.dueDate, 'dd MMM yy')}` : ''}
                </p>
              </div>
              <Input
                className="w-28"
                placeholder="Current"
                defaultValue={goal.current ?? ''}
                onBlur={(event) => {
                  if (event.target.value !== (goal.current ?? '')) {
                    update.mutate({ id: goal.id, patch: { current: event.target.value } });
                  }
                }}
              />
              <Select
                className="w-40"
                value={goal.status}
                onChange={(event) =>
                  update.mutate({ id: goal.id, patch: { status: event.target.value } })
                }
                options={['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'MISSED'].map((value) => ({
                  value,
                  label: humanise(value),
                }))}
              />
              <GoalStatusBadge value={goal.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CyclesList() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'cycles'],
    queryFn: () => apiGet<ReviewCycle[]>('/performance/cycles'),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'open' | 'close' }) =>
      apiPost(`/performance/cycles/${id}/${action}`),
    onSuccess: (_result, variables) => {
      toast.success(variables.action === 'open' ? 'Cycle opened' : 'Cycle closed');
      void queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <Card>
      <CardHeader
        title="Review cycles"
        description="Opening a cycle creates a review for every active employee."
      />
      {data?.length === 0 ? (
        <EmptyState compact title="No cycles yet" />
      ) : (
        <ul className="divide-y divide-border">
          {data?.map((cycle) => (
            <li key={cycle.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{cycle.name}</p>
                <p className="text-2xs text-muted">
                  {fmtDate(cycle.periodStart)} — {fmtDate(cycle.periodEnd)}
                  {cycle.dueDate ? ` · due ${fmtDate(cycle.dueDate)}` : ''}
                  {cycle._count ? ` · ${cycle._count.reviews} reviews` : ''}
                </p>
              </div>
              <Badge
                tone={
                  cycle.status === 'OPEN'
                    ? 'primary'
                    : cycle.status === 'CLOSED'
                      ? 'neutral'
                      : 'warning'
                }
              >
                {humanise(cycle.status)}
              </Badge>
              {cycle.status === 'DRAFT' && (
                <Button
                  size="sm"
                  loading={act.isPending}
                  onClick={() => act.mutate({ id: cycle.id, action: 'open' })}
                >
                  Open cycle
                </Button>
              )}
              {cycle.status === 'OPEN' && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={act.isPending}
                  onClick={() => act.mutate({ id: cycle.id, action: 'close' })}
                >
                  Close cycle
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CreateCycleModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    periodStart: '',
    periodEnd: '',
    dueDate: '',
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/performance/cycles', {
        name: form.name,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        dueDate: form.dueDate || null,
      }),
    onSuccess: () => {
      toast.success('Cycle created as a draft');
      void queryClient.invalidateQueries({ queryKey: ['performance'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New review cycle"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!form.name || !form.periodStart || !form.periodEnd}
            onClick={() => create.mutate()}
          >
            Create draft
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Cycle name"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="e.g. H1 FY26 Review"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Period start"
            type="date"
            required
            value={form.periodStart}
            onChange={(event) => setForm({ ...form, periodStart: event.target.value })}
          />
          <Input
            label="Period end"
            type="date"
            required
            value={form.periodEnd}
            onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}
          />
        </div>
        <Input
          label="Submission due by"
          type="date"
          value={form.dueDate}
          onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
        />
      </div>
    </Modal>
  );
}

function CreateGoalModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [form, setForm] = useState({
    employeeId: '',
    title: '',
    description: '',
    metric: '',
    target: '',
    weight: '0',
    dueDate: '',
  });

  const employees = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<{ id: string; user: { name: string } }[]>('/employees/options/all'),
    enabled: can('performance.goals.manage'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/performance/goals', {
        employeeId: form.employeeId || undefined,
        title: form.title,
        description: form.description || undefined,
        metric: form.metric || undefined,
        target: form.target || undefined,
        weight: Number(form.weight),
        dueDate: form.dueDate || null,
      }),
    onSuccess: () => {
      toast.success('Goal added');
      void queryClient.invalidateQueries({ queryKey: ['performance', 'goals'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a goal"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.title.trim().length < 2}
            onClick={() => create.mutate()}
          >
            Add goal
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {can('performance.goals.manage') && (
          <Select
            label="For whom"
            value={form.employeeId}
            onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
            placeholder="Myself"
            options={(employees.data ?? []).map((employee) => ({
              value: employee.id,
              label: employee.user.name,
            }))}
          />
        )}
        <Input
          label="Goal"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="e.g. Ship 12 reels a month with under 2 revision rounds"
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Metric"
            value={form.metric}
            onChange={(event) => setForm({ ...form, metric: event.target.value })}
            placeholder="e.g. Reels shipped"
          />
          <Input
            label="Target"
            value={form.target}
            onChange={(event) => setForm({ ...form, target: event.target.value })}
            placeholder="e.g. 12/month"
          />
          <Input
            label="Due date"
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
          />
        </div>
        <Textarea
          label="Notes"
          rows={2}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </div>
    </Modal>
  );
}
