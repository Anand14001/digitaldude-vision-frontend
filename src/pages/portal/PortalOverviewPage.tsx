import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock, FileCheck2, FolderOpen, Mail, Phone } from 'lucide-react';
import { apiGet, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, fmtRelative, humanise } from '@/lib/utils';
import type { PortalActivityItem, PortalOverview } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ProgressBar,
  StatTile,
} from '@/components/ui';
import { DeliverableStatusBadge, ProjectStatusBadge } from '@/components/domain';

export function PortalOverviewPage() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'overview'],
    queryFn: () => apiGet<PortalOverview>('/portal/overview'),
  });

  const activity = useQuery({
    queryKey: ['portal', 'activity'],
    queryFn: () => apiGet<PortalActivityItem[]>('/portal/activity'),
  });

  if (isLoading) return <LoadingBlock label="Loading your projects…" />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!data) return null;

  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          Hello {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Here is where everything we are building for {data.client.name} stands.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active projects" value={data.summary.activeProjects} tone="primary" />
        <StatTile label="Completed" value={data.summary.completedProjects} tone="success" />
        <StatTile label="Ongoing services" value={data.summary.activeRetainers} />
        <StatTile
          label="Awaiting your approval"
          value={data.summary.awaitingYourApproval}
          tone={data.summary.awaitingYourApproval ? 'warning' : 'neutral'}
          icon={<FileCheck2 className="h-4 w-4" />}
        />
      </div>

      {data.summary.awaitingYourApproval > 0 && (
        <Link to="/portal/approvals" className="mt-4 block">
          <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 transition-colors hover:bg-warning/15">
            <Clock className="h-4 w-4 shrink-0 text-warning" />
            <p className="flex-1 text-sm font-medium text-warning">
              {data.summary.awaitingYourApproval} item
              {data.summary.awaitingYourApproval === 1 ? '' : 's'} waiting on your review
            </p>
            <ArrowRight className="h-4 w-4 text-warning" />
          </div>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-fg">Your projects</h2>
            {data.projects.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<FolderOpen className="h-5 w-5" />}
                  title="Nothing here yet"
                  description="Your projects will appear as soon as they start."
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {data.projects.map((project) => {
                  const stages = project.workflow.stages;
                  const index = stages.findIndex(
                    (stage) => stage.id === project.currentStage?.id,
                  );
                  const progress =
                    project.status === 'COMPLETED'
                      ? 100
                      : stages.length
                        ? Math.round(((index + 1) / stages.length) * 100)
                        : 0;

                  return (
                    <Link key={project.id} to={`/portal/projects/${project.id}`}>
                      <Card className="p-4 transition-shadow hover:shadow-pop">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-fg">
                              {project.name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted">
                              {project.currentStage
                                ? `Currently: ${project.currentStage.name}`
                                : 'Getting started'}
                            </p>
                          </div>
                          <ProjectStatusBadge value={project.status} />
                        </div>

                        <ProgressBar
                          className="mt-3"
                          value={progress}
                          showLabel
                          tone={project.status === 'COMPLETED' ? 'success' : 'primary'}
                        />

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted">
                          {project.startDate && <span>Started {fmtDate(project.startDate)}</span>}
                          {project.dueDate && (
                            <span>Target {fmtDate(project.dueDate)}</span>
                          )}
                          {project.completedAt && (
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle2 className="h-3 w-3" />
                              Delivered {fmtDate(project.completedAt)}
                            </span>
                          )}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {data.retainers.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-fg">Ongoing services</h2>
              <Card>
                <ul className="divide-y divide-border">
                  {data.retainers.map((retainer) => {
                    const cycle = retainer.cycles[0];
                    return (
                      <li
                        key={retainer.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{retainer.name}</p>
                          <p className="text-2xs text-muted">
                            {humanise(retainer.billingCycle)}
                            {cycle ? ` · current period ${cycle.label}` : ''}
                          </p>
                        </div>
                        {cycle && (
                          <Badge
                            tone={
                              cycle.status === 'DELIVERED' || cycle.status === 'CLOSED'
                                ? 'success'
                                : 'primary'
                            }
                          >
                            {humanise(cycle.status)}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          )}

          {data.recentDeliverables.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-fg">Recent deliverables</h2>
              <Card>
                <ul className="divide-y divide-border">
                  {data.recentDeliverables.map((deliverable) => (
                    <li
                      key={deliverable.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {deliverable.title}
                        </p>
                        <p className="truncate text-2xs text-muted">
                          {deliverable.project?.name}
                          {' · '}
                          {fmtRelative(deliverable.updatedAt)}
                        </p>
                      </div>
                      <DeliverableStatusBadge value={deliverable.status} />
                      {deliverable.status === 'CLIENT_REVIEW' && (
                        <Link to="/portal/approvals">
                          <Button size="sm">Review</Button>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {data.client.accountManager && (
            <Card>
              <CardHeader title="Your account manager" />
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={data.client.accountManager.user.name}
                    src={data.client.accountManager.user.avatar?.url}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {data.client.accountManager.user.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {data.client.accountManager.designation?.title ?? 'Digital Dude'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <a
                    href={`mailto:${data.client.accountManager.user.email}`}
                    className="flex items-center gap-2 text-muted hover:text-primary"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {data.client.accountManager.user.email}
                  </a>
                  {data.client.accountManager.user.phone && (
                    <a
                      href={`tel:${data.client.accountManager.user.phone}`}
                      className="flex items-center gap-2 text-muted hover:text-primary"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {data.client.accountManager.user.phone}
                    </a>
                  )}
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Recent updates" />
            {activity.data?.length === 0 ? (
              <EmptyState compact title="Nothing to report yet" />
            ) : (
              <ol className="divide-y divide-border">
                {activity.data?.slice(0, 10).map((item) => (
                  <li key={`${item.type}-${item.id}`} className="px-5 py-2.5">
                    <p className="text-sm text-fg">{item.title}</p>
                    <p className="mt-0.5 text-2xs text-subtle">{fmtRelative(item.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {!data.canApprove && (
            <p className={cn('rounded-xl bg-surface-2 px-4 py-3 text-xs text-muted')}>
              Your account can follow progress but not approve deliverables. Ask your account
              manager if you need approval rights.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
