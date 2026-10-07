import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, fmtDate, fmtHours, humanise } from '@/lib/utils';
import type {
  EmployeeListItem,
  MasterRecord,
  Role,
  WorkloadRow,
} from '@/types/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  SkeletonRows,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  Table,
} from '@/components/ui';
import { EmployeeStatusBadge } from '@/components/domain';
import { FilterBar, FilterSelect, TableCard, ViewToggle } from '@/components/ListShell';

const STATUSES = ['ONBOARDING', 'ACTIVE', 'ON_NOTICE', 'EXITED'] as const;
const TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'FREELANCE'] as const;

export function EmployeesPage() {
  const { can } = useAuth();
  const [view, setView] = useState<'list' | 'workload'>('list');
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Employees"
        description="The team, their roles, skills and capacity."
        actions={
          <>
            <ViewToggle
              view={view}
              onChange={(value) => setView(value as 'list' | 'workload')}
              views={[
                { value: 'list', label: 'Directory', icon: <Users className="h-3.5 w-3.5" /> },
                { value: 'workload', label: 'Workload', icon: <Gauge className="h-3.5 w-3.5" /> },
              ]}
            />
            {can('employees.create') && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                Add employee
              </Button>
            )}
          </>
        }
      />

      {view === 'list' ? <DirectoryView /> : <WorkloadView />}
      {creating && <AddEmployeeModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function DirectoryView() {
  const navigate = useNavigate();
  const list = useListState(
    {
      status: 'ACTIVE' as string | undefined,
      departmentId: undefined,
      designationId: undefined,
      skillId: undefined,
    },
    25,
  );

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<EmployeeListItem>(
    ['employees'],
    '/employees',
    list.queryParams,
  );

  const departments = useQuery({
    queryKey: ['options', 'departments'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/departments'),
    staleTime: 300_000,
  });
  const skills = useQuery({
    queryKey: ['options', 'skills'],
    queryFn: () => apiGet<MasterRecord[]>('/masters/skills'),
    staleTime: 300_000,
  });

  return (
    <>
      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        placeholder="Search name, email or code…"
        activeCount={list.activeFilterCount}
        onReset={list.resetFilters}
      >
        <FilterSelect
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value)}
          options={STATUSES}
          allLabel="All statuses"
        />
        <FilterSelect
          value={list.filters.departmentId}
          onChange={(value) => list.setFilter('departmentId', value)}
          options={(departments.data ?? []).map((item) => ({
            value: item.id,
            label: String(item.name),
          }))}
          allLabel="All departments"
        />
        <FilterSelect
          value={list.filters.skillId}
          onChange={(value) => list.setFilter('skillId', value)}
          options={(skills.data ?? []).map((item) => ({
            value: item.id,
            label: String(item.name),
          }))}
          allLabel="Any skill"
        />
      </FilterBar>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <TableCard meta={data?.meta} onPageChange={list.setPage}>
          <Table className={cn(isFetching && 'opacity-60')}>
            <THead>
              <tr>
                <TH>Employee</TH>
                <TH>Department</TH>
                <TH>Role</TH>
                <TH>Reports to</TH>
                <TH>Skills</TH>
                <TH className="text-right">Open tasks</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <SkeletonRows rows={8} cols={7} />
              ) : data?.data.length === 0 ? (
                <tr>
                  <TD colSpan={7}>
                    <EmptyState icon={<Users className="h-5 w-5" />} title="No one matches" />
                  </TD>
                </tr>
              ) : (
                data?.data.map((employee) => (
                  <TRow key={employee.id} onClick={() => navigate(`/employees/${employee.id}`)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={employee.user.name}
                          src={employee.user.avatar?.url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{employee.user.name}</p>
                          <p className="truncate text-2xs text-muted">
                            {employee.employeeCode} · {employee.designation?.title ?? 'No designation'}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-xs text-muted">{employee.department?.name ?? '—'}</TD>
                    <TD>
                      {employee.user.role ? (
                        <Badge tone="neutral">{employee.user.role.name}</Badge>
                      ) : (
                        <span className="text-xs text-subtle">No role</span>
                      )}
                    </TD>
                    <TD className="text-xs text-muted">
                      {employee.reportingTo?.user.name ?? '—'}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {employee.skills.slice(0, 2).map((entry) => (
                          <Badge key={entry.skill.id} tone="neutral">
                            {entry.skill.name}
                          </Badge>
                        ))}
                        {employee.skills.length > 2 && (
                          <Badge tone="neutral">+{employee.skills.length - 2}</Badge>
                        )}
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {employee._count.tasksAssigned}
                    </TD>
                    <TD>
                      <EmployeeStatusBadge value={employee.status} />
                    </TD>
                  </TRow>
                ))
              )}
            </TBody>
          </Table>
        </TableCard>
      )}
    </>
  );
}

/** Capacity against commitment - what makes "who is free?" answerable. */
function WorkloadView() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employees', 'workload'],
    queryFn: () => apiGet<{ weekStart: string; weekEnd: string; rows: WorkloadRow[] }>(
      '/employees/workload',
    ),
  });

  if (isLoading) return <Card className="h-64 animate-pulse" />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  return (
    <Card>
      <CardHeader
        title="This week's workload"
        description={`${fmtDate(data?.weekStart)} — ${fmtDate(data?.weekEnd)} · allocation and logged time against capacity`}
      />
      <Table>
        <THead>
          <tr>
            <TH>Employee</TH>
            <TH className="text-right">Capacity</TH>
            <TH className="text-right">Allocated</TH>
            <TH className="text-right">Logged</TH>
            <TH>Utilisation</TH>
            <TH className="text-right">Open tasks</TH>
            <TH>Projects</TH>
          </tr>
        </THead>
        <TBody>
          {data?.rows.length === 0 ? (
            <tr>
              <TD colSpan={7}>
                <EmptyState title="Nobody to show" />
              </TD>
            </tr>
          ) : (
            data?.rows.map((row) => (
              <TRow
                key={row.employee.id}
                onClick={() => navigate(`/employees/${row.employee.id}`)}
              >
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={row.employee.name}
                      src={row.employee.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{row.employee.name}</p>
                      <p className="truncate text-2xs text-muted">
                        {row.employee.designation ?? row.employee.code}
                      </p>
                    </div>
                  </div>
                </TD>
                <TD className="text-right tabular-nums text-muted">
                  {fmtHours(row.capacityHours)}
                </TD>
                <TD
                  className={cn(
                    'text-right tabular-nums',
                    row.overAllocated ? 'font-semibold text-danger' : 'text-fg',
                  )}
                >
                  {fmtHours(row.allocatedHours)}
                </TD>
                <TD className="text-right tabular-nums text-fg">{fmtHours(row.loggedHours)}</TD>
                <TD className="min-w-[8rem]">
                  <ProgressBar
                    value={row.utilizationPercent ?? 0}
                    showLabel
                    tone={
                      (row.utilizationPercent ?? 0) > 100
                        ? 'danger'
                        : (row.utilizationPercent ?? 0) >= 70
                          ? 'success'
                          : 'warning'
                    }
                  />
                </TD>
                <TD className="text-right tabular-nums">{row.openTasks}</TD>
                <TD className="text-xs text-muted">
                  {row.activeProjects.length === 0 ? (
                    <span className="text-subtle">None</span>
                  ) : (
                    <span className="line-clamp-2">{row.activeProjects.join(', ')}</span>
                  )}
                </TD>
              </TRow>
            ))
          )}
        </TBody>
      </Table>
    </Card>
  );
}

function AddEmployeeModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    roleId: '',
    departmentId: '',
    designationId: '',
    reportingToId: '',
    employmentType: 'FULL_TIME',
    status: 'ONBOARDING',
    weeklyCapacityHours: '45',
    dateOfJoining: new Date().toISOString().slice(0, 10),
    sendInvite: true,
    applyOnboardingChecklist: true,
  });

  const [roles, departments, designations, employees] = [
    useQuery({ queryKey: ['roles'], queryFn: () => apiGet<Role[]>('/roles') }),
    useQuery({
      queryKey: ['options', 'departments'],
      queryFn: () => apiGet<MasterRecord[]>('/masters/departments'),
    }),
    useQuery({
      queryKey: ['options', 'designations'],
      queryFn: () => apiGet<MasterRecord[]>('/masters/designations'),
    }),
    useQuery({
      queryKey: ['options', 'employees'],
      queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
    }),
  ];

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>('/employees', {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        roleId: form.roleId || null,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        reportingToId: form.reportingToId || null,
        employmentType: form.employmentType,
        status: form.status,
        weeklyCapacityHours: Number(form.weeklyCapacityHours),
        dateOfJoining: form.dateOfJoining,
        sendInvite: form.sendInvite,
        applyOnboardingChecklist: form.applyOnboardingChecklist,
      }),
    onSuccess: (employee) => {
      toast.success(
        form.sendInvite ? 'Employee added and invited' : 'Employee added',
      );
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
      navigate(`/employees/${employee.id}`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const ready = form.name.length >= 2 && form.email.includes('@') && form.dateOfJoining;

  return (
    <Modal
      open
      onClose={onClose}
      title="Add employee"
      description="Creates their Vision account at the same time."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={!ready} onClick={() => create.mutate()}>
            Add employee
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="Work email"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="name@digital-dude.com"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Select
            label="Vision role"
            value={form.roleId}
            onChange={(event) => setForm({ ...form, roleId: event.target.value })}
            placeholder="No role (no access)"
            hint="Decides what they can see and do."
            options={(roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Department"
            value={form.departmentId}
            onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
            placeholder="Select"
            options={(departments.data ?? []).map((item) => ({
              value: item.id,
              label: String(item.name),
            }))}
          />
          <Select
            label="Designation"
            value={form.designationId}
            onChange={(event) => setForm({ ...form, designationId: event.target.value })}
            placeholder="Select"
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
            options={(employees.data ?? []).map((employee) => ({
              value: employee.id,
              label: employee.user.name,
            }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Select
            label="Employment"
            value={form.employmentType}
            onChange={(event) => setForm({ ...form, employmentType: event.target.value })}
            options={TYPES.map((value) => ({ value, label: humanise(value) }))}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            options={STATUSES.filter((value) => value !== 'EXITED').map((value) => ({
              value,
              label: humanise(value),
            }))}
          />
          <Input
            label="Capacity (h/wk)"
            type="number"
            min={0}
            max={80}
            value={form.weeklyCapacityHours}
            onChange={(event) => setForm({ ...form, weeklyCapacityHours: event.target.value })}
          />
          <Input
            label="Joining date"
            type="date"
            required
            value={form.dateOfJoining}
            onChange={(event) => setForm({ ...form, dateOfJoining: event.target.value })}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-surface-2/40 p-3">
          <Checkbox
            checked={form.sendInvite}
            onChange={(event) => setForm({ ...form, sendInvite: event.target.checked })}
            label="Email them an invitation"
            description="They set their own password; no shared credentials."
          />
          <Checkbox
            checked={form.applyOnboardingChecklist}
            onChange={(event) =>
              setForm({ ...form, applyOnboardingChecklist: event.target.checked })
            }
            label="Start the onboarding checklist"
            description="Uses the default checklist from Settings."
          />
        </div>
      </div>
    </Modal>
  );
}
