import type { ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button, Card, Pagination, Select } from './ui';
import { cn, humanise } from '@/lib/utils';
import type { PageMeta } from '@/types/api';

/**
 * Filter bar shared by every list screen: search on the left, dropdowns beside
 * it, a clear-all that only appears when something is actually filtered.
 */
export function FilterBar({
  search,
  onSearch,
  placeholder = 'Search…',
  children,
  activeCount,
  onReset,
  actions,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  activeCount?: number;
  onReset?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1 lg:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          className="dd-input pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}

      {Boolean(activeCount) && onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} icon={<X className="h-3.5 w-3.5" />}>
          Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
        </Button>
      )}

      {actions && <div className="flex items-center gap-2 lg:ml-auto">{actions}</div>}
    </div>
  );
}

/** Compact enum dropdown for the filter bar. */
export function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  className,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: readonly string[] | { value: string; label: string }[];
  allLabel: string;
  className?: string;
}) {
  const normalised = options.map((option) =>
    typeof option === 'string' ? { value: option, label: humanise(option) } : option,
  );

  return (
    <Select
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || undefined)}
      className={cn('w-auto min-w-[9rem]', className)}
    >
      <option value="">{allLabel}</option>
      {normalised.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/** Card wrapper around a table plus its pagination footer. */
export function TableCard({
  children,
  meta,
  onPageChange,
  className,
}: {
  children: ReactNode;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {children}
      {meta && onPageChange && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          pageSize={meta.pageSize}
          onChange={onPageChange}
        />
      )}
    </Card>
  );
}

export function ViewToggle({
  view,
  onChange,
  views,
}: {
  view: string;
  onChange: (value: string) => void;
  views: { value: string; label: string; icon: ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {views.map((entry) => (
        <button
          key={entry.value}
          type="button"
          onClick={() => onChange(entry.value)}
          title={entry.label}
          aria-label={entry.label}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            view === entry.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {entry.icon}
          <span className="hidden sm:inline">{entry.label}</span>
        </button>
      ))}
    </div>
  );
}

export const FilterIcon = SlidersHorizontal;
