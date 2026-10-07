import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate, humanise, toISODate } from '@/lib/utils';
import type { CalendarFeed, CalendarItem } from '@/types/api';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';

const SOURCE_LABELS: Record<CalendarItem['source'], string> = {
  event: 'Meetings & shoots',
  task: 'Task deadlines',
  milestone: 'Milestones',
  leave: 'Leave',
  holiday: 'Holidays',
  cycle: 'Retainer cycles',
};

const ALL_SOURCES = Object.keys(SOURCE_LABELS) as CalendarItem['source'][];

export function CalendarPage() {
  const { can } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [sources, setSources] = useState<CalendarItem['source'][]>(ALL_SOURCES);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);

  // The grid always shows whole weeks, so the request spans a little either side.
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', toISODate(gridStart), toISODate(gridEnd), sources.join(',')],
    queryFn: () =>
      apiGet<CalendarFeed>('/calendar', {
        from: gridStart.toISOString(),
        to: gridEnd.toISOString(),
        sources: sources.join(','),
      }),
  });

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const itemsFor = (day: Date) =>
    (data?.items ?? []).filter((item) => {
      const start = new Date(item.start);
      const end = new Date(item.end);
      // Multi-day items (leave, cycles) must appear on each day they cover.
      return (
        isSameDay(start, day) ||
        isSameDay(end, day) ||
        (start < day && end > day)
      );
    });

  const selectedItems = selectedDay ? itemsFor(selectedDay) : [];

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Deadlines, shoots, meetings, leave and holidays in one place."
        actions={
          can('calendar.manage') ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New event
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous month"
            onClick={() => setCursor((current) => addMonths(current, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] px-2 text-center text-sm font-medium text-fg">
            {format(cursor, 'MMMM yyyy')}
          </span>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next month"
            onClick={() => setCursor((current) => addMonths(current, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ALL_SOURCES.map((source) => {
            const active = sources.includes(source);
            return (
              <button
                key={source}
                type="button"
                onClick={() =>
                  setSources((current) =>
                    active ? current.filter((entry) => entry !== source) : [...current, source],
                  )
                }
                className={cn(
                  'rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border text-muted hover:border-border-strong',
                )}
              >
                {SOURCE_LABELS[source]}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface-2/60">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <div
                key={label}
                className="px-2 py-2 text-center text-2xs font-semibold uppercase tracking-wider text-muted"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const items = itemsFor(day);
              const outside = !isSameMonth(day, cursor);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'min-h-[6.5rem] border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-surface-2',
                    outside && 'bg-surface-2/40',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      isToday(day)
                        ? 'bg-primary font-semibold text-primary-fg'
                        : outside
                          ? 'text-subtle'
                          : 'text-fg',
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {items.slice(0, 3).map((item) => (
                      <div
                        key={`${item.source}-${item.id}`}
                        className="truncate rounded px-1 py-0.5 text-2xs"
                        style={{ backgroundColor: `${item.color}22`, color: item.color }}
                        title={item.title}
                      >
                        {item.title}
                      </div>
                    ))}
                    {items.length > 3 && (
                      <div className="px-1 text-2xs text-muted">+{items.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {selectedDay && (
        <Modal
          open
          onClose={() => setSelectedDay(null)}
          title={format(selectedDay, 'EEEE, dd MMMM yyyy')}
          description={`${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'}`}
        >
          {selectedItems.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarDays className="h-5 w-5" />}
              title="Nothing scheduled"
            />
          ) : (
            <ul className="space-y-2">
              {selectedItems.map((item) => (
                <li
                  key={`${item.source}-${item.id}`}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {item.source === 'task' ? (
                        <Link
                          to={`/tasks/${item.id}`}
                          onClick={() => setSelectedDay(null)}
                          className="hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </p>
                    <p className="mt-0.5 text-2xs text-muted">
                      {humanise(item.source)}
                      {!item.allDay &&
                        ` · ${fmtDate(item.start, 'h:mm a')} — ${fmtDate(item.end, 'h:mm a')}`}
                      {(item.meta.location as string)
                        ? ` · ${item.meta.location as string}`
                        : ''}
                      {(item.meta.assignee as string)
                        ? ` · ${item.meta.assignee as string}`
                        : ''}
                    </p>
                  </div>
                  <Badge tone="neutral">{humanise(item.source)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {creating && <CreateEventModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    type: 'MEETING',
    description: '',
    location: '',
    date: toISODate(new Date()),
    startTime: '10:00',
    endTime: '11:00',
    allDay: false,
    attendeeUserIds: [] as string[],
  });

  const employees = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () =>
      apiGet<{ id: string; user: { name: string } }[]>('/employees/options/all'),
  });

  const users = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () =>
      apiGet<{ id: string; name: string; employee: { id: string } | null }[]>('/users', {
        kind: 'STAFF',
        status: 'ACTIVE',
        pageSize: 200,
      }),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/calendar/events', {
        title: form.title,
        type: form.type,
        description: form.description || undefined,
        location: form.location || undefined,
        startAt: form.allDay
          ? new Date(`${form.date}T00:00:00`).toISOString()
          : new Date(`${form.date}T${form.startTime}`).toISOString(),
        endAt: form.allDay
          ? new Date(`${form.date}T23:59:00`).toISOString()
          : new Date(`${form.date}T${form.endTime}`).toISOString(),
        allDay: form.allDay,
        attendeeUserIds: form.attendeeUserIds,
      }),
    onSuccess: () => {
      toast.success('Event scheduled');
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New event"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.title.trim().length < 2}
            onClick={() => create.mutate()}
          >
            Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="e.g. TinyLittleToes product shoot"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Type"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
            options={['MEETING', 'SHOOT', 'CLIENT_CALL', 'INTERNAL', 'DEADLINE', 'OTHER'].map(
              (value) => ({ value, label: humanise(value) }),
            )}
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
            placeholder="Studio, client office, Google Meet…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
          {!form.allDay && (
            <>
              <Input
                label="Start"
                type="time"
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
              />
              <Input
                label="End"
                type="time"
                value={form.endTime}
                onChange={(event) => setForm({ ...form, endTime: event.target.value })}
              />
            </>
          )}
        </div>

        <Checkbox
          checked={form.allDay}
          onChange={(event) => setForm({ ...form, allDay: event.target.checked })}
          label="All day"
        />

        <div>
          <span className="dd-label">Who should come?</span>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
            {(users.data ?? [])
              .filter((user) => user.employee)
              .map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border-strong accent-primary"
                    checked={form.attendeeUserIds.includes(user.id)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        attendeeUserIds: event.target.checked
                          ? [...form.attendeeUserIds, user.id]
                          : form.attendeeUserIds.filter((id) => id !== user.id),
                      })
                    }
                  />
                  <span className="text-sm text-fg">{user.name}</span>
                </label>
              ))}
            {employees.isLoading && <p className="p-2 text-xs text-muted">Loading…</p>}
          </div>
          <p className="dd-hint">
            {form.attendeeUserIds.length} invited · they get an email and an in-app notice
          </p>
        </div>

        <Textarea
          label="Notes"
          rows={2}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </div>
    </Modal>
  );
}
