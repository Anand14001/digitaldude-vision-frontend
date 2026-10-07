import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileCheck2, MessageSquare, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fileSize, fmtDate, fmtRelative, humanise } from '@/lib/utils';
import type { Deliverable } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Modal,
  Textarea,
} from '@/components/ui';
import { DeliverableStatusBadge } from '@/components/domain';

export function PortalApprovalsPage() {
  const { user } = useAuth();
  const canApprove = user?.client?.canApprove ?? false;
  const [deciding, setDeciding] = useState<{
    deliverable: Deliverable;
    decision: 'APPROVED' | 'CHANGES_REQUESTED';
  } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'approvals'],
    queryFn: () => apiGet<Deliverable[]>('/portal/approvals'),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  const waiting = (data ?? []).filter((item) => item.status === 'CLIENT_REVIEW');
  const settled = (data ?? []).filter((item) => item.status !== 'CLIENT_REVIEW');

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Approvals</h1>
        <p className="mt-1 text-sm text-muted">
          Review what we have shared and tell us whether it is good to go.
        </p>
      </header>

      {!canApprove && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <p className="text-sm text-muted">
            You can view everything here, but approving is reserved for a nominated contact. Ask
            your account manager if that should be you.
          </p>
        </div>
      )}

      {waiting.length === 0 && settled.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileCheck2 className="h-5 w-5" />}
            title="Nothing to review"
            description="We will email you as soon as something needs your eyes."
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {waiting.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                Waiting on you
                <Badge tone="warning">{waiting.length}</Badge>
              </h2>
              <div className="space-y-4">
                {waiting.map((deliverable) => (
                  <DeliverableReviewCard
                    key={deliverable.id}
                    deliverable={deliverable}
                    canApprove={canApprove}
                    onDecide={(decision) => setDeciding({ deliverable, decision })}
                  />
                ))}
              </div>
            </section>
          )}

          {settled.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-fg">Already decided</h2>
              <div className="space-y-4">
                {settled.map((deliverable) => (
                  <DeliverableReviewCard
                    key={deliverable.id}
                    deliverable={deliverable}
                    canApprove={false}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {deciding && (
        <DecisionModal
          deliverable={deciding.deliverable}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
        />
      )}
    </div>
  );
}

function DeliverableReviewCard({
  deliverable,
  canApprove,
  onDecide,
}: {
  deliverable: Deliverable;
  canApprove: boolean;
  onDecide?: (decision: 'APPROVED' | 'CHANGES_REQUESTED') => void;
}) {
  const latest = deliverable.versions[0];
  const clientApprovals = deliverable.approvals.filter(
    (approval) => approval.decision !== 'PENDING',
  );

  return (
    <Card>
      <CardHeader
        title={deliverable.title}
        description={
          deliverable.project?.name ??
          `${deliverable.retainerCycle?.retainer.name ?? ''} · ${deliverable.retainerCycle?.label ?? ''}`
        }
        action={<DeliverableStatusBadge value={deliverable.status} />}
      />

      <div className="px-5 py-4">
        {deliverable.description && (
          <p className="mb-4 whitespace-pre-wrap text-sm text-fg">{deliverable.description}</p>
        )}

        {latest ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Badge tone="primary">Version {latest.versionNumber}</Badge>
              <span className="text-2xs text-muted">{fmtRelative(latest.createdAt)}</span>
            </div>
            {latest.notes && (
              <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">
                {latest.notes}
              </p>
            )}

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {latest.files.map((file) => (
                <li key={file.id}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-border transition-shadow hover:shadow-pop"
                  >
                    {file.mimeType.startsWith('image/') ? (
                      <img src={file.url} alt="" className="h-36 w-full object-cover" />
                    ) : file.mimeType.startsWith('video/') ? (
                      <video src={file.url} className="h-36 w-full bg-black object-cover" controls />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-surface-2 text-sm font-semibold text-muted">
                        {file.originalName.split('.').pop()?.toUpperCase()}
                      </div>
                    )}
                    <div className="px-3 py-2">
                      <p className="truncate text-xs font-medium text-fg">{file.originalName}</p>
                      <p className="text-2xs text-subtle">{fileSize(file.sizeBytes)}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">Nothing uploaded against this yet.</p>
        )}

        {clientApprovals.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-border pt-3">
            {clientApprovals.map((approval) => (
              <li key={approval.id} className="flex items-start gap-2.5 text-sm">
                {approval.decision === 'APPROVED' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                )}
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      approval.decision === 'APPROVED' ? 'text-success' : 'text-warning',
                    )}
                  >
                    {humanise(approval.decision)}
                    {approval.decidedBy ? ` by ${approval.decidedBy.name}` : ''}
                  </p>
                  {approval.comment && <p className="text-fg">{approval.comment}</p>}
                  <p className="text-2xs text-subtle">{fmtDate(approval.decidedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canApprove && onDecide && latest && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-2/40 px-5 py-3">
          <Button variant="secondary" onClick={() => onDecide('CHANGES_REQUESTED')}>
            Request changes
          </Button>
          <Button
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={() => onDecide('APPROVED')}
          >
            Approve
          </Button>
        </div>
      )}
    </Card>
  );
}

function DecisionModal({
  deliverable,
  decision,
  onClose,
}: {
  deliverable: Deliverable;
  decision: 'APPROVED' | 'CHANGES_REQUESTED';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const approving = decision === 'APPROVED';

  const submit = useMutation({
    mutationFn: () =>
      apiPost(`/portal/approvals/${deliverable.id}/decision`, {
        decision,
        comment: comment || undefined,
      }),
    onSuccess: () => {
      toast.success(approving ? 'Approved — thank you' : 'Feedback sent to the team');
      void queryClient.invalidateQueries({ queryKey: ['portal'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={approving ? 'Approve this deliverable' : 'Request changes'}
      description={deliverable.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={approving ? 'primary' : 'danger'}
            loading={submit.isPending}
            disabled={!approving && comment.trim().length < 3}
            onClick={() => submit.mutate()}
          >
            {approving ? 'Approve' : 'Send feedback'}
          </Button>
        </>
      }
    >
      <Textarea
        label={approving ? 'Anything to add? (optional)' : 'What needs changing?'}
        required={!approving}
        rows={4}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={
          approving
            ? 'Looks great, happy to go ahead.'
            : 'Please tell us specifically what to change.'
        }
      />
      <p className="mt-3 text-xs text-muted">
        Your note goes to the project team and is recorded against this deliverable.
      </p>
    </Modal>
  );
}
