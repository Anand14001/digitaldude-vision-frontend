import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  FileCheck2,
  MessageSquareWarning,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiUpload, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, fileSize, fmtDate, fmtRelative, humanise } from '@/lib/utils';
import type { Deliverable, FileObject } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  Textarea,
} from '@/components/ui';
import { DeliverableStatusBadge } from '@/components/domain';
import { FilterBar, FilterSelect } from '@/components/ListShell';
import { CommentThread } from '@/features/CommentThread';

const STATUSES = [
  'DRAFT',
  'INTERNAL_REVIEW',
  'CLIENT_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'PUBLISHED',
] as const;

export function DeliverablesPage() {
  const [params] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useListState(
    {
      status: params.get('status') ?? undefined,
    },
    25,
  );

  const { data, isLoading, error, refetch } = usePaginatedQuery<Deliverable>(
    ['deliverables'],
    '/deliverables',
    list.queryParams,
  );

  const grouped = {
    needsReview: (data?.data ?? []).filter((item) => item.status === 'INTERNAL_REVIEW'),
    withClient: (data?.data ?? []).filter(
      (item) => item.status === 'CLIENT_REVIEW' || item.status === 'CHANGES_REQUESTED',
    ),
    settled: (data?.data ?? []).filter(
      (item) =>
        item.status === 'APPROVED' || item.status === 'PUBLISHED' || item.status === 'DRAFT',
    ),
  };

  return (
    <div>
      <PageHeader
        title="Deliverables"
        description="Creative work moving through internal review and client approval."
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        placeholder="Search by title…"
        activeCount={list.activeFilterCount}
        onReset={list.resetFilters}
      >
        <FilterSelect
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value)}
          options={STATUSES}
          allLabel="All statuses"
        />
      </FilterBar>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="h-44 animate-pulse" />
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileCheck2 className="h-5 w-5" />}
            title="No deliverables"
            description="Create them from inside a project or a retainer cycle."
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {[
            {
              key: 'needsReview',
              title: 'Needs your internal review',
              items: grouped.needsReview,
              tone: 'info' as const,
            },
            {
              key: 'withClient',
              title: 'With the client',
              items: grouped.withClient,
              tone: 'warning' as const,
            },
            { key: 'settled', title: 'Settled', items: grouped.settled, tone: 'neutral' as const },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-fg">{group.title}</h2>
                  <Badge tone={group.tone}>{group.items.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((deliverable) => (
                    <DeliverableCard
                      key={deliverable.id}
                      deliverable={deliverable}
                      onOpen={() => setOpenId(deliverable.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      {openId && <DeliverableDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function DeliverableCard({
  deliverable,
  onOpen,
}: {
  deliverable: Deliverable;
  onOpen: () => void;
}) {
  const latest = deliverable.versions[0];
  const where =
    deliverable.project?.name ??
    `${deliverable.retainerCycle?.retainer.name ?? ''} · ${deliverable.retainerCycle?.label ?? ''}`;
  const client =
    deliverable.project?.client.name ?? deliverable.retainerCycle?.retainer.client.name;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="dd-card p-4 text-left transition-shadow hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-fg">
          {deliverable.title}
        </p>
        <DeliverableStatusBadge value={deliverable.status} />
      </div>
      <p className="mt-1 truncate text-xs text-muted">{where}</p>
      {client && <p className="truncate text-2xs text-subtle">{client}</p>}

      {latest ? (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <Badge tone="neutral">v{latest.versionNumber}</Badge>
          <span className="text-2xs text-muted">
            {latest.files.length} file{latest.files.length === 1 ? '' : 's'} ·{' '}
            {fmtRelative(latest.createdAt)}
          </span>
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-2xs text-subtle">
          No version uploaded yet
        </p>
      )}

      {deliverable.dueDate && (
        <p className="mt-2 text-2xs text-muted">Due {fmtDate(deliverable.dueDate)}</p>
      )}
    </button>
  );
}

function DeliverableDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [decision, setDecision] = useState<'APPROVED' | 'CHANGES_REQUESTED' | null>(null);
  const [sendingToClient, setSendingToClient] = useState(false);

  const { data: deliverable, isLoading } = useQuery({
    queryKey: ['deliverable', id],
    queryFn: () => apiGet<Deliverable>(`/deliverables/${id}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['deliverable', id] });
    void queryClient.invalidateQueries({ queryKey: ['deliverables'] });
    void queryClient.invalidateQueries({ queryKey: ['badges'] });
  };

  const publish = useMutation({
    mutationFn: () => apiPost(`/deliverables/${id}/publish`),
    onSuccess: () => {
      toast.success('Marked as published');
      invalidate();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const latest = deliverable?.versions[0];

  return (
    <Drawer
      open
      onClose={onClose}
      width="xl"
      title={deliverable?.title ?? 'Deliverable'}
      footer={
        deliverable ? (
          <div className="flex flex-wrap gap-2">
            {can('deliverables.version.upload') && (
              <Button
                variant="secondary"
                icon={<Upload className="h-4 w-4" />}
                onClick={() => setUploading(true)}
              >
                New version
              </Button>
            )}
            {can('deliverables.approve.internal') &&
              deliverable.status === 'INTERNAL_REVIEW' &&
              latest && (
                <>
                  <Button
                    variant="secondary"
                    icon={<MessageSquareWarning className="h-4 w-4" />}
                    onClick={() => setDecision('CHANGES_REQUESTED')}
                  >
                    Request changes
                  </Button>
                  <Button
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => setDecision('APPROVED')}
                  >
                    Approve internally
                  </Button>
                </>
              )}
            {can('deliverables.request.client') &&
              (deliverable.status === 'APPROVED' ||
                deliverable.status === 'CHANGES_REQUESTED') &&
              latest && (
                <Button
                  icon={<Send className="h-4 w-4" />}
                  onClick={() => setSendingToClient(true)}
                >
                  Send to client
                </Button>
              )}
            {can('deliverables.publish') && deliverable.status === 'APPROVED' && (
              <Button
                variant="secondary"
                icon={<Sparkles className="h-4 w-4" />}
                loading={publish.isPending}
                onClick={() => publish.mutate()}
              >
                Mark published
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {isLoading || !deliverable ? (
        <div className="space-y-3">
          <div className="dd-skeleton h-6 w-2/3" />
          <div className="dd-skeleton h-32" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <DeliverableStatusBadge value={deliverable.status} />
            {deliverable.dueDate && (
              <Badge tone="neutral">Due {fmtDate(deliverable.dueDate)}</Badge>
            )}
            {deliverable.project && (
              <Link to={`/projects/${deliverable.project.id}`} onClick={onClose}>
                <Badge tone="primary">{deliverable.project.name}</Badge>
              </Link>
            )}
          </div>

          {deliverable.description && (
            <p className="whitespace-pre-wrap text-sm text-fg">{deliverable.description}</p>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-fg">Versions</h3>
            {deliverable.versions.length === 0 ? (
              <p className="text-sm text-muted">Nothing uploaded yet.</p>
            ) : (
              <ul className="space-y-3">
                {deliverable.versions.map((version) => (
                  <li key={version.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={version.id === latest?.id ? 'primary' : 'neutral'}>
                        v{version.versionNumber}
                      </Badge>
                      <span className="text-2xs text-muted">{fmtRelative(version.createdAt)}</span>
                    </div>
                    {version.notes && (
                      <p className="mt-2 text-sm text-fg">{version.notes}</p>
                    )}
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {version.files.map((file) => (
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
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <FileCheck2 className="h-4 w-4 text-muted" />
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
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-fg">Approval trail</h3>
            {deliverable.approvals.length === 0 ? (
              <p className="text-sm text-muted">No approvals requested yet.</p>
            ) : (
              <ol className="space-y-2">
                {deliverable.approvals.map((approval) => (
                  <li
                    key={approval.id}
                    className="flex items-start gap-3 rounded-lg bg-surface-2/50 px-3 py-2"
                  >
                    <Badge tone={approval.stage === 'CLIENT' ? 'warning' : 'info'}>
                      {humanise(approval.stage)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          approval.decision === 'APPROVED'
                            ? 'text-success'
                            : approval.decision === 'CHANGES_REQUESTED'
                              ? 'text-danger'
                              : 'text-muted',
                        )}
                      >
                        {humanise(approval.decision)}
                      </p>
                      {approval.comment && (
                        <p className="mt-0.5 text-sm text-fg">{approval.comment}</p>
                      )}
                      <p className="mt-0.5 text-2xs text-subtle">
                        {approval.decidedBy
                          ? `${approval.decidedBy.name} · ${fmtRelative(approval.decidedAt)}`
                          : `Requested ${fmtRelative(approval.requestedAt)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-fg">Discussion</h3>
            <CommentThread entityType="DELIVERABLE" entityId={deliverable.id} />
          </section>
        </div>
      )}

      {uploading && (
        <UploadVersionModal deliverableId={id} onClose={() => setUploading(false)} />
      )}
      {decision && (
        <InternalDecisionModal
          deliverableId={id}
          decision={decision}
          onClose={() => setDecision(null)}
        />
      )}
      {sendingToClient && (
        <SendToClientModal deliverableId={id} onClose={() => setSendingToClient(false)} />
      )}
    </Drawer>
  );
}

function UploadVersionModal({
  deliverableId,
  onClose,
}: {
  deliverableId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');

  const submit = useMutation({
    mutationFn: async () => {
      // Files are uploaded first, then attached to a new version by id.
      const uploaded = await apiUpload<FileObject[]>('/files', files, {
        folder: 'deliverables',
      });
      return apiPost(`/deliverables/${deliverableId}/versions`, {
        notes: notes || undefined,
        fileIds: uploaded.map((file) => file.id),
      });
    },
    onSuccess: () => {
      toast.success('New version uploaded');
      void queryClient.invalidateQueries({ queryKey: ['deliverable', deliverableId] });
      void queryClient.invalidateQueries({ queryKey: ['deliverables'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Upload a new version"
      description="Uploading resets the review state back to internal review."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={submit.isPending}
            disabled={files.length === 0}
            onClick={() => submit.mutate()}
          >
            Upload version
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="dd-label">Files</span>
          <input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="dd-input file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary"
          />
          {files.length > 0 && (
            <p className="dd-hint">
              {files.length} file{files.length === 1 ? '' : 's'} selected
            </p>
          )}
        </div>
        <Textarea
          label="What changed?"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes for whoever reviews this."
        />
      </div>
    </Modal>
  );
}

function InternalDecisionModal({
  deliverableId,
  decision,
  onClose,
}: {
  deliverableId: string;
  decision: 'APPROVED' | 'CHANGES_REQUESTED';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      apiPost(`/deliverables/${deliverableId}/internal-approval`, {
        decision,
        comment: comment || undefined,
      }),
    onSuccess: () => {
      toast.success(decision === 'APPROVED' ? 'Approved internally' : 'Changes requested');
      void queryClient.invalidateQueries({ queryKey: ['deliverable', deliverableId] });
      void queryClient.invalidateQueries({ queryKey: ['deliverables'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={decision === 'APPROVED' ? 'Approve internally' : 'Request changes'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={decision === 'APPROVED' ? 'primary' : 'danger'}
            loading={submit.isPending}
            onClick={() => submit.mutate()}
          >
            {decision === 'APPROVED' ? 'Approve' : 'Request changes'}
          </Button>
        </>
      }
    >
      <Textarea
        label="Comment"
        rows={3}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={
          decision === 'APPROVED'
            ? 'Anything to flag before it goes to the client?'
            : 'What needs changing?'
        }
      />
    </Modal>
  );
}

function SendToClientModal({
  deliverableId,
  onClose,
}: {
  deliverableId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      apiPost<{ sentTo: number }>(`/deliverables/${deliverableId}/request-client-approval`, {
        message: message || undefined,
      }),
    onSuccess: (result) => {
      toast.success(
        result.sentTo > 0
          ? `Sent to ${result.sentTo} client contact${result.sentTo === 1 ? '' : 's'}`
          : 'Marked for client review — no contact has approval rights yet',
      );
      void queryClient.invalidateQueries({ queryKey: ['deliverable', deliverableId] });
      void queryClient.invalidateQueries({ queryKey: ['deliverables'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Send to the client"
      description="Contacts with approval rights get an email and see it in their portal."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>
            Send for approval
          </Button>
        </>
      }
    >
      <Textarea
        label="Message to the client"
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Here is this month's content calendar for your approval."
      />
    </Modal>
  );
}
