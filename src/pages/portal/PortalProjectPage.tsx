import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Flag, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { cn, fileSize, fmtDate, fmtRelative } from '@/lib/utils';
import type { PortalProject } from '@/types/api';
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
  Textarea,
} from '@/components/ui';
import { DeliverableStatusBadge, ProjectStatusBadge, StageTrack } from '@/components/domain';

export function PortalProjectPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const { data: project, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'project', id],
    queryFn: () => apiGet<PortalProject>(`/portal/projects/${id}`),
    enabled: Boolean(id),
  });

  const send = useMutation({
    mutationFn: () => apiPost(`/portal/projects/${id}/messages`, { body: message }),
    onSuccess: () => {
      toast.success('Message sent to your project team');
      setMessage('');
      void queryClient.invalidateQueries({ queryKey: ['portal', 'project', id] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!project) return null;

  const doneTasks = project.tasks.filter((task) => task.completedAt).length;

  return (
    <div>
      <Link
        to="/portal"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
              {project.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <ProjectStatusBadge value={project.status} />
              {project.currentStage && (
                <span>Currently in {project.currentStage.name}</span>
              )}
            </p>
          </div>
          {project.manager && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2">
              <Avatar
                name={project.manager.user.name}
                src={project.manager.user.avatar?.url}
                size="sm"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-fg">
                  {project.manager.user.name}
                </p>
                <p className="truncate text-2xs text-muted">Project manager</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg">Progress</h2>
          <span className="text-sm font-semibold tabular-nums text-primary">
            {project.progressPercent}%
          </span>
        </div>
        <ProgressBar
          value={project.progressPercent}
          tone={project.status === 'COMPLETED' ? 'success' : 'primary'}
        />
        <div className="mt-5">
          <StageTrack
            stages={project.workflow.stages}
            currentStageId={project.currentStage?.id}
            complete={project.status === 'COMPLETED'}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted">
          {project.startDate && <span>Started {fmtDate(project.startDate)}</span>}
          {project.dueDate && <span>Target delivery {fmtDate(project.dueDate)}</span>}
          {project.completedAt && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Delivered {fmtDate(project.completedAt)}
            </span>
          )}
        </div>
      </Card>

      {project.description && (
        <Card className="mb-6">
          <CardHeader title="About this project" />
          <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-fg">
            {project.description}
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Deliverables" description="Files and creative shared with you" />
          {project.deliverables.length === 0 ? (
            <EmptyState compact title="Nothing shared yet" />
          ) : (
            <ul className="divide-y divide-border">
              {project.deliverables.map((deliverable) => {
                const latest = deliverable.versions[0];
                return (
                  <li key={deliverable.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">
                          {deliverable.title}
                        </p>
                        {latest && (
                          <p className="text-2xs text-muted">
                            Version {latest.versionNumber} · {fmtRelative(latest.createdAt)}
                          </p>
                        )}
                      </div>
                      <DeliverableStatusBadge value={deliverable.status} />
                    </div>

                    {latest?.files.length ? (
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {latest.files.map((file) => (
                          <li key={file.id}>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2 transition-colors hover:bg-border/40"
                            >
                              {file.mimeType.startsWith('image/') ? (
                                <img
                                  src={file.url}
                                  alt=""
                                  className="h-9 w-9 rounded object-cover"
                                />
                              ) : (
                                <span className="flex h-9 w-9 items-center justify-center rounded bg-surface text-2xs font-semibold text-muted">
                                  {file.originalName.split('.').pop()?.toUpperCase().slice(0, 4)}
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs text-fg">
                                  {file.originalName}
                                </span>
                                <span className="block text-2xs text-subtle">
                                  {fileSize(file.sizeBytes)}
                                </span>
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {deliverable.status === 'CLIENT_REVIEW' && (
                      <Link to="/portal/approvals" className="mt-2 inline-block">
                        <Button size="sm">Review and respond</Button>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {project.milestones.length > 0 && (
            <Card>
              <CardHeader title="Key dates" />
              <ul className="divide-y divide-border">
                {project.milestones.map((milestone) => (
                  <li key={milestone.id} className="flex items-center gap-3 px-5 py-2.5">
                    {milestone.completedAt ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Flag className="h-4 w-4 shrink-0 text-muted" />
                    )}
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm',
                        milestone.completedAt ? 'text-muted line-through' : 'text-fg',
                      )}
                    >
                      {milestone.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {fmtDate(milestone.dueDate, 'dd MMM')}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {project.tasks.length > 0 && (
            <Card>
              <CardHeader
                title="Work items"
                description={`${doneTasks} of ${project.tasks.length} complete`}
              />
              <ul className="divide-y divide-border">
                {project.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: task.status.color }}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm',
                        task.completedAt ? 'text-muted line-through' : 'text-fg',
                      )}
                    >
                      {task.title}
                    </span>
                    <Badge tone="neutral">{task.status.name}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Message your team"
              description="Goes straight to your project manager"
            />
            <div className="px-5 py-4">
              <Textarea
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask a question or share feedback…"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  icon={<Send className="h-3.5 w-3.5" />}
                  loading={send.isPending}
                  disabled={message.trim().length < 2}
                  onClick={() => send.mutate()}
                >
                  Send
                </Button>
              </div>
            </div>
          </Card>

          {project.stageHistory.length > 0 && (
            <Card>
              <CardHeader title="Timeline" />
              <ol className="divide-y divide-border">
                {project.stageHistory.map((entry, index) => (
                  <li key={index} className="flex items-center gap-3 px-5 py-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.stage.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">
                      {entry.stage.name}
                    </span>
                    <span className="shrink-0 text-2xs text-muted">
                      {fmtDate(entry.enteredAt, 'dd MMM yy')}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
