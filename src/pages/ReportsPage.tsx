import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload, apiGet, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import {
  downloadBlob,
  fmtCompactCurrency,
  fmtDate,
  fmtHours,
  humanise,
  toISODate,
} from '@/lib/utils';
import type {
  DeliveryReport,
  LeadConversionReport,
  RetainerHealthReport,
  StageCycleReport,
  TimeByClientReport,
  UtilizationReport,
} from '@/types/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  StatTile,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  Table,
} from '@/components/ui';

/** Chart palette: readable on both themes, distinct at a glance. */
const SERIES = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#a855f7'];

type ReportKey =
  | 'delivery'
  | 'utilization'
  | 'stages'
  | 'time'
  | 'leads'
  | 'retainers';

export function ReportsPage() {
  const { can } = useAuth();
  const [report, setReport] = useState<ReportKey>('delivery');
  const [from, setFrom] = useState(toISODate(startOfMonth(subMonths(new Date(), 2))));
  const [to, setTo] = useState(toISODate(endOfMonth(new Date())));

  const range = { from, to };

  const presets = [
    {
      label: 'This month',
      from: toISODate(startOfMonth(new Date())),
      to: toISODate(new Date()),
    },
    {
      label: 'Last 3 months',
      from: toISODate(startOfMonth(subMonths(new Date(), 2))),
      to: toISODate(endOfMonth(new Date())),
    },
    {
      label: 'Last 12 months',
      from: toISODate(startOfMonth(subMonths(new Date(), 11))),
      to: toISODate(endOfMonth(new Date())),
    },
  ];

  const exportCsv = async (name: 'utilization' | 'time-entries' | 'projects') => {
    try {
      const blob = await apiDownload(`/reports/export/${name}`, range);
      downloadBlob(blob, `${name}-${from}-to-${to}.csv`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Delivery, utilisation and commercial health."
        actions={
          can('reports.export') ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={() => void exportCsv('projects')}
              >
                Projects CSV
              </Button>
              <Button
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={() => void exportCsv('time-entries')}
              >
                Time CSV
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <SegmentedControl
          value={report}
          onChange={(value) => setReport(value as ReportKey)}
          options={[
            { value: 'delivery', label: 'Delivery' },
            { value: 'utilization', label: 'Utilisation' },
            { value: 'stages', label: 'Cycle time' },
            { value: 'time', label: 'Time by client' },
            { value: 'leads', label: 'Leads' },
            { value: 'retainers', label: 'Retainers' },
          ]}
        />

        <div className="flex flex-wrap items-end gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant={from === preset.from && to === preset.to ? 'subtle' : 'secondary'}
              onClick={() => {
                setFrom(preset.from);
                setTo(preset.to);
              }}
            >
              {preset.label}
            </Button>
          ))}
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-36"
          />
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-36"
          />
        </div>
      </div>

      {report === 'delivery' && <DeliveryReportView range={range} />}
      {report === 'utilization' && (
        <UtilizationReportView range={range} onExport={() => void exportCsv('utilization')} />
      )}
      {report === 'stages' && <StageCycleView range={range} />}
      {report === 'time' && <TimeByClientView range={range} />}
      {report === 'leads' && <LeadReportView range={range} />}
      {report === 'retainers' && <RetainerReportView />}
    </div>
  );
}

/** Shared chart theming so both modes stay legible. */
function useChartTheme() {
  const resolved = useTheme((state) => state.resolved);
  const dark = resolved === 'dark';
  return {
    grid: dark ? '#262c3c' : '#e5e9f0',
    axis: dark ? '#94a0b4' : '#64748b',
    tooltip: {
      backgroundColor: dark ? '#11141e' : '#ffffff',
      border: `1px solid ${dark ? '#262c3c' : '#e5e9f0'}`,
      borderRadius: 12,
      fontSize: 12,
      color: dark ? '#edf1f8' : '#0f172a',
    } as React.CSSProperties,
  };
}

function DeliveryReportView({ range }: { range: { from: string; to: string } }) {
  const theme = useChartTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'delivery', range],
    queryFn: () => apiGet<DeliveryReport>('/reports/project-delivery', range),
  });

  if (isLoading) return <LoadingBlock />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Projects delivered" value={data.completedCount} tone="primary" />
        <StatTile
          label="On time"
          value={data.onTimePercent === null ? '—' : `${data.onTimePercent}%`}
          tone={
            (data.onTimePercent ?? 0) >= 80
              ? 'success'
              : (data.onTimePercent ?? 0) >= 50
                ? 'warning'
                : 'danger'
          }
          sub={`${data.onTimeCount} of ${data.completedCount}`}
        />
        <StatTile
          label="Open and overdue"
          value={data.overdueOpenCount}
          tone={data.overdueOpenCount ? 'danger' : 'success'}
        />
        <StatTile
          label="Average delay"
          value={data.averageDaysLate === null ? '—' : `${data.averageDaysLate}d`}
          tone="neutral"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Projects by status" />
          <div className="h-64 px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byStatus.map((row) => ({ ...row, label: humanise(row.status) }))}>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.axis }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} />
                <Tooltip contentStyle={theme.tooltip} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={SERIES[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="New work by service line" />
          <div className="h-64 px-3 py-4">
            {data.byServiceLine.length === 0 ? (
              <EmptyState compact title="No new projects in this range" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byServiceLine}
                    dataKey="count"
                    nameKey="serviceLine"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.byServiceLine.map((_entry, index) => (
                      <Cell key={index} fill={SERIES[index % SERIES.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={theme.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {data.lateProjects.length > 0 && (
        <Card>
          <CardHeader
            title="Delivered late"
            description="Worth a look when planning the next estimate"
          />
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Client</TH>
                <TH className="text-right">Days late</TH>
              </tr>
            </THead>
            <TBody>
              {data.lateProjects.map((project) => (
                <TRow key={project.id}>
                  <TD>
                    <span className="font-medium text-fg">{project.name}</span>
                    <span className="ml-2 font-mono text-2xs text-subtle">{project.code}</span>
                  </TD>
                  <TD className="text-muted">{project.client.name}</TD>
                  <TD className="text-right font-semibold tabular-nums text-danger">
                    {project.daysLate}
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function UtilizationReportView({
  range,
  onExport,
}: {
  range: { from: string; to: string };
  onExport: () => void;
}) {
  const { can } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'utilization', range],
    queryFn: () => apiGet<UtilizationReport>('/reports/utilization', range),
  });

  if (isLoading) return <LoadingBlock />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Headcount" value={data.summary.headcount} />
        <StatTile label="Hours logged" value={fmtHours(data.summary.totalLoggedHours)} />
        <StatTile
          label="Utilisation"
          value={
            data.summary.utilizationPercent === null
              ? '—'
              : `${data.summary.utilizationPercent}%`
          }
          tone={
            (data.summary.utilizationPercent ?? 0) >= 70
              ? 'success'
              : (data.summary.utilizationPercent ?? 0) >= 50
                ? 'warning'
                : 'danger'
          }
          sub={`of ${fmtHours(data.summary.totalCapacityHours)} capacity`}
        />
        <StatTile
          label="Billable share"
          value={
            data.summary.billablePercent === null ? '—' : `${data.summary.billablePercent}%`
          }
          tone="primary"
          sub={fmtHours(data.summary.totalBillableHours)}
        />
      </div>

      <Card>
        <CardHeader
          title="Per person"
          description={`${fmtDate(data.range.from)} — ${fmtDate(data.range.to)}`}
          action={
            can('reports.export') ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={onExport}
              >
                CSV
              </Button>
            ) : undefined
          }
        />
        <Table>
          <THead>
            <tr>
              <TH>Employee</TH>
              <TH>Department</TH>
              <TH className="text-right">Capacity</TH>
              <TH className="text-right">Logged</TH>
              <TH className="text-right">Billable</TH>
              <TH>Utilisation</TH>
            </tr>
          </THead>
          <TBody>
            {data.rows.map((row) => (
              <TRow key={row.employee.id}>
                <TD>
                  <span className="font-medium text-fg">{row.employee.name}</span>
                  <span className="ml-2 text-2xs text-subtle">{row.employee.code}</span>
                </TD>
                <TD className="text-xs text-muted">{row.employee.department ?? '—'}</TD>
                <TD className="text-right tabular-nums text-muted">
                  {fmtHours(row.capacityHours)}
                </TD>
                <TD className="text-right tabular-nums text-fg">{fmtHours(row.loggedHours)}</TD>
                <TD className="text-right tabular-nums text-success">
                  {fmtHours(row.billableHours)}
                </TD>
                <TD className="min-w-[9rem]">
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
              </TRow>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function StageCycleView({ range }: { range: { from: string; to: string } }) {
  const theme = useChartTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'stages', range],
    queryFn: () => apiGet<StageCycleReport>('/reports/stage-cycle-time', range),
  });

  if (isLoading) return <LoadingBlock />;
  if (!data?.stages.length) {
    return (
      <Card>
        <EmptyState
          icon={<Gauge className="h-5 w-5" />}
          title="Not enough history yet"
          description="Cycle time needs projects that have moved through and out of a stage."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Average days per stage"
          description="Where work actually waits"
        />
        <div className="h-80 px-3 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stages} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke={theme.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: theme.axis }} />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fontSize: 11, fill: theme.axis }}
              />
              <Tooltip contentStyle={theme.tooltip} />
              <Bar dataKey="averageDays" radius={[0, 6, 6, 0]} name="Average days">
                {data.stages.map((stage) => (
                  <Cell key={stage.stageId} fill={stage.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Stage</TH>
              <TH className="text-right">Samples</TH>
              <TH className="text-right">Average</TH>
              <TH className="text-right">Median</TH>
              <TH className="text-right">Longest</TH>
            </tr>
          </THead>
          <TBody>
            {data.stages.map((stage) => (
              <TRow key={stage.stageId}>
                <TD>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-medium text-fg">{stage.name}</span>
                  </span>
                </TD>
                <TD className="text-right tabular-nums text-muted">{stage.samples}</TD>
                <TD className="text-right font-semibold tabular-nums text-fg">
                  {stage.averageDays}d
                </TD>
                <TD className="text-right tabular-nums text-muted">{stage.medianDays}d</TD>
                <TD className="text-right tabular-nums text-muted">{stage.maxDays}d</TD>
              </TRow>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function TimeByClientView({ range }: { range: { from: string; to: string } }) {
  const theme = useChartTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'time-by-client', range],
    queryFn: () => apiGet<TimeByClientReport>('/reports/time-by-client', range),
  });

  if (isLoading) return <LoadingBlock />;
  if (!data?.rows.length) {
    return (
      <Card>
        <EmptyState title="No time logged in this range" />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Hours by client" description="Where the team's time actually went" />
        <div className="h-80 px-3 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.rows.slice(0, 12)}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis
                dataKey="clientName"
                tick={{ fontSize: 10, fill: theme.axis }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: theme.axis }} />
              <Tooltip contentStyle={theme.tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="billableHours" stackId="a" name="Billable" fill={SERIES[2]} />
              <Bar
                dataKey="hours"
                stackId="b"
                name="Total"
                fill={SERIES[0]}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Client</TH>
              <TH>Projects</TH>
              <TH className="text-right">Billable</TH>
              <TH className="text-right">Total hours</TH>
            </tr>
          </THead>
          <TBody>
            {data.rows.map((row) => (
              <TRow key={row.clientId}>
                <TD className="font-medium text-fg">{row.clientName}</TD>
                <TD className="text-xs text-muted">
                  {row.projects
                    .slice(0, 3)
                    .map((project) => `${project.name} (${project.hours}h)`)
                    .join(', ')}
                  {row.projects.length > 3 ? ` +${row.projects.length - 3}` : ''}
                </TD>
                <TD className="text-right tabular-nums text-success">
                  {fmtHours(row.billableHours)}
                </TD>
                <TD className="text-right font-semibold tabular-nums text-fg">
                  {fmtHours(row.hours)}
                </TD>
              </TRow>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function LeadReportView({ range }: { range: { from: string; to: string } }) {
  const theme = useChartTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'leads', range],
    queryFn: () => apiGet<LeadConversionReport>('/reports/lead-conversion', range),
  });

  if (isLoading) return <LoadingBlock />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Leads created" value={data.summary.total} />
        <StatTile
          label="Won"
          value={data.summary.won}
          tone="success"
          sub={fmtCompactCurrency(data.summary.wonValue)}
        />
        <StatTile
          label="Conversion"
          value={
            data.summary.conversionPercent === null
              ? '—'
              : `${data.summary.conversionPercent}%`
          }
          tone={(data.summary.conversionPercent ?? 0) >= 30 ? 'success' : 'warning'}
          sub={`${data.summary.lost} lost`}
        />
        <StatTile
          label="Average days to win"
          value={data.summary.averageDaysToWin === null ? '—' : data.summary.averageDaysToWin}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pipeline by stage" />
          <div className="h-72 px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.byStatus.map((row) => ({
                  ...row,
                  label: humanise(row.status),
                  value: Number(row.value ?? 0),
                }))}
              >
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: theme.axis }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} />
                <Tooltip contentStyle={theme.tooltip} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={SERIES[1]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Where leads come from" />
          <div className="h-72 px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.bySource.map((row) => ({
                    name: humanise(row.source),
                    count: row.count,
                  }))}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {data.bySource.map((_entry, index) => (
                    <Cell key={index} fill={SERIES[index % SERIES.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={theme.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RetainerReportView() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'retainers'],
    queryFn: () => apiGet<RetainerHealthReport>('/reports/retainer-health'),
  });

  if (isLoading) return <LoadingBlock />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active retainers" value={data.activeRetainers} tone="primary" />
        <StatTile
          label="Renewals in 60 days"
          value={data.renewalsDue.length}
          tone={data.renewalsDue.length ? 'warning' : 'success'}
        />
        {data.revenueByCycle?.map((row) => (
          <StatTile
            key={row.billingCycle}
            label={`${humanise(row.billingCycle)} value`}
            value={fmtCompactCurrency(row.totalPerCycle)}
            sub={`${row.count} retainer${row.count === 1 ? '' : 's'}`}
            tone="success"
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Coming up for renewal" description="Next 60 days" />
          {data.renewalsDue.length === 0 ? (
            <EmptyState compact title="Nothing due" />
          ) : (
            <ul className="divide-y divide-border">
              {data.renewalsDue.map((retainer) => (
                <li
                  key={retainer.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{retainer.name}</p>
                    <p className="truncate text-2xs text-muted">{retainer.client.name}</p>
                  </div>
                  {retainer.amountPerCycle && (
                    <Badge tone="success">{fmtCompactCurrency(retainer.amountPerCycle)}</Badge>
                  )}
                  <span className="shrink-0 text-xs font-medium text-warning">
                    ends {fmtDate(retainer.endDate, 'dd MMM')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Cycles by status" />
          <ul className="divide-y divide-border">
            {data.cyclesByStatus.map((row) => (
              <li
                key={row.status}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-fg">{humanise(row.status)}</span>
                <span className="font-semibold tabular-nums text-fg">{row.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
