import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, MessageSquare, Send, Trash2, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtRelative } from '@/lib/utils';
import type { Comment, EmployeeListItem } from '@/types/api';
import { Avatar, Badge, Button, EmptyState, Spinner } from '@/components/ui';

type Entity = 'TASK' | 'PROJECT' | 'CLIENT' | 'LEAD' | 'DELIVERABLE' | 'RETAINER_CYCLE';

/**
 * Comment thread with @mentions and an internal/client-visible switch. Internal
 * is the default: a staff comment is never exposed to the portal unless someone
 * deliberately says it should be.
 */
export function CommentThread({
  entityType,
  entityId,
  allowClientVisible = true,
}: {
  entityType: Entity;
  entityId: string;
  allowClientVisible?: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.kind === 'CLIENT';

  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(!isClient);
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => apiGet<Comment[]>('/comments', { entityType, entityId }),
  });

  const employees = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
    enabled: !isClient,
  });

  const post = useMutation({
    mutationFn: () =>
      apiPost('/comments', { entityType, entityId, body, isInternal, mentions }),
    onSuccess: () => {
      setBody('');
      setMentions([]);
      void queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/comments/${id}`),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] }),
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  /** Watches for "@" so the mention picker can open. */
  const onBodyChange = (value: string) => {
    setBody(value);
    const match = /@(\w*)$/.exec(value);
    setMentionQuery(match && !isClient ? (match[1] ?? '') : null);
  };

  const mentionCandidates = (employees.data ?? []).filter((employee) =>
    mentionQuery
      ? employee.user.name.toLowerCase().includes(mentionQuery.toLowerCase())
      : true,
  );

  const insertMention = (employee: EmployeeListItem) => {
    setBody((current) => current.replace(/@\w*$/, `@${employee.user.name} `));
    setMentions((current) => [...new Set([...current, employee.user.id])]);
    setMentionQuery(null);
  };

  return (
    <div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : comments?.length === 0 ? (
        <EmptyState
          compact
          icon={<MessageSquare className="h-5 w-5" />}
          title="No comments yet"
          description="Start the conversation."
        />
      ) : (
        <ul className="mb-5 space-y-4">
          {comments?.map((comment) => (
            <li key={comment.id} className="group flex gap-3">
              <Avatar
                name={comment.author.name}
                src={comment.author.avatar?.url}
                size="sm"
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-fg">{comment.author.name}</span>
                  {comment.author.kind === 'CLIENT' && <Badge tone="info">Client</Badge>}
                  {!comment.isInternal && <Badge tone="warning">Client-visible</Badge>}
                  <span className="text-2xs text-subtle">{fmtRelative(comment.createdAt)}</span>
                  {comment.editedAt && <span className="text-2xs text-subtle">(edited)</span>}
                  {comment.author.id === user?.id && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(comment.id)}
                      className="ml-auto hidden text-subtle hover:text-danger group-hover:block"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="relative rounded-xl border border-border bg-surface-2/40 p-3">
        <textarea
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          rows={3}
          placeholder={
            isClient
              ? 'Write a message to the Digital Dude team…'
              : 'Add a comment. Type @ to mention someone.'
          }
          className="w-full resize-y bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
        />

        {mentionQuery !== null && mentionCandidates.length > 0 && (
          <ul className="absolute bottom-16 left-3 z-10 max-h-48 w-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-pop">
            {mentionCandidates.slice(0, 8).map((employee) => (
              <li key={employee.id}>
                <button
                  type="button"
                  onClick={() => insertMention(employee)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <Avatar name={employee.user.name} src={employee.user.avatar?.url} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">
                    {employee.user.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2">
          {!isClient && allowClientVisible ? (
            <button
              type="button"
              onClick={() => setIsInternal((value) => !value)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                isInternal
                  ? 'bg-surface-2 text-muted hover:text-fg'
                  : 'bg-warning-soft text-warning',
              )}
            >
              {isInternal ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              {isInternal ? 'Internal only' : 'Client can see this'}
            </button>
          ) : (
            <span className="text-2xs text-subtle">
              {isClient ? 'Your team will be notified' : ''}
            </span>
          )}

          <Button
            size="sm"
            icon={<Send className="h-3.5 w-3.5" />}
            loading={post.isPending}
            disabled={body.trim().length === 0}
            onClick={() => post.mutate()}
          >
            Comment
          </Button>
        </div>
      </div>

      {mentions.length > 0 && (
        <p className="mt-2 text-2xs text-muted">
          {mentions.length} {mentions.length === 1 ? 'person' : 'people'} will be notified.
        </p>
      )}
    </div>
  );
}
