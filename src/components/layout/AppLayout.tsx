import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Clock,
  FileCheck2,
  FolderKanban,
  Gauge,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palmtree,
  Repeat,
  ScrollText,
  Search,
  Settings,
  Sun,
  Workflow,
  Target,
  TrendingUp,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PermissionKey, SidebarBadges } from '@/types/api';
import { Avatar, Button, Dropdown, DropdownItem, DropdownSeparator } from '../ui';
import { ErrorBoundary } from '../ErrorBoundary';
import { NotificationPanel } from './NotificationPanel';
import { GlobalSearch } from './GlobalSearch';

interface NavEntry {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Any one of these is enough to see the item. */
  permissions?: PermissionKey[];
  badge?: keyof SidebarBadges;
  section: string;
}

/**
 * One navigation table, filtered by permission. The sidebar therefore reflects
 * what each role can actually do rather than showing dead links - while the API
 * remains the real gate.
 */
const NAV: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, section: 'Work' },
  {
    to: '/tasks',
    label: 'My Tasks',
    icon: ListChecks,
    permissions: ['tasks.view.assigned', 'tasks.view.all'],
    badge: 'overdueTasks',
    section: 'Work',
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    permissions: ['projects.view.all', 'projects.view.assigned'],
    section: 'Work',
  },
  {
    to: '/workflows',
    label: 'Workflows',
    icon: Workflow,
    permissions: ['settings.workflows.manage'],
    section: 'Work',
  },
  {
    to: '/retainers',
    label: 'Retainers',
    icon: Repeat,
    permissions: ['retainers.view.all', 'retainers.view.assigned'],
    section: 'Work',
  },
  {
    to: '/deliverables',
    label: 'Deliverables',
    icon: FileCheck2,
    permissions: ['deliverables.view'],
    badge: 'deliverableReviews',
    section: 'Work',
  },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: CalendarDays,
    permissions: ['calendar.view.own', 'calendar.view.all'],
    section: 'Work',
  },
  {
    to: '/clients',
    label: 'Clients',
    icon: Briefcase,
    permissions: ['clients.view.all', 'clients.view.assigned'],
    section: 'Business',
  },
  {
    to: '/leads',
    label: 'Leads',
    icon: TrendingUp,
    permissions: ['leads.view.all', 'leads.view.own'],
    section: 'Business',
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: Gauge,
    permissions: ['reports.view'],
    section: 'Business',
  },
  {
    to: '/employees',
    label: 'Employees',
    icon: Users,
    permissions: ['employees.view.all', 'employees.view.team'],
    section: 'People',
  },
  {
    to: '/timesheets',
    label: 'Timesheets',
    icon: Clock,
    permissions: ['timesheets.log.own', 'timesheets.view.all', 'timesheets.view.team'],
    badge: 'timesheetApprovals',
    section: 'People',
  },
  {
    to: '/attendance',
    label: 'Attendance',
    icon: ClipboardList,
    permissions: ['attendance.mark.own', 'attendance.view.all', 'attendance.view.team'],
    section: 'People',
  },
  {
    to: '/leave',
    label: 'Leave',
    icon: Palmtree,
    permissions: ['leave.request.own', 'leave.view.all', 'leave.view.team'],
    badge: 'leaveApprovals',
    section: 'People',
  },
  {
    to: '/performance',
    label: 'Performance',
    icon: Target,
    permissions: ['performance.view.own', 'performance.view.team', 'performance.view.all'],
    section: 'People',
  },
  {
    to: '/logs',
    label: 'Activity Log',
    icon: ScrollText,
    permissions: ['logs.view'],
    section: 'Admin',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    permissions: [
      'settings.org.manage',
      'settings.roles.manage',
      'settings.users.manage',
      'settings.workflows.manage',
      'settings.masters.manage',
    ],
    section: 'Admin',
  },
];

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function AppLayout() {
  const { user, can, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('dd-sidebar') === 'collapsed',
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Badge counts are polled rather than pushed; a minute is fresh enough.
  const { data: badges } = useQuery({
    queryKey: ['badges'],
    queryFn: () => apiGet<SidebarBadges>('/dashboard/badges'),
    refetchInterval: 60_000,
    enabled: user?.kind === 'STAFF',
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('dd-sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  // Cmd/Ctrl+K opens search, which is how people navigate once there is data.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sections = useMemo(() => {
    const visible = NAV.filter((entry) => !entry.permissions || can(...entry.permissions));
    const grouped = new Map<string, NavEntry[]>();
    for (const entry of visible) {
      grouped.set(entry.section, [...(grouped.get(entry.section) ?? []), entry]);
    }
    return [...grouped.entries()];
  }, [can]);

  const ThemeIcon = THEME_ICONS[mode];

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-14 items-center gap-2.5 border-b border-border px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg">
            DD
          </span>
          {!collapsed && (
            <span className="truncate">
              <span className="block text-sm font-semibold leading-tight text-fg">
                Digital Dude
              </span>
              <span className="block text-2xs leading-tight text-muted">CRM</span>
            </span>
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map(([section, entries]) => (
          <div key={section} className="mb-4">
            {!collapsed && (
              <p className="px-2.5 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">
                {section}
              </p>
            )}
            <ul className="space-y-0.5">
              {entries.map((entry) => {
                const count = entry.badge ? (badges?.[entry.badge] ?? 0) : 0;
                return (
                  <li key={entry.to}>
                    <NavLink
                      to={entry.to}
                      end={entry.to === '/'}
                      title={collapsed ? entry.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                          collapsed && 'justify-center px-2',
                          isActive
                            ? 'bg-primary-soft text-primary'
                            : 'text-muted hover:bg-surface-2 hover:text-fg',
                        )
                      }
                    >
                      <entry.icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
                      {!collapsed && <span className="flex-1 truncate">{entry.label}</span>}
                      {count > 0 && (
                        <span
                          className={cn(
                            'rounded-full bg-danger px-1.5 text-2xs font-semibold text-white',
                            collapsed && 'absolute ml-5 mt-[-14px] px-1',
                          )}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className={cn(
            'hidden w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg lg:flex',
            collapsed && 'justify-center px-2',
          )}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full bg-bg">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-border bg-surface transition-[width] lg:block',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative h-full w-64 border-r border-border bg-surface">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3.5 rounded-lg p-1.5 text-muted hover:bg-surface-2"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-1.5 text-sm text-subtle transition-colors hover:border-border-strong sm:max-w-xs"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 text-2xs text-muted sm:inline">
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => useTheme.getState().cycle()}
            title={`Theme: ${mode}`}
            aria-label={`Theme: ${mode}. Click to change.`}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ThemeIcon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </button>

          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
            {(badges?.notifications ?? 0) > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
            )}
          </button>

          <Dropdown
            trigger={
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface-2"
              >
                <Avatar name={user?.name ?? '?'} src={user?.avatarUrl} size="sm" />
                <span className="hidden text-left sm:block">
                  <span className="block text-xs font-medium leading-tight text-fg">
                    {user?.name}
                  </span>
                  <span className="block text-2xs leading-tight text-muted">
                    {user?.role?.name ?? 'Staff'}
                  </span>
                </span>
              </button>
            }
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-fg">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
              {user?.employee && (
                <p className="mt-0.5 text-2xs text-subtle">
                  {user.employee.code}
                  {user.employee.designation ? ` · ${user.employee.designation}` : ''}
                </p>
              )}
            </div>
            <DropdownSeparator />
            <DropdownItem icon={<UserCircle className="h-4 w-4" />} onClick={() => navigate('/profile')}>
              My profile
            </DropdownItem>
            <DropdownItem
              icon={<KeyRound className="h-4 w-4" />}
              onClick={() => navigate('/profile?tab=security')}
            >
              Change password
            </DropdownItem>
            <DropdownSeparator />
            <div className="px-2.5 py-1.5">
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
                Theme
              </p>
              <div className="flex gap-1">
                {(['light', 'dark', 'system'] as ThemeMode[]).map((option) => {
                  const Icon = THEME_ICONS[option];
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMode(option);
                      }}
                      className={cn(
                        'flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-2xs capitalize transition-colors',
                        mode === option
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-border text-muted hover:bg-surface-2',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
            <DropdownSeparator />
            <DropdownItem
              icon={<LogOut className="h-4 w-4" />}
              tone="danger"
              onClick={() => {
                void logout().then(() => navigate('/login'));
              }}
            >
              Sign out
            </DropdownItem>
          </Dropdown>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            {/* Keyed on the path so moving to another screen clears a failure. */}
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <NotificationPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

/** Shown while the session bootstraps, so routes never flash the login screen. */
export function FullPageLoader() {
  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-fg">
          DD
        </span>
        <p className="text-sm text-muted">Loading your workspace…</p>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-5xl font-bold text-border-strong">404</p>
      <h1 className="mt-4 text-lg font-semibold text-fg">We cannot find that page</h1>
      <p className="mt-1 text-sm text-muted">
        The link may be out of date, or you may not have access to it.
      </p>
      <Button className="mt-6" onClick={() => window.history.back()}>
        Go back
      </Button>
    </div>
  );
}
