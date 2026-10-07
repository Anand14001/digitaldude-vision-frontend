import type { ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react';
import { Badge } from './ui';
import { cn, humanise } from '@/lib/utils';
import type {
  AttendanceStatus,
  ClientStatus,
  CycleStatus,
  DeliverableStatus,
  EmployeeStatus,
  GoalStatus,
  HealthStatus,
  LeadStatus,
  LeaveRequestStatus,
  Priority,
  ProjectStatus,
  RetainerStatus,
  ReviewStatus,
  TaskStatusCategory,
  TimesheetStatus,
} from '@/types/api';

/**
 * Status rendering lives here so one enum never shows up as two different
 * colours in two different screens.
 */

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const map = <T extends string>(lookup: Record<T, Tone>) => lookup;

const PROJECT_STATUS = map<ProjectStatus>({
  PLANNING: 'info',
  ACTIVE: 'primary',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
});

const HEALTH = map<HealthStatus>({
  ON_TRACK: 'success',
  AT_RISK: 'warning',
  OFF_TRACK: 'danger',
});

const CLIENT_STATUS = map<ClientStatus>({
  PROSPECT: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  CHURNED: 'neutral',
});

const LEAD_STATUS = map<LeadStatus>({
  NEW: 'neutral',
  CONTACTED: 'info',
  QUALIFIED: 'primary',
  PROPOSAL_SENT: 'info',
  NEGOTIATION: 'warning',
  WON: 'success',
  LOST: 'danger',
});

const EMPLOYEE_STATUS = map<EmployeeStatus>({
  ONBOARDING: 'info',
  ACTIVE: 'success',
  ON_NOTICE: 'warning',
  EXITED: 'neutral',
});

const RETAINER_STATUS = map<RetainerStatus>({
  ACTIVE: 'success',
  PAUSED: 'warning',
  ENDED: 'neutral',
});

const CYCLE_STATUS = map<CycleStatus>({
  UPCOMING: 'neutral',
  IN_PROGRESS: 'primary',
  DELIVERED: 'info',
  CLOSED: 'success',
});

const DELIVERABLE_STATUS = map<DeliverableStatus>({
  DRAFT: 'neutral',
  INTERNAL_REVIEW: 'info',
  CLIENT_REVIEW: 'warning',
  CHANGES_REQUESTED: 'danger',
  APPROVED: 'success',
  PUBLISHED: 'primary',
});

const TIMESHEET_STATUS = map<TimesheetStatus>({
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
});

const LEAVE_STATUS = map<LeaveRequestStatus>({
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
});

const ATTENDANCE_STATUS = map<AttendanceStatus>({
  PRESENT: 'success',
  WORK_FROM_HOME: 'info',
  HALF_DAY: 'warning',
  ON_LEAVE: 'primary',
  HOLIDAY: 'neutral',
  WEEKLY_OFF: 'neutral',
  ABSENT: 'danger',
});

const REVIEW_STATUS = map<ReviewStatus>({
  PENDING_SELF: 'warning',
  PENDING_MANAGER: 'info',
  COMPLETED: 'success',
});

const GOAL_STATUS = map<GoalStatus>({
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'primary',
  ACHIEVED: 'success',
  MISSED: 'danger',
});

const TASK_CATEGORY = map<TaskStatusCategory>({
  TODO: 'neutral',
  IN_PROGRESS: 'primary',
  BLOCKED: 'danger',
  REVIEW: 'warning',
  DONE: 'success',
  CANCELLED: 'neutral',
});

function make<T extends string>(lookup: Record<T, Tone>) {
  return function StatusBadge({ value, label }: { value: T; label?: ReactNode }) {
    return <Badge tone={lookup[value] ?? 'neutral'}>{label ?? humanise(value)}</Badge>;
  };
}

export const ProjectStatusBadge = make(PROJECT_STATUS);
export const ClientStatusBadge = make(CLIENT_STATUS);
export const LeadStatusBadge = make(LEAD_STATUS);
export const EmployeeStatusBadge = make(EMPLOYEE_STATUS);
export const RetainerStatusBadge = make(RETAINER_STATUS);
export const CycleStatusBadge = make(CYCLE_STATUS);
export const DeliverableStatusBadge = make(DELIVERABLE_STATUS);
export const TimesheetStatusBadge = make(TIMESHEET_STATUS);
export const LeaveStatusBadge = make(LEAVE_STATUS);
export const AttendanceStatusBadge = make(ATTENDANCE_STATUS);
export const ReviewStatusBadge = make(REVIEW_STATUS);
export const GoalStatusBadge = make(GOAL_STATUS);
export const TaskCategoryBadge = make(TASK_CATEGORY);

/** Health gets an icon too: it is the field people scan a list for. */
export function HealthBadge({ value }: { value: HealthStatus }) {
  return (
    <Badge tone={HEALTH[value]} dot>
      {humanise(value)}
    </Badge>
  );
}

const PRIORITY_META: Record<
  Priority,
  { tone: Tone; icon: typeof ArrowUp; label: string }
> = {
  LOW: { tone: 'neutral', icon: ArrowDown, label: 'Low' },
  MEDIUM: { tone: 'info', icon: Minus, label: 'Medium' },
  HIGH: { tone: 'warning', icon: ArrowUp, label: 'High' },
  URGENT: { tone: 'danger', icon: Flame, label: 'Urgent' },
};

export function PriorityBadge({
  value,
  compact,
}: {
  value: Priority;
  compact?: boolean;
}) {
  const meta = PRIORITY_META[value];
  const Icon = meta.icon;
  if (compact) {
    const colours: Record<Tone, string> = {
      neutral: 'text-subtle',
      primary: 'text-primary',
      info: 'text-info',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger',
    };
    return (
      <span title={`${meta.label} priority`} className={colours[meta.tone]}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <Badge tone={meta.tone}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

/** Red pill for anything past its due date; used in lists and on cards. */
export function OverdueFlag({ days }: { days?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-medium text-danger">
      <AlertTriangle className="h-3 w-3" />
      {days ? `${days}d overdue` : 'Overdue'}
    </span>
  );
}

/** Horizontal stage track, shared by project detail and the client portal. */
export function StageTrack({
  stages,
  currentStageId,
  complete,
}: {
  stages: { id: string; name: string; color: string }[];
  currentStageId?: string | null;
  complete?: boolean;
}) {
  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);

  return (
    <ol className="flex items-stretch gap-1.5 overflow-x-auto no-scrollbar">
      {stages.map((stage, index) => {
        const done = complete || (currentIndex >= 0 && index < currentIndex);
        const active = !complete && index === currentIndex;
        return (
          <li key={stage.id} className="min-w-[7.5rem] flex-1">
            <div
              className="h-1.5 rounded-full transition-colors"
              style={{
                backgroundColor: done || active ? stage.color : undefined,
              }}
              // Future stages stay neutral so the current one stands out.
              data-state={done ? 'done' : active ? 'active' : 'todo'}
            >
              {!done && !active && <div className="h-full rounded-full bg-border" />}
            </div>
            <p
              className={cn(
                'mt-1.5 truncate text-2xs',
                active ? 'font-semibold text-fg' : done ? 'text-muted' : 'text-subtle',
              )}
              title={stage.name}
            >
              {stage.name}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
