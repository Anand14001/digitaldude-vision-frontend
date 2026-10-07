import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, FolderKanban, ListChecks, Search, TrendingUp, Users } from 'lucide-react';
import { apiList } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type {
  ClientListItem,
  EmployeeListItem,
  Lead,
  ProjectListItem,
  TaskListItem,
} from '@/types/api';
import { EmptyState, Modal, Spinner } from '../ui';

interface Hit {
  id: string;
  group: string;
  icon: typeof Search;
  title: string;
  subtitle: string;
  to: string;
}

/**
 * Command-palette search. Each source is queried only when the caller can see
 * it, and a short debounce keeps a fast typist from firing a request per key.
 */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setDebounced('');
      setCursor(0);
    }
  }, [open]);

  const enabled = open && debounced.length >= 2;

  const projects = useQuery({
    queryKey: ['search', 'projects', debounced],
    queryFn: () => apiList<ProjectListItem>('/projects', { q: debounced, pageSize: 5 }),
    enabled: enabled && can('projects.view.all', 'projects.view.assigned'),
  });

  const clients = useQuery({
    queryKey: ['search', 'clients', debounced],
    queryFn: () => apiList<ClientListItem>('/clients', { q: debounced, pageSize: 5 }),
    enabled: enabled && can('clients.view.all', 'clients.view.assigned'),
  });

  const tasks = useQuery({
    queryKey: ['search', 'tasks', debounced],
    queryFn: () => apiList<TaskListItem>('/tasks', { q: debounced, pageSize: 5 }),
    enabled: enabled && can('tasks.view.all', 'tasks.view.assigned'),
  });

  const employees = useQuery({
    queryKey: ['search', 'employees', debounced],
    queryFn: () => apiList<EmployeeListItem>('/employees', { q: debounced, pageSize: 5 }),
    enabled: enabled && can('employees.view.all', 'employees.view.team'),
  });

  const leads = useQuery({
    queryKey: ['search', 'leads', debounced],
    queryFn: () => apiList<Lead>('/leads', { q: debounced, pageSize: 5 }),
    enabled: enabled && can('leads.view.all', 'leads.view.own'),
  });

  const hits = useMemo<Hit[]>(() => {
    const list: Hit[] = [];
    projects.data?.data.forEach((project) =>
      list.push({
        id: `project-${project.id}`,
        group: 'Projects',
        icon: FolderKanban,
        title: `${project.code} ${project.name}`,
        subtitle: project.client?.name ?? 'Internal project',
        to: `/projects/${project.id}`,
      }),
    );
    clients.data?.data.forEach((client) =>
      list.push({
        id: `client-${client.id}`,
        group: 'Clients',
        icon: Briefcase,
        title: client.name,
        subtitle: [client.industry, client.city].filter(Boolean).join(' · ') || 'Client',
        to: `/clients/${client.id}`,
      }),
    );
    tasks.data?.data.forEach((task) =>
      list.push({
        id: `task-${task.id}`,
        group: 'Tasks',
        icon: ListChecks,
        title: `${task.reference} ${task.title}`,
        subtitle: task.project?.name ?? task.retainerCycle?.retainer.name ?? 'Task',
        to: `/tasks/${task.id}`,
      }),
    );
    employees.data?.data.forEach((employee) =>
      list.push({
        id: `employee-${employee.id}`,
        group: 'People',
        icon: Users,
        title: employee.user.name,
        subtitle: employee.designation?.title ?? employee.employeeCode,
        to: `/employees/${employee.id}`,
      }),
    );
    leads.data?.data.forEach((lead) =>
      list.push({
        id: `lead-${lead.id}`,
        group: 'Leads',
        icon: TrendingUp,
        title: lead.title,
        subtitle: lead.companyName ?? lead.contactName,
        to: `/leads/${lead.id}`,
      }),
    );
    return list;
  }, [projects.data, clients.data, tasks.data, employees.data, leads.data]);

  const loading =
    projects.isFetching ||
    clients.isFetching ||
    tasks.isFetching ||
    employees.isFetching ||
    leads.isFetching;

  const go = (hit: Hit) => {
    onClose();
    navigate(hit.to);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, hits.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter') {
      const hit = hits[cursor];
      if (hit) go(hit);
    }
  };

  const grouped = hits.reduce<Record<string, Hit[]>>((acc, hit) => {
    acc[hit.group] = [...(acc[hit.group] ?? []), hit];
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <Modal open={open} onClose={onClose} title="Search" size="lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          autoFocus
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Projects, clients, tasks, people, leads…"
          className="dd-input pl-9"
        />
        {loading && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />}
      </div>

      <div className="mt-4 max-h-[50vh] overflow-y-auto">
        {debounced.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted">
            Type at least two characters to search.
          </p>
        ) : hits.length === 0 && !loading ? (
          <EmptyState
            compact
            icon={<Search className="h-5 w-5" />}
            title="No matches"
            description={`Nothing found for "${debounced}".`}
          />
        ) : (
          Object.entries(grouped).map(([group, groupHits]) => (
            <div key={group} className="mb-3">
              <p className="px-1 pb-1 text-2xs font-semibold uppercase tracking-wider text-subtle">
                {group}
              </p>
              <ul>
                {groupHits.map((hit) => {
                  flatIndex += 1;
                  const active = flatIndex === cursor;
                  return (
                    <li key={hit.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setCursor(hits.indexOf(hit))}
                        onClick={() => go(hit)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                          active ? 'bg-primary-soft' : 'hover:bg-surface-2',
                        )}
                      >
                        <hit.icon
                          className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-subtle')}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">{hit.title}</span>
                          <span className="block truncate text-xs text-muted">{hit.subtitle}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
