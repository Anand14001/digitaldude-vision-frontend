/**
 * API contract as the UI consumes it.
 *
 * Enum unions and permission keys are generated from the API by
 * `npm run sync:contract` (see src/types/contract.ts). Response shapes below are
 * declared by hand: they intentionally describe only the fields this client
 * reads, so an additive API change never breaks the build.
 */

export type {
  PermissionKey,
  UserKind,
  UserStatus,
  ThemePreference,
  ProjectKind,
  ProjectStatus,
  Priority,
  HealthStatus,
  TaskStatusCategory,
  ClientStatus,
  LeadStatus,
  LeadSource,
  EmployeeStatus,
  EmploymentType,
  RetainerStatus,
  BillingCycle,
  CycleStatus,
  DeliverableStatus,
  TimesheetStatus,
  AttendanceStatus,
  LeaveRequestStatus,
  ReviewStatus,
  GoalStatus,
  AuditAction,
  NotificationType,
  EventType,
} from './contract';

import type {
  AttendanceStatus,
  AuditAction,
  BillingCycle,
  ClientStatus,
  CycleStatus,
  DeliverableStatus,
  EmployeeStatus,
  EmploymentType,
  EventType,
  GoalStatus,
  HealthStatus,
  LeadSource,
  LeadStatus,
  LeaveRequestStatus,
  NotificationType,
  PermissionKey,
  Priority,
  ProjectKind,
  ProjectStatus,
  ReviewStatus,
  RetainerStatus,
  TaskStatusCategory,
  ThemePreference,
  TimesheetStatus,
  UserKind,
} from './contract';

// ----------------------------------------------------------------- envelopes
export interface Envelope<T> {
  data: T;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  [extra: string]: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

// ------------------------------------------------------------------- session
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  kind: UserKind;
  phone: string | null;
  theme: ThemePreference;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  role: { id: string; name: string; isAdmin: boolean } | null;
  employee: {
    id: string;
    code: string;
    designation: string | null;
    department: string | null;
  } | null;
  client: {
    id: string;
    name: string;
    logoUrl: string | null;
    canApprove: boolean;
  } | null;
}

export interface Session {
  user: SessionUser;
  permissions: PermissionKey[];
}

export interface LoginResponse extends Session {
  accessToken: string;
}

// --------------------------------------------------------------- shared bits
export interface NamedRef {
  id: string;
  name: string;
}

export interface UserRef {
  id: string;
  name: string;
  avatar?: { url: string } | null;
}

export interface EmployeeRef {
  id: string;
  employeeCode?: string;
  user: UserRef;
  designation?: { title: string } | null;
}

export interface TaskStatusRef {
  id: string;
  name: string;
  color: string;
  category: TaskStatusCategory;
  sortOrder?: number;
  isDefault?: boolean;
}

export interface StageRef {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
  isTerminal?: boolean;
  isClientFacing?: boolean;
}

// -------------------------------------------------------------------- clients
export interface ClientListItem {
  id: string;
  name: string;
  status: ClientStatus;
  industry: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  logo: { url: string } | null;
  accountManager: { id: string; user: { name: string } } | null;
  serviceLines: { serviceLine: NamedRef }[];
  _count: { projects: number; retainers: number; contacts: number };
}

export interface ClientContact {
  id: string;
  clientId: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  isPrimary: boolean;
  portalEnabled: boolean;
  canApprove: boolean;
}

export interface ClientDetail extends Omit<ClientListItem, '_count'> {
  legalName: string | null;
  website: string | null;
  gstin: string | null;
  addressLine: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  notes: string | null;
  onboardedAt: string | null;
  contacts: ClientContact[];
  projects: {
    id: string;
    code: string;
    name: string;
    status: ProjectStatus;
    health: HealthStatus;
    dueDate: string | null;
    currentStage: { name: string; color: string } | null;
  }[];
  retainers: {
    id: string;
    code: string;
    name: string;
    status: RetainerStatus;
    billingCycle: BillingCycle;
    amountPerCycle: string | null;
    endDate: string | null;
  }[];
}

// ---------------------------------------------------------------------- leads
export interface Lead {
  id: string;
  title: string;
  companyName: string | null;
  contactName: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  estimatedValue: string | null;
  requirement: string | null;
  nextFollowUpAt: string | null;
  lostReason: string | null;
  createdAt: string;
  owner: { id: string; user: { name: string } } | null;
  client: NamedRef | null;
  _count?: { activities: number };
}

export interface LeadActivity {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'NOTE' | 'STATUS_CHANGE';
  summary: string;
  occurredAt: string;
}

export interface LeadPipeline {
  columns: {
    status: LeadStatus;
    leads: Lead[];
    count: number;
    value: string | null;
  }[];
}

// ------------------------------------------------------------------- projects
export interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  priority: Priority;
  health: HealthStatus;
  startDate: string | null;
  dueDate: string | null;
  visibleToClient: boolean;
  createdAt: string;
  /// null for an internal project.
  client: NamedRef | null;
  currentStage: StageRef | null;
  serviceLine: NamedRef | null;
  manager: { id: string; user: { name: string } } | null;
  members: {
    id?: string;
    role?: string;
    allocationHours?: string | null;
    employee: EmployeeRef;
  }[];
  _count: { tasks: number; deliverables: number; files?: number };
}

export interface ProjectDetail extends ProjectListItem {
  description: string | null;
  budgetAmount?: string | null;
  currency: string;
  estimateHours: string | null;
  completedAt: string | null;
  workflowId: string;
  projectType: NamedRef | null;
  workflow: {
    id: string;
    name: string;
    stages: StageRef[];
    taskStatuses: TaskStatusRef[];
  };
  milestones: {
    id: string;
    title: string;
    dueDate: string;
    completedAt: string | null;
    description: string | null;
  }[];
  stageHistory: {
    id: string;
    enteredAt: string;
    exitedAt: string | null;
    note: string | null;
    stage: { name: string; color: string };
  }[];
  loggedHours: string | number;
  taskBreakdown: { statusId: string; _count: { _all: number } }[];
}

export interface ProjectBoard {
  stages: (StageRef & { projects: ProjectListItem[] })[];
  unstaged: ProjectListItem[];
}

// ---------------------------------------------------------------------- tasks
export interface TaskListItem {
  id: string;
  reference: string;
  title: string;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimateHours: string | null;
  sortOrder: number;
  visibleToClient: boolean;
  createdAt: string;
  status: TaskStatusRef;
  stage: StageRef | null;
  assignee: EmployeeRef | null;
  project: { id: string; code: string; name: string; client: { name: string } } | null;
  retainerCycle: {
    id: string;
    label: string;
    retainer: { name: string; client: { name: string } };
  } | null;
  _count: { subtasks: number; checklist: number; files: number };
}

export interface TaskDetail extends TaskListItem {
  description: string | null;
  projectId: string | null;
  retainerCycleId: string | null;
  statusId: string;
  assigneeId: string | null;
  parentTask: { id: string; reference: string; title: string } | null;
  subtasks: TaskListItem[];
  checklist: { id: string; label: string; completedAt: string | null; sortOrder: number }[];
  dependsOn: {
    id: string;
    blockingTask: { id: string; reference: string; title: string; completedAt: string | null };
  }[];
  blocking: {
    id: string;
    task: { id: string; reference: string; title: string; completedAt: string | null };
  }[];
  watchers: { userId: string; user: NamedRef }[];
  files: FileObject[];
  timeEntries: TimeEntry[];
  loggedHours: string | number;
}

export interface MyTasks {
  overdue: TaskListItem[];
  today: TaskListItem[];
  upcoming: TaskListItem[];
  unscheduled: TaskListItem[];
}

export interface TaskBoard {
  columns: { status: TaskStatusRef; tasks: TaskListItem[] }[];
}

// ------------------------------------------------------------------ workflows
export interface WorkflowDefaultTask {
  id?: string;
  title: string;
  description?: string | null;
  estimateHours?: string | number | null;
  dueOffsetDays: number;
}

export interface WorkflowStage extends StageRef {
  description?: string | null;
  defaultTasks: WorkflowDefaultTask[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  projectTypeId: string | null;
  isArchived: boolean;
  projectType: NamedRef | null;
  stages: WorkflowStage[];
  taskStatuses: TaskStatusRef[];
  _count: { projects: number; retainers: number };
}

export interface ProjectType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  defaultWorkflowId: string | null;
  defaultWorkflow: NamedRef | null;
  _count?: { projects: number; retainers: number };
}

// ------------------------------------------------------------------ retainers
export interface RetainerListItem {
  id: string;
  code: string;
  name: string;
  status: RetainerStatus;
  billingCycle: BillingCycle;
  amountPerCycle?: string | null;
  startDate: string;
  endDate: string | null;
  client: NamedRef;
  serviceLine: NamedRef | null;
  cycles: RetainerCycleRef[];
  _count: { cycles: number };
}

export interface RetainerCycleRef {
  id: string;
  label: string;
  status: CycleStatus;
  periodStart: string;
  periodEnd: string;
}

export interface RetainerDetail extends Omit<RetainerListItem, 'cycles'> {
  scopeNotes: string | null;
  cycleStartDay: number;
  autoGenerateCycles: boolean;
  workflow: { id: string; name: string; stages: StageRef[]; taskStatuses: TaskStatusRef[] };
  cycles: (RetainerCycleRef & {
    currentStage: StageRef | null;
    notes: string | null;
    _count: { tasks: number; deliverables: number };
  })[];
}

// --------------------------------------------------------------- deliverables
export interface DeliverableVersion {
  id: string;
  versionNumber: number;
  notes: string | null;
  createdAt: string;
  files: FileObject[];
}

export interface Deliverable {
  id: string;
  title: string;
  description: string | null;
  status: DeliverableStatus;
  dueDate: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  project: { id: string; code: string; name: string; client: NamedRef } | null;
  retainerCycle: { id: string; label: string; retainer: { id: string; name: string; client: NamedRef } } | null;
  versions: DeliverableVersion[];
  approvals: {
    id: string;
    stage: 'INTERNAL' | 'CLIENT';
    decision: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
    comment: string | null;
    requestedAt: string;
    decidedAt: string | null;
    decidedBy: { id: string; name: string; kind: UserKind } | null;
  }[];
}

// ------------------------------------------------------------------ employees
export interface EmployeeListItem {
  id: string;
  employeeCode: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  dateOfJoining: string;
  weeklyCapacityHours: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    lastLoginAt?: string | null;
    avatar: { url: string } | null;
    role: NamedRef | null;
  };
  department: NamedRef | null;
  designation: { id: string; title: string } | null;
  reportingTo: { id: string; user: { name: string } } | null;
  skills: { level: string; skill: NamedRef }[];
  _count: { tasksAssigned: number; projectMemberships: number };
}

export interface EmployeeDetail extends EmployeeListItem {
  dateOfBirth?: string | null;
  personalEmail?: string | null;
  personalPhone?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  bloodGroup?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  probationEnd: string | null;
  dateOfExit: string | null;
  notes: string | null;
  reports: { id: string; user: { name: string }; designation: { title: string } | null }[];
  documents?: {
    id: string;
    type: string;
    title: string;
    expiresAt: string | null;
    createdAt: string;
    file: { id: string; url: string; originalName: string; mimeType: string };
  }[];
  compensation?: {
    id: string;
    effectiveFrom: string;
    ctcAnnual: string;
    currency: string;
    note: string | null;
  }[];
  assetAssignments: {
    id: string;
    assignedAt: string;
    asset: { id: string; assetTag: string; name: string; category: string };
  }[];
  checklistItems: {
    id: string;
    kind: 'ONBOARDING' | 'OFFBOARDING';
    label: string;
    dueDate: string | null;
    completedAt: string | null;
  }[];
  projectMemberships: {
    id: string;
    role: string;
    allocationHours: string | null;
    project: {
      id: string;
      code: string;
      name: string;
      status: ProjectStatus;
      client: { name: string };
    };
  }[];
  goals: Goal[];
}

export interface WorkloadRow {
  employee: {
    id: string;
    code: string;
    name: string;
    avatarUrl: string | null;
    designation: string | null;
  };
  capacityHours: number;
  allocatedHours: number;
  loggedHours: number;
  openTasks: number;
  openEstimateHours: number;
  utilizationPercent: number | null;
  overAllocated: boolean;
  activeProjects: string[];
}

// ----------------------------------------------------------------------- time
export interface TimeEntry {
  id: string;
  employeeId: string;
  workDate: string;
  hours: string;
  billable: boolean;
  note: string | null;
  employee?: { id: string; user: { name: string } };
  task?: { id: string; reference: string; title: string } | null;
  project?: { id: string; code: string; name: string; client?: { name: string } } | null;
  timesheet?: { id: string; status: TimesheetStatus } | null;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  weekStart: string;
  weekEnd: string;
  status: TimesheetStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  entries?: TimeEntry[];
  employee?: { id: string; employeeCode: string; user: { name: string } };
  totalHours?: number;
  billableHours?: number;
}

export interface MyTimesheet {
  weekStart: string;
  weekEnd: string;
  timesheet: (Timesheet & { entries: TimeEntry[] }) | null;
  totalHours: number;
}

// ----------------------------------------------------------------- attendance
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number | null;
  lateMinutes: number | null;
  note: string | null;
  employee?: { id: string; employeeCode: string; user: { name: string } };
}

export interface AttendanceToday {
  record: AttendanceRecord | null;
  holiday: { id: string; name: string; date: string } | null;
  isWorkingDay: boolean;
  schedule: { startTime: string; endTime: string };
}

export interface AttendanceMonth {
  month: number;
  year: number;
  days: string[];
  rows: {
    employee: { id: string; code: string; name: string; department: string | null };
    days: {
      date: string;
      status: AttendanceStatus | null;
      lateMinutes?: number | null;
      leaveCode?: string;
    }[];
  }[];
}

// ---------------------------------------------------------------------- leave
export interface LeaveType {
  id: string;
  name: string;
  code: string;
  annualQuota: string;
  isPaid: boolean;
  carryForward: boolean;
  requiresProof: boolean;
  active: boolean;
}

export interface LeaveBalance {
  id: string;
  year: number;
  entitled: string;
  used: string;
  carriedOver: string;
  available?: number;
  leaveType: { id: string; name: string; code: string };
  employee?: { id: string; employeeCode: string; user: { name: string } };
}

export interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string | null;
  status: LeaveRequestStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  leaveType: { id: string; name: string; code: string; isPaid: boolean };
  employee: {
    id: string;
    employeeCode: string;
    user: UserRef;
    reportingTo?: { id: string } | null;
  };
  approver: { id: string; user: { name: string } } | null;
  proofFile: { id: string; url: string; originalName: string } | null;
}

// ---------------------------------------------------------------- performance
export interface ReviewCycle {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  dueDate: string | null;
  _count?: { reviews: number };
}

export interface PerformanceReview {
  id: string;
  cycleId: string;
  employeeId: string;
  reviewerId: string | null;
  status: ReviewStatus;
  selfRating: number | null;
  managerRating: number | null;
  selfComments: string | null;
  managerComments?: string | null;
  strengths: string | null;
  improvements: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  cycle: ReviewCycle;
  employee?: {
    id: string;
    employeeCode: string;
    user: UserRef;
    designation: { title: string } | null;
  };
  reviewer: { id: string; user: { name: string } } | null;
}

export interface Goal {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  metric: string | null;
  target: string | null;
  current: string | null;
  weight: number;
  status: GoalStatus;
  dueDate: string | null;
  employee?: { id: string; user: { name: string } };
}

// ------------------------------------------------------------------- calendar
export interface CalendarItem {
  source: 'event' | 'task' | 'milestone' | 'leave' | 'holiday' | 'cycle';
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  meta: Record<string, unknown>;
}

export interface CalendarFeed {
  from: string;
  to: string;
  items: CalendarItem[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  attendees: { userId: string; response: string; user: NamedRef }[];
}

// -------------------------------------------------------------------- comments
export interface Comment {
  id: string;
  entityType: string;
  entityId: string;
  body: string;
  mentions: string[];
  isInternal: boolean;
  parentId: string | null;
  editedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; kind: UserKind; avatar: { url: string } | null };
}

// ----------------------------------------------------------------------- files
export interface FileObject {
  id: string;
  originalName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: string;
  uploadedBy?: NamedRef | null;
  project?: NamedRef | null;
}

// --------------------------------------------------------------- notifications
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

// ------------------------------------------------------------------- dashboard
export interface DashboardPayload {
  role: string | null;
  isAdmin: boolean;
  me: {
    openTasks: number;
    overdueTasks: number;
    dueToday: number;
    dueThisWeek: number;
    attendance: { status: AttendanceStatus; checkInAt: string | null; checkOutAt: string | null } | null;
    unreadNotifications: number;
  };
  upcomingTasks: {
    id: string;
    reference: string;
    title: string;
    dueDate: string | null;
    priority: Priority;
    status: { name: string; color: string };
    project: { id: string; code: string; name: string } | null;
  }[];
  projects?: {
    byStatus: { status: ProjectStatus; count: number }[];
    byHealth: { health: HealthStatus; count: number }[];
    dueSoon: {
      id: string;
      code: string;
      name: string;
      dueDate: string | null;
      health: HealthStatus;
      client: { name: string };
      currentStage: { name: string; color: string } | null;
    }[];
    recent: {
      id: string;
      code: string;
      name: string;
      status: ProjectStatus;
      createdAt: string;
      client: { name: string };
    }[];
  };
  team?: {
    headcount: number;
    presentToday: number;
    pendingLeaveApprovals: number;
    pendingTimesheetApprovals: number;
    members: {
      id: string;
      name: string;
      avatarUrl: string | null;
      designation: string | null;
      openTasks: number;
      overdueTasks: number;
    }[];
  };
  commercial?: {
    activeClients: number;
    activeRetainers: number;
    monthlyRecurringValue: string | number;
    renewalsDueIn30Days: number;
    openPipelineValue: string | number;
    openLeads: number;
  };
  approvals?: { deliverablesInternal?: number; awaitingClient?: number };
  upcomingHolidays: { id: string; name: string; date: string }[];
  whoIsOff: { id: string; name: string; from: string; to: string; type: string }[];
  recentActivity?: ActivityLog[];
}

export interface SidebarBadges {
  overdueTasks: number;
  notifications: number;
  leaveApprovals: number;
  timesheetApprovals: number;
  deliverableReviews: number;
}

// ----------------------------------------------------------------------- logs
export interface ActivityLog {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  actorLabel: string;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  ip: string | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string; kind: UserKind } | null;
}

// -------------------------------------------------------- roles, users, masters
export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isAdmin: boolean;
  permissions: PermissionKey[];
  _count?: { users: number };
}

export interface PermissionGroup {
  module: string;
  label: string;
  permissions: { key: PermissionKey; label: string }[];
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  kind: UserKind;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string; isAdmin: boolean } | null;
  employee: { id: string; employeeCode: string } | null;
  clientContact?: { client: NamedRef } | null;
  permissionGrants?: { id: string; permission: PermissionKey; allow: boolean }[];
}

export interface MasterRecord {
  id: string;
  name?: string;
  title?: string;
  code?: string | null;
  [key: string]: unknown;
}

export interface OrgSettings {
  profile: {
    name: string;
    legalName?: string;
    tagline?: string;
    email?: string;
    phone?: string;
    website?: string;
    gstin?: string;
    addressLine?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country: string;
    currency: string;
    timezone: string;
    financialYearStartMonth: number;
    logoFileId?: string | null;
    logoUrl: string | null;
  };
  features: Record<string, boolean>;
}

// --------------------------------------------------------------------- reports
export interface UtilizationReport {
  range: { from: string; to: string };
  summary: {
    headcount: number;
    totalCapacityHours: number;
    totalLoggedHours: number;
    totalBillableHours: number;
    utilizationPercent: number | null;
    billablePercent: number | null;
  };
  rows: {
    employee: {
      id: string;
      code: string;
      name: string;
      department: string | null;
      designation: string | null;
    };
    capacityHours: number;
    loggedHours: number;
    billableHours: number;
    utilizationPercent: number | null;
    billablePercent: number | null;
  }[];
}

export interface DeliveryReport {
  range: { from: string; to: string };
  completedCount: number;
  onTimeCount: number;
  onTimePercent: number | null;
  overdueOpenCount: number;
  averageDaysLate: number | null;
  byStatus: { status: ProjectStatus; count: number }[];
  byServiceLine: { serviceLine: string; count: number }[];
  lateProjects: {
    id: string;
    code: string;
    name: string;
    daysLate: number;
    client: { name: string };
  }[];
}

export interface StageCycleReport {
  range: { from: string; to: string };
  stages: {
    stageId: string;
    name: string;
    color: string;
    samples: number;
    averageDays: number;
    medianDays: number;
    maxDays: number;
  }[];
}

export interface TimeByClientReport {
  range: { from: string; to: string };
  rows: {
    clientId: string;
    clientName: string;
    hours: number;
    billableHours: number;
    projects: { name: string; hours: number }[];
  }[];
}

export interface LeadConversionReport {
  range: { from: string; to: string };
  summary: {
    total: number;
    won: number;
    lost: number;
    conversionPercent: number | null;
    wonValue: number;
    averageDaysToWin: number | null;
  };
  byStatus: { status: LeadStatus; count: number; value: string | number }[];
  bySource: { source: LeadSource; count: number; value: string | number }[];
}

export interface RetainerHealthReport {
  activeRetainers: number;
  renewalsDue: {
    id: string;
    code: string;
    name: string;
    endDate: string;
    billingCycle: BillingCycle;
    amountPerCycle?: string;
    client: NamedRef;
  }[];
  cyclesByStatus: { status: CycleStatus; count: number }[];
  revenueByCycle?: {
    billingCycle: BillingCycle;
    count: number;
    totalPerCycle: string | number;
  }[];
}

// ---------------------------------------------------------------------- portal
export interface PortalOverview {
  client: {
    id: string;
    name: string;
    logo: { url: string } | null;
    accountManager: {
      user: { name: string; email: string; phone: string | null; avatar: { url: string } | null };
      designation: { title: string } | null;
    } | null;
  };
  canApprove: boolean;
  summary: {
    activeProjects: number;
    completedProjects: number;
    activeRetainers: number;
    awaitingYourApproval: number;
  };
  projects: {
    id: string;
    code: string;
    name: string;
    status: ProjectStatus;
    startDate: string | null;
    dueDate: string | null;
    completedAt: string | null;
    currentStage: StageRef | null;
    workflow: { stages: StageRef[] };
  }[];
  retainers: {
    id: string;
    name: string;
    status: RetainerStatus;
    billingCycle: BillingCycle;
    cycles: RetainerCycleRef[];
  }[];
  recentDeliverables: {
    id: string;
    title: string;
    status: DeliverableStatus;
    dueDate: string | null;
    updatedAt: string;
    project: NamedRef | null;
  }[];
}

export interface PortalProject {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  progressPercent: number;
  currentStage: StageRef | null;
  workflow: { stages: StageRef[] };
  manager: { user: { name: string; email: string; avatar: { url: string } | null } } | null;
  milestones: {
    id: string;
    title: string;
    dueDate: string;
    completedAt: string | null;
    description: string | null;
  }[];
  tasks: {
    id: string;
    title: string;
    dueDate: string | null;
    completedAt: string | null;
    status: { name: string; color: string; category: TaskStatusCategory };
  }[];
  deliverables: {
    id: string;
    title: string;
    status: DeliverableStatus;
    dueDate: string | null;
    versions: DeliverableVersion[];
  }[];
  stageHistory: { enteredAt: string; stage: { name: string; color: string } }[];
}

export interface PortalActivityItem {
  type: 'stage' | 'deliverable';
  id: string;
  at: string;
  title: string;
  projectId: string | null;
}
