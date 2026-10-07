import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload, apiGet, errorMessage } from '@/lib/api';
import { useListState, usePaginatedQuery } from '@/hooks/useList';
import { cn, downloadBlob, fmtDateTime, fmtRelative, humanise, toISODate } from '@/lib/utils';
import type { ActivityLog } from '@/types/api';
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FieldGrid,
  Input,
  PageHeader,
  SkeletonRows,
  TBody,
  TD,
  TH,
  THead,
  TRow,
  Table,
} from '@/components/ui';
import { FilterBar, FilterSelect, TableCard } from '@/components/ListShell';

const ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'PERMISSION_CHANGE',
  'STATUS_CHANGE',
  'STAGE_CHANGE',
  'APPROVE',
  'REJECT',
  'EXPORT',
  'FILE_UPLOAD',
  'FILE_DELETE',
] as const;

const TONES: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  LOGIN: 'neutral',
  LOGIN_FAILED: 'danger',
  LOGOUT: 'neutral',
  PERMISSION_CHANGE: 'warning',
  STATUS_CHANGE: 'info',
  STAGE_CHANGE: 'primary',
  APPROVE: 'success',
  REJECT: 'danger',
  EXPORT: 'warning',
  FILE_UPLOAD: 'neutral',
  FILE_DELETE: 'danger',
};

export function ActivityLogPage() {
  const [open, setOpen] = useState<ActivityLog | null>(null);

  const list = useListState(
    {
      action: undefined,
      entityType: undefined,
      from: undefined,
      to: undefined,
    },
    50,
  );

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<ActivityLog>(
    ['logs'],
    '/logs',
    list.queryParams,
  );

  const entityTypes = useQuery({
    queryKey: ['logs', 'entity-types'],
    queryFn: () => apiGet<{ entityType: string; count: number }[]>('/logs/entity-types'),
    staleTime: 300_000,
  });

  const exportCsv = async () => {
    try {
      const blob = await apiDownload('/logs/export', {
        action: list.filters.action,
        entityType: list.filters.entityType,
        from: list.filters.from,
        to: list.filters.to,
      });
      downloadBlob(blob, `activity-log-${toISODate(new Date())}.csv`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  return (
    <div>
      <PageHeader
        title="Activity log"
        description="Every change, who made it and what it changed. Append-only — nothing in the product can edit this."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => void exportCsv()}
          >
            Export CSV
          </Button>
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        placeholder="Search summary, actor or record…"
        activeCount={list.activeFilterCount}
        onReset={list.resetFilters}
      >
        <FilterSelect
          value={list.filters.action}
          onChange={(value) => list.setFilter('action', value)}
          options={ACTIONS}
          allLabel="All actions"
        />
        <FilterSelect
          value={list.filters.entityType}
          onChange={(value) => list.setFilter('entityType', value)}
          options={(entityTypes.data ?? []).map((entry) => ({
            value: entry.entityType,
            label: `${entry.entityType} (${entry.count})`,
          }))}
          allLabel="All record types"
        />
        <Input
          type="date"
          value={list.filters.from ?? ''}
          onChange={(event) => list.setFilter('from', event.target.value || undefined)}
          className="w-36"
        />
        <Input
          type="date"
          value={list.filters.to ?? ''}
          onChange={(event) => list.setFilter('to', event.target.value || undefined)}
          className="w-36"
        />
      </FilterBar>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <TableCard meta={data?.meta} onPageChange={list.setPage}>
          <Table className={cn(isFetching && 'opacity-60')}>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Who</TH>
                <TH>Action</TH>
                <TH>What happened</TH>
                <TH>Record</TH>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <SkeletonRows rows={12} cols={5} />
              ) : data?.data.length === 0 ? (
                <tr>
                  <TD colSpan={5}>
                    <EmptyState
                      icon={<ScrollText className="h-5 w-5" />}
                      title="No matching activity"
                    />
                  </TD>
                </tr>
              ) : (
                data?.data.map((entry) => (
                  <TRow key={entry.id} onClick={() => setOpen(entry)}>
                    <TD className="whitespace-nowrap">
                      <span className="block text-xs text-fg">
                        {fmtDateTime(entry.createdAt)}
                      </span>
                      <span className="block text-2xs text-subtle">
                        {fmtRelative(entry.createdAt)}
                      </span>
                    </TD>
                    <TD className="text-xs text-muted">
                      {entry.actor?.name ?? entry.actorLabel.split('<')[0]?.trim() ?? 'System'}
                      {entry.actor?.kind === 'CLIENT' && (
                        <Badge tone="info" className="ml-1.5">
                          Client
                        </Badge>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={TONES[entry.action] ?? 'neutral'}>
                        {humanise(entry.action)}
                      </Badge>
                    </TD>
                    <TD>
                      <span className="line-clamp-2 text-fg">{entry.summary}</span>
                    </TD>
                    <TD className="text-xs text-muted">
                      <span className="block">{entry.entityType}</span>
                      {entry.entityLabel && (
                        <span className="block truncate text-2xs text-subtle">
                          {entry.entityLabel}
                        </span>
                      )}
                    </TD>
                  </TRow>
                ))
              )}
            </TBody>
          </Table>
        </TableCard>
      )}

      {open && (
        <Drawer open onClose={() => setOpen(null)} title="Log entry" width="lg">
          <div className="space-y-5">
            <Badge tone={TONES[open.action] ?? 'neutral'}>{humanise(open.action)}</Badge>
            <p className="text-sm text-fg">{open.summary}</p>

            <FieldGrid cols={2}>
              <Field label="When">{fmtDateTime(open.createdAt)}</Field>
              <Field label="Actor">{open.actorLabel}</Field>
              <Field label="Record type">{open.entityType}</Field>
              <Field label="Record">{open.entityLabel ?? open.entityId}</Field>
              <Field label="IP address">{open.ip}</Field>
            </FieldGrid>

            {open.diff && Object.keys(open.diff).length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-fg">What changed</h3>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-surface-2">
                      <tr>
                        <th className="dd-th">Field</th>
                        <th className="dd-th">Before</th>
                        <th className="dd-th">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(open.diff).map(([field, change]) => (
                        <tr key={field} className="border-t border-border">
                          <td className="px-4 py-2 font-medium text-fg">{field}</td>
                          <td className="px-4 py-2 text-danger">
                            <code className="break-all text-xs">
                              {JSON.stringify(change.from)}
                            </code>
                          </td>
                          <td className="px-4 py-2 text-success">
                            <code className="break-all text-xs">
                              {JSON.stringify(change.to)}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}
