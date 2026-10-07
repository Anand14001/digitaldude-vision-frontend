import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  AtSign,
  Bell,
  CalendarClock,
  CheckCheck,
  FileCheck2,
  MessageSquare,
  Palmtree,
  Repeat,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { cn, fmtRelative } from '@/lib/utils';
import type { Notification, NotificationType, Paginated } from '@/types/api';
import { Button, Drawer, EmptyState, LoadingBlock } from '../ui';

const ICONS: Partial<Record<NotificationType, typeof Bell>> = {
  TASK_ASSIGNED: FileCheck2,
  TASK_DUE_SOON: AlarmClock,
  TASK_OVERDUE: ShieldAlert,
  MENTION: AtSign,
  COMMENT_REPLY: MessageSquare,
  APPROVAL_REQUESTED: FileCheck2,
  APPROVAL_DECIDED: CheckCheck,
  LEAVE_REQUESTED: Palmtree,
  LEAVE_DECIDED: Palmtree,
  TIMESHEET_SUBMITTED: CalendarClock,
  TIMESHEET_DECIDED: CalendarClock,
  PROJECT_STAGE_CHANGED: Repeat,
  RETAINER_RENEWAL_DUE: Repeat,
  DOCUMENT_EXPIRING: ShieldAlert,
};

const TONES: Partial<Record<NotificationType, string>> = {
  TASK_OVERDUE: 'bg-danger-soft text-danger',
  TASK_DUE_SOON: 'bg-warning-soft text-warning',
  MENTION: 'bg-primary-soft text-primary',
  APPROVAL_REQUESTED: 'bg-warning-soft text-warning',
  APPROVAL_DECIDED: 'bg-success-soft text-success',
  LEAVE_DECIDED: 'bg-success-soft text-success',
  DOCUMENT_EXPIRING: 'bg-danger-soft text-danger',
};

export function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<Paginated<Notification>['data']>('/notifications?pageSize=50'),
    enabled: open,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['badges'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => apiPost(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const markAll = useMutation({
    mutationFn: () => apiPost('/notifications/read-all'),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/notifications/${id}`),
    onSuccess: invalidate,
  });

  const notifications = data ?? [];
  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          Notifications
          {unread > 0 && (
            <span className="rounded-full bg-danger px-2 py-0.5 text-2xs font-semibold text-white">
              {unread}
            </span>
          )}
        </span>
      }
      footer={
        unread > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<CheckCheck className="h-4 w-4" />}
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <LoadingBlock />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="Nothing new"
          description="Assignments, approvals and mentions will show up here."
        />
      ) : (
        <ul className="-mx-2 divide-y divide-border">
          {notifications.map((notification) => {
            const Icon = ICONS[notification.type] ?? Bell;
            return (
              <li key={notification.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!notification.readAt) markRead.mutate(notification.id);
                    if (notification.link) {
                      onClose();
                      navigate(notification.link);
                    }
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-2',
                    !notification.readAt && 'bg-primary-soft/40',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      TONES[notification.type] ?? 'bg-surface-2 text-muted',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm',
                        notification.readAt ? 'text-fg' : 'font-medium text-fg',
                      )}
                    >
                      {notification.title}
                    </span>
                    {notification.body && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted">
                        {notification.body}
                      </span>
                    )}
                    <span className="mt-1 block text-2xs text-subtle">
                      {fmtRelative(notification.createdAt)}
                    </span>
                  </span>
                  {!notification.readAt && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => remove.mutate(notification.id)}
                  className="absolute right-2 top-2 hidden rounded-md p-1 text-subtle hover:bg-surface hover:text-danger group-hover:block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
