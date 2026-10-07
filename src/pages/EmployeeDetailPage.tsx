import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Pencil,
  Camera,
  FileText,
  Laptop,
  Mail,
  Phone,
  Plus,
  ShieldAlert,
  Target,
  UserMinus,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost, apiPut, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtCurrency, fmtDate, humanise } from '@/lib/utils';
import type { EmployeeDetail, MasterRecord } from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ColourBadge,
  EmptyState,
  ErrorState,
  Field,
  FieldGrid,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
} from '@/components/ui';
import {
  EmployeeStatusBadge,
  GoalStatusBadge,
  ProjectStatusBadge,
} from '@/components/domain';

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [offboarding, setOffboarding] = useState(false);
  const [addingSkills, setAddingSkills] = useState(false);
  const [addingCompensation, setAddingCompensation] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState(false);

  const { data: employee, isLoading, error, refetch } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => apiGet<EmployeeDetail>(`/employees/${id}`),
    enabled: Boolean(id),
  });

  const toggleChecklist = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      apiPatch(`/employees/checklist/${itemId}`, { completed }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['employee', id] }),
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!employee) return null;

  const isSelf = employee.id === user?.employee?.id;
  const onboarding = employee.checklistItems.filter((item) => item.kind === 'ONBOARDING');
  const offboardingItems = employee.checklistItems.filter(
    (item) => item.kind === 'OFFBOARDING',
  );
  const onboardingDone = onboarding.filter((item) => item.completedAt).length;

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Link to="/employees" className="hover:text-fg">
            Employees
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar
              name={employee.user.name}
              src={employee.user.avatar?.url}
              size="md"
            />
            {employee.user.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="font-mono text-xs">{employee.employeeCode}</span>
            {employee.designation && (
              <>
                <span>·</span>
                <span>{employee.designation.title}</span>
              </>
            )}
            {employee.department && (
              <>
                <span>·</span>
                <span>{employee.department.name}</span>
              </>
            )}
          </span>
        }
        meta={
          <>
            <EmployeeStatusBadge value={employee.status} />
            {employee.user.role && <Badge tone="primary">{employee.user.role.name}</Badge>}
            <Badge tone="neutral">{humanise(employee.employmentType)}</Badge>
            {employee.user.status === 'INVITED' && <Badge tone="warning">Invite pending</Badge>}
            {employee.user.status === 'SUSPENDED' && <Badge tone="danger">Access suspended</Badge>}
          </>
        }
        actions={
          <>
            {can('employees.update') && (
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit employee
              </Button>
            )}
            {can('employees.delete') && employee.status !== 'EXITED' && !isSelf && (
              <Button
                variant="secondary"
                icon={<UserMinus className="h-4 w-4" />}
                onClick={() => setOffboarding(true)}
              >
                Offboard
              </Button>
            )}
          </>
        }
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab value="overview">Overview</Tab>
          <Tab value="projects" count={employee.projectMemberships.length}>
            Projects
          </Tab>
          <Tab value="onboarding" count={onboarding.length}>
            Onboarding
          </Tab>
          <Tab value="assets" count={employee.assetAssignments.length}>
            Assets
          </Tab>
          {employee.documents && (
            <Tab value="documents" count={employee.documents.length}>
              Documents
            </Tab>
          )}
          <Tab value="goals" count={employee.goals.length}>
            Goals
          </Tab>
          {employee.compensation && <Tab value="pay">Compensation</Tab>}
        </TabList>

        <TabPanel value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Work details" />
              <div className="px-5 py-4">
                <FieldGrid>
                  <Field label="Employee code">{employee.employeeCode}</Field>
                  <Field label="Designation">{employee.designation?.title}</Field>
                  <Field label="Department">{employee.department?.name}</Field>
                  <Field label="Reports to">
                    {employee.reportingTo ? (
                      <Link
                        to={`/employees/${employee.reportingTo.id}`}
                        className="text-primary hover:underline"
                      >
                        {employee.reportingTo.user.name}
                      </Link>
                    ) : null}
                  </Field>
                  <Field label="Employment type">{humanise(employee.employmentType)}</Field>
                  <Field label="Weekly capacity">{employee.weeklyCapacityHours} hours</Field>
                  <Field label="Joined">{fmtDate(employee.dateOfJoining)}</Field>
                  <Field label="Probation ends">{fmtDate(employee.probationEnd)}</Field>
                  {employee.dateOfExit && (
                    <Field label="Exited">{fmtDate(employee.dateOfExit)}</Field>
                  )}
                </FieldGrid>

                {/* Personal details appear only with the PII clearance, or for yourself. */}
                {(employee.personalEmail !== undefined || employee.dateOfBirth !== undefined) && (
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="mb-3 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-subtle">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Personal details
                    </p>
                    <FieldGrid>
                      <Field label="Date of birth">{fmtDate(employee.dateOfBirth)}</Field>
                      <Field label="Personal email">{employee.personalEmail}</Field>
                      <Field label="Personal phone">{employee.personalPhone}</Field>
                      <Field label="Emergency contact">
                        {employee.emergencyContact
                          ? `${employee.emergencyContact}${employee.emergencyPhone ? ` (${employee.emergencyPhone})` : ''}`
                          : null}
                      </Field>
                      <Field label="Blood group">{employee.bloodGroup}</Field>
                      <Field label="Address">
                        {[employee.addressLine, employee.city, employee.state, employee.pincode]
                          .filter(Boolean)
                          .join(', ') || null}
                      </Field>
                    </FieldGrid>
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Contact" />
                <div className="space-y-2 px-5 py-4 text-sm">
                  <a
                    href={`mailto:${employee.user.email}`}
                    className="flex items-center gap-2 text-muted hover:text-primary"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {employee.user.email}
                  </a>
                  {employee.user.phone && (
                    <a
                      href={`tel:${employee.user.phone}`}
                      className="flex items-center gap-2 text-muted hover:text-primary"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {employee.user.phone}
                    </a>
                  )}
                  {employee.user.lastLoginAt && (
                    <p className="pt-1 text-2xs text-subtle">
                      Last signed in {fmtDate(employee.user.lastLoginAt, 'dd MMM yyyy, h:mm a')}
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Skills"
                  action={
                    can('employees.update') ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAddingSkills(true)}
                      >
                        Edit
                      </Button>
                    ) : undefined
                  }
                />
                <div className="px-5 py-4">
                  {employee.skills.length === 0 ? (
                    <p className="text-sm text-muted">No skills recorded.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {employee.skills.map((entry) => (
                        <Badge
                          key={entry.skill.id}
                          tone={
                            entry.level === 'EXPERT'
                              ? 'success'
                              : entry.level === 'ADVANCED'
                                ? 'primary'
                                : 'neutral'
                          }
                        >
                          {entry.skill.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {employee.reports.length > 0 && (
                <Card>
                  <CardHeader title={`Direct reports (${employee.reports.length})`} />
                  <ul className="divide-y divide-border">
                    {employee.reports.map((report) => (
                      <li key={report.id}>
                        <Link
                          to={`/employees/${report.id}`}
                          className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2"
                        >
                          <Avatar name={report.user.name} size="xs" />
                          <span className="min-w-0 flex-1 truncate text-sm text-fg">
                            {report.user.name}
                          </span>
                          <span className="shrink-0 text-2xs text-muted">
                            {report.designation?.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </TabPanel>

        <TabPanel value="projects">
          <Card>
            <CardHeader title="Project assignments" />
            {employee.projectMemberships.length === 0 ? (
              <EmptyState
                compact
                icon={<Briefcase className="h-5 w-5" />}
                title="Not on any project"
              />
            ) : (
              <ul className="divide-y divide-border">
                {employee.projectMemberships.map((membership) => (
                  <li key={membership.id}>
                    <Link
                      to={`/projects/${membership.project.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {membership.project.name}
                        </p>
                        <p className="truncate text-2xs text-muted">
                          {membership.project.client?.name ?? 'Internal'} ·{' '}
                          {membership.project.code}
                        </p>
                      </div>
                      <span className="flex flex-wrap items-center justify-end gap-1">
                        {membership.isLead && <Badge tone="primary">Lead</Badge>}
                        {membership.roles?.map((entry) => (
                          <ColourBadge key={entry.role.id} color={entry.role.color}>
                            {entry.role.name}
                          </ColourBadge>
                        ))}
                      </span>
                      {membership.allocationHours && (
                        <span className="shrink-0 text-xs text-muted">
                          {membership.allocationHours}h/wk
                        </span>
                      )}
                      <ProjectStatusBadge value={membership.project.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="onboarding">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Onboarding"
                description={
                  onboarding.length
                    ? `${onboardingDone} of ${onboarding.length} complete`
                    : 'No checklist applied'
                }
              />
              {onboarding.length > 0 && (
                <div className="px-5 pt-3">
                  <ProgressBar
                    value={(onboardingDone / onboarding.length) * 100}
                    tone="success"
                    showLabel
                  />
                </div>
              )}
              <ul className="divide-y divide-border">
                {onboarding.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Checkbox
                      checked={Boolean(item.completedAt)}
                      disabled={!can('employees.checklist.manage')}
                      onChange={(event) =>
                        toggleChecklist.mutate({
                          itemId: item.id,
                          completed: event.target.checked,
                        })
                      }
                      label={
                        <span className={cn(item.completedAt && 'text-muted line-through')}>
                          {item.label}
                        </span>
                      }
                      className="flex-1"
                    />
                    {item.dueDate && !item.completedAt && (
                      <span className="shrink-0 text-2xs text-muted">
                        by {fmtDate(item.dueDate, 'dd MMM')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            {offboardingItems.length > 0 && (
              <Card>
                <CardHeader title="Offboarding" />
                <ul className="divide-y divide-border">
                  {offboardingItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Checkbox
                        checked={Boolean(item.completedAt)}
                        disabled={!can('employees.checklist.manage')}
                        onChange={(event) =>
                          toggleChecklist.mutate({
                            itemId: item.id,
                            completed: event.target.checked,
                          })
                        }
                        label={
                          <span className={cn(item.completedAt && 'text-muted line-through')}>
                            {item.label}
                          </span>
                        }
                        className="flex-1"
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </TabPanel>

        <TabPanel value="assets">
          <Card>
            <CardHeader
              title="Issued equipment"
              description="Laptops, cameras, lenses and licences"
              action={
                can('assets.assign') ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setAssigningAsset(true)}
                  >
                    Issue asset
                  </Button>
                ) : undefined
              }
            />
            {employee.assetAssignments.length === 0 ? (
              <EmptyState compact icon={<Laptop className="h-5 w-5" />} title="Nothing issued" />
            ) : (
              <ul className="divide-y divide-border">
                {employee.assetAssignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      {assignment.asset.category === 'CAMERA' ||
                      assignment.asset.category === 'LENS' ? (
                        <Camera className="h-4 w-4" />
                      ) : (
                        <Laptop className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">
                        {assignment.asset.name}
                      </p>
                      <p className="truncate text-2xs text-muted">
                        {assignment.asset.assetTag} · {humanise(assignment.asset.category)}
                      </p>
                    </div>
                    <span className="shrink-0 text-2xs text-muted">
                      since {fmtDate(assignment.assignedAt, 'dd MMM yy')}
                    </span>
                    {can('assets.assign') && (
                      <ReturnAssetButton assignmentId={assignment.id} employeeId={employee.id} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        {employee.documents && (
          <TabPanel value="documents">
            <Card>
              <CardHeader title="Documents" description="Contracts, IDs and letters" />
              {employee.documents.length === 0 ? (
                <EmptyState compact icon={<FileText className="h-5 w-5" />} title="No documents" />
              ) : (
                <ul className="divide-y divide-border">
                  {employee.documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-3 px-5 py-3">
                      <FileText className="h-4 w-4 shrink-0 text-muted" />
                      <a
                        href={document.file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate text-sm font-medium text-fg hover:underline">
                          {document.title}
                        </span>
                        <span className="block text-2xs text-muted">
                          {humanise(document.type)} · added {fmtDate(document.createdAt)}
                        </span>
                      </a>
                      {document.expiresAt && (
                        <Badge
                          tone={
                            new Date(document.expiresAt) <
                            new Date(Date.now() + 30 * 86_400_000)
                              ? 'danger'
                              : 'neutral'
                          }
                        >
                          Expires {fmtDate(document.expiresAt, 'dd MMM yy')}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabPanel>
        )}

        <TabPanel value="goals">
          <Card>
            <CardHeader title="Goals" />
            {employee.goals.length === 0 ? (
              <EmptyState compact icon={<Target className="h-5 w-5" />} title="No goals set" />
            ) : (
              <ul className="divide-y divide-border">
                {employee.goals.map((goal) => (
                  <li key={goal.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">{goal.title}</p>
                        {goal.metric && (
                          <p className="mt-0.5 text-xs text-muted">
                            {goal.metric}
                            {goal.target ? ` — target ${goal.target}` : ''}
                            {goal.current ? ` · now ${goal.current}` : ''}
                          </p>
                        )}
                      </div>
                      <GoalStatusBadge value={goal.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        {employee.compensation && (
          <TabPanel value="pay">
            <Card>
              <CardHeader
                title="Compensation history"
                description="Visible only with the compensation permission"
                action={
                  can('employees.compensation.manage') ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => setAddingCompensation(true)}
                    >
                      Record change
                    </Button>
                  ) : undefined
                }
              />
              {employee.compensation.length === 0 ? (
                <EmptyState compact icon={<Wallet className="h-5 w-5" />} title="Nothing recorded" />
              ) : (
                <ul className="divide-y divide-border">
                  {employee.compensation.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold tabular-nums text-fg">
                          {fmtCurrency(entry.ctcAnnual, entry.currency)}
                          <span className="ml-1 text-xs font-normal text-muted">per year</span>
                        </p>
                        {entry.note && <p className="text-xs text-muted">{entry.note}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        from {fmtDate(entry.effectiveFrom)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabPanel>
        )}
      </Tabs>

      {editing && <EditEmployeeModal employee={employee} onClose={() => setEditing(false)} />}
      {offboarding && (
        <OffboardModal employee={employee} onClose={() => setOffboarding(false)} />
      )}
      {addingSkills && (
        <EditSkillsModal employee={employee} onClose={() => setAddingSkills(false)} />
      )}
      {addingCompensation && (
        <AddCompensationModal
          employeeId={employee.id}
          onClose={() => setAddingCompensation(false)}
        />
      )}
      {assigningAsset && (
        <AssignAssetModal employeeId={employee.id} onClose={() => setAssigningAsset(false)} />
      )}
    </div>
  );
}


/**
 * Edits the employee's own record. Role changes need user administration, and
 * the personal details only appear for someone cleared to see them - which is
 * also the only case where the API would accept them.
 */
function EditEmployeeModal({
  employee,
  onClose,
}: {
  employee: EmployeeDetail;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canSeePii = employee.personalEmail !== undefined || employee.dateOfBirth !== undefined;
  const canSetRole = can('settings.users.manage');

  const [form, setForm] = useState({
    name: employee.user.name,
    phone: employee.user.phone ?? '',
    roleId: employee.user.role?.id ?? '',
    departmentId: employee.department?.id ?? '',
    designationId: employee.designation?.id ?? '',
    reportingToId: employee.reportingTo?.id ?? '',
    employmentType: employee.employmentType as string,
    status: employee.status as string,
    weeklyCapacityHours: String(employee.weeklyCapacityHours ?? '40'),
    probationEnd: employee.probationEnd ? employee.probationEnd.slice(0, 10) : '',
    notes: employee.notes ?? '',
    dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.slice(0, 10) : '',
    personalEmail: employee.personalEmail ?? '',
    personalPhone: employee.personalPhone ?? '',
    emergencyContact: employee.emergencyContact ?? '',
    emergencyPhone: employee.emergencyPhone ?? '',
    bloodGroup: employee.bloodGroup ?? '',
    addressLine: employee.addressLine ?? '',
    city: employee.city ?? '',
    state: employee.state ?? '',
    pincode: employee.pincode ?? '',
  });

  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiGet<{ id: string; name: string }[]>('/roles'),
    enabled: canSetRole,
  });
  const departments = useQuery({
    queryKey: ['options', 'departments'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/departments?pageSize=100'),
  });
  const designations = useQuery({
    queryKey: ['options', 'designations'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/designations?pageSize=100'),
  });
  const colleagues = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeDetail[]>('/employees/options/all'),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name,
        phone: form.phone || null,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        reportingToId: form.reportingToId || null,
        employmentType: form.employmentType,
        status: form.status,
        weeklyCapacityHours: Number(form.weeklyCapacityHours),
        probationEnd: form.probationEnd || null,
        notes: form.notes || null,
      };
      // Only send what this person is allowed to change; the API would refuse
      // the rest anyway, and sending it would turn a no-op into an error.
      if (canSetRole) payload.roleId = form.roleId || null;
      if (canSeePii) {
        Object.assign(payload, {
          dateOfBirth: form.dateOfBirth || null,
          personalEmail: form.personalEmail || null,
          personalPhone: form.personalPhone || null,
          emergencyContact: form.emergencyContact || null,
          emergencyPhone: form.emergencyPhone || null,
          bloodGroup: form.bloodGroup || null,
          addressLine: form.addressLine || null,
          city: form.city || null,
          state: form.state || null,
          pincode: form.pincode || null,
        });
      }
      return apiPatch(`/employees/${employee.id}`, payload);
    },
    onSuccess: () => {
      toast.success('Employee updated');
      void queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${employee.user.name}`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={form.name.trim().length < 2}
            onClick={() => save.mutate()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <Input
              label="Work email"
              value={employee.user.email}
              disabled
              hint="Changing a sign-in address is done from Settings, Users."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            {canSetRole ? (
              <Select
                label="CRM role"
                value={form.roleId}
                onChange={(event) => setForm({ ...form, roleId: event.target.value })}
                placeholder="No role (no access)"
                hint="Decides what they can see and do."
                options={(roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))}
              />
            ) : (
              <Input
                label="CRM role"
                value={employee.user.role?.name ?? 'No role'}
                disabled
                hint="Needs user administration rights to change."
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Department"
              value={form.departmentId}
              onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
              placeholder="None"
              options={(departments.data ?? []).map((item) => ({
                value: item.id,
                label: String(item.name),
              }))}
            />
            <Select
              label="Designation"
              value={form.designationId}
              onChange={(event) => setForm({ ...form, designationId: event.target.value })}
              placeholder="None"
              options={(designations.data ?? []).map((item) => ({
                value: item.id,
                label: String(item.title),
              }))}
            />
            <Select
              label="Reports to"
              value={form.reportingToId}
              onChange={(event) => setForm({ ...form, reportingToId: event.target.value })}
              placeholder="Nobody"
              options={(colleagues.data ?? [])
                .filter((entry) => entry.id !== employee.id)
                .map((entry) => ({ value: entry.id, label: entry.user.name }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Select
              label="Employment"
              value={form.employmentType}
              onChange={(event) => setForm({ ...form, employmentType: event.target.value })}
              options={['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'FREELANCE'].map(
                (value) => ({ value, label: humanise(value) }),
              )}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              options={['ONBOARDING', 'ACTIVE', 'ON_NOTICE'].map((value) => ({
                value,
                label: humanise(value),
              }))}
              hint={employee.status === 'EXITED' ? 'Already exited' : undefined}
            />
            <Input
              label="Capacity (h/wk)"
              type="number"
              min={0}
              max={80}
              value={form.weeklyCapacityHours}
              onChange={(event) =>
                setForm({ ...form, weeklyCapacityHours: event.target.value })
              }
            />
            <Input
              label="Probation ends"
              type="date"
              value={form.probationEnd}
              onChange={(event) => setForm({ ...form, probationEnd: event.target.value })}
            />
          </div>

          <Textarea
            label="Notes"
            rows={2}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </section>

        {canSeePii && (
          <section className="space-y-4 rounded-xl border border-border bg-surface-2/40 p-4">
            <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-subtle">
              <ShieldAlert className="h-3.5 w-3.5" />
              Personal details &mdash; visible only with the right clearance
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Date of birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
              />
              <Input
                label="Personal email"
                type="email"
                value={form.personalEmail}
                onChange={(event) => setForm({ ...form, personalEmail: event.target.value })}
              />
              <Input
                label="Personal phone"
                value={form.personalPhone}
                onChange={(event) => setForm({ ...form, personalPhone: event.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Emergency contact"
                value={form.emergencyContact}
                onChange={(event) => setForm({ ...form, emergencyContact: event.target.value })}
              />
              <Input
                label="Emergency phone"
                value={form.emergencyPhone}
                onChange={(event) => setForm({ ...form, emergencyPhone: event.target.value })}
              />
              <Input
                label="Blood group"
                value={form.bloodGroup}
                onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })}
              />
            </div>

            <Input
              label="Address"
              value={form.addressLine}
              onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="City"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
              <Input
                label="State"
                value={form.state}
                onChange={(event) => setForm({ ...form, state: event.target.value })}
              />
              <Input
                label="Pincode"
                value={form.pincode}
                onChange={(event) => setForm({ ...form, pincode: event.target.value })}
              />
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function ReturnAssetButton({
  assignmentId,
  employeeId,
}: {
  assignmentId: string;
  employeeId: string;
}) {
  const queryClient = useQueryClient();
  const returnAsset = useMutation({
    mutationFn: () =>
      apiPost(`/employees/assets/${assignmentId}/return`, { assetStatus: 'AVAILABLE' }),
    onSuccess: () => {
      toast.success('Asset returned');
      void queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      loading={returnAsset.isPending}
      onClick={() => returnAsset.mutate()}
    >
      Return
    </Button>
  );
}

function OffboardModal({
  employee,
  onClose,
}: {
  employee: EmployeeDetail;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    dateOfExit: new Date().toISOString().slice(0, 10),
    reassignTasksTo: '',
    applyOffboardingChecklist: true,
  });

  const colleagues = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeDetail[]>('/employees/options/all'),
  });

  const offboard = useMutation({
    mutationFn: () =>
      apiPost(`/employees/${employee.id}/offboard`, {
        dateOfExit: form.dateOfExit,
        reassignTasksTo: form.reassignTasksTo || null,
        applyOffboardingChecklist: form.applyOffboardingChecklist,
      }),
    onSuccess: () => {
      toast.success('Employee offboarded');
      void queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Offboard ${employee.user.name}`}
      description="Their CRM access ends immediately and open tasks must go somewhere."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={offboard.isPending} onClick={() => offboard.mutate()}>
            Offboard
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Exit date"
          type="date"
          value={form.dateOfExit}
          onChange={(event) => setForm({ ...form, dateOfExit: event.target.value })}
        />
        <Select
          label="Reassign open tasks to"
          value={form.reassignTasksTo}
          onChange={(event) => setForm({ ...form, reassignTasksTo: event.target.value })}
          placeholder="Nobody (only works if they have none)"
          hint={`${employee._count.tasksAssigned} task(s) are currently assigned.`}
          options={(colleagues.data ?? [])
            .filter((entry) => entry.id !== employee.id)
            .map((entry) => ({ value: entry.id, label: entry.user.name }))}
        />
        <Checkbox
          checked={form.applyOffboardingChecklist}
          onChange={(event) =>
            setForm({ ...form, applyOffboardingChecklist: event.target.checked })
          }
          label="Start the offboarding checklist"
          description="Asset return, access revocation, final settlement."
        />
      </div>
    </Modal>
  );
}

function EditSkillsModal({
  employee,
  onClose,
}: {
  employee: EmployeeDetail;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(
    employee.skills.map((entry) => ({ skillId: entry.skill.id, level: entry.level })),
  );

  const skills = useQuery({
    queryKey: ['options', 'skills'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/skills'),
  });

  const save = useMutation({
    mutationFn: () => apiPut(`/employees/${employee.id}/skills`, { skills: selected }),
    onSuccess: () => {
      toast.success('Skills updated');
      void queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Skills"
      description="Used when deciding who to put on what."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save skills
          </Button>
        </>
      }
    >
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {(skills.data ?? []).map((skill) => {
          const entry = selected.find((item) => item.skillId === skill.id);
          return (
            <div
              key={skill.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-2.5',
                entry ? 'border-primary/40 bg-primary-soft/40' : 'border-border',
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border-strong accent-primary"
                checked={Boolean(entry)}
                onChange={() =>
                  setSelected((current) =>
                    entry
                      ? current.filter((item) => item.skillId !== skill.id)
                      : [...current, { skillId: skill.id, level: 'INTERMEDIATE' }],
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{String(skill.name)}</span>
                {skill.category ? (
                  <span className="block text-2xs text-muted">{String(skill.category)}</span>
                ) : null}
              </span>
              {entry && (
                <Select
                  value={entry.level}
                  onChange={(event) =>
                    setSelected((current) =>
                      current.map((item) =>
                        item.skillId === skill.id
                          ? { ...item, level: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="w-36"
                  options={['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'].map((value) => ({
                    value,
                    label: humanise(value),
                  }))}
                />
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function AddCompensationModal({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    effectiveFrom: new Date().toISOString().slice(0, 10),
    ctcAnnual: '',
    note: '',
  });

  const save = useMutation({
    mutationFn: () =>
      apiPost(`/employees/${employeeId}/compensation`, {
        effectiveFrom: form.effectiveFrom,
        ctcAnnual: Number(form.ctcAnnual),
        note: form.note || undefined,
      }),
    onSuccess: () => {
      toast.success('Compensation recorded');
      void queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Record a compensation change"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!form.ctcAnnual}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Effective from"
          type="date"
          value={form.effectiveFrom}
          onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
        />
        <Input
          label="Annual CTC"
          type="number"
          min={0}
          required
          value={form.ctcAnnual}
          onChange={(event) => setForm({ ...form, ctcAnnual: event.target.value })}
          prefix="₹"
        />
        <Input
          label="Note"
          value={form.note}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
          placeholder="e.g. Annual revision"
        />
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          The audit log records that a change was made, but never the amount.
        </p>
      </div>
    </Modal>
  );
}

function AssignAssetModal({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [assetId, setAssetId] = useState('');
  const [conditionOut, setConditionOut] = useState('');

  const assets = useQuery({
    queryKey: ['assets', 'available'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/assets', { pageSize: 200 }),
  });

  const assign = useMutation({
    mutationFn: () =>
      apiPost(`/employees/${employeeId}/assets`, {
        assetId,
        conditionOut: conditionOut || undefined,
      }),
    onSuccess: () => {
      toast.success('Asset issued');
      void queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const available = (assets.data ?? []).filter((asset) => asset.status === 'AVAILABLE');

  return (
    <Modal
      open
      onClose={onClose}
      title="Issue an asset"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={assign.isPending} disabled={!assetId} onClick={() => assign.mutate()}>
            Issue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Asset"
          required
          value={assetId}
          onChange={(event) => setAssetId(event.target.value)}
          placeholder={available.length ? 'Select an available asset' : 'Nothing available'}
          options={available.map((asset) => ({
            value: asset.id,
            label: `${String(asset.assetTag)} · ${String(asset.name)}`,
          }))}
        />
        <Input
          label="Condition on issue"
          value={conditionOut}
          onChange={(event) => setConditionOut(event.target.value)}
          placeholder="e.g. Good, minor scratch on lid"
        />
      </div>
    </Modal>
  );
}
