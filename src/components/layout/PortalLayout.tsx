import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Avatar, Button, Dropdown, DropdownItem, DropdownSeparator } from '../ui';
import { Logo, LogoMark } from '../Logo';

const NAV = [
  { to: '/portal', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/portal/approvals', label: 'Approvals', icon: FileCheck2 },
  { to: '/portal/files', label: 'Files', icon: FolderOpen },
  { to: '/portal/team', label: 'Contacts', icon: Users },
];

const THEME_ICONS: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/**
 * The portal is a deliberately separate, lighter shell: a top bar instead of
 * the staff sidebar, no search, no badges, and only the four things a client
 * actually needs. It never renders staff navigation, even for a mis-typed URL.
 */
export function PortalLayout() {
  const { user, logout } = useAuth();
  const mode = useTheme((state) => state.mode);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const ThemeIcon = THEME_ICONS[mode];
  const clientName = user?.client?.name ?? 'Your projects';

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 sm:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex min-w-0 items-center gap-2.5">
            {user?.client?.logoUrl ? (
              <img
                src={user.client.logoUrl}
                alt={clientName}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-border"
              />
            ) : (
              <LogoMark />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight text-fg">
                {clientName}
              </span>
              <span className="block text-2xs leading-tight text-muted">
                Project portal by Digital Dude
              </span>
            </span>
          </div>

          <nav className="ml-6 hidden items-center gap-1 sm:flex">
            {NAV.map((entry) => (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                <entry.icon className="h-4 w-4" />
                {entry.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => useTheme.getState().cycle()}
            aria-label={`Theme: ${mode}`}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>

          <Dropdown
            trigger={
              <button type="button" className="rounded-lg p-1 hover:bg-surface-2">
                <Avatar name={user?.name ?? '?'} src={user?.avatarUrl} size="sm" />
              </button>
            }
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-fg">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
              {user?.client?.canApprove && (
                <p className="mt-1 text-2xs text-success">Can approve deliverables</p>
              )}
            </div>
            <DropdownSeparator />
            <DropdownItem onClick={() => navigate('/portal/team')}>Contacts</DropdownItem>
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
        </div>

        {menuOpen && (
          <nav className="border-t border-border px-3 py-2 sm:hidden">
            {NAV.map((entry) => (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-primary-soft text-primary' : 'text-muted',
                  )
                }
              >
                <entry.icon className="h-4 w-4" />
                {entry.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border bg-surface py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 text-center">
          <p className="text-xs text-muted">
            Need something? Reach your account manager or email{' '}
            <a
              href="mailto:wedigitaldude@gmail.com"
              className="text-primary hover:underline"
            >
              wedigitaldude@gmail.com
            </a>
          </p>
          <span className="mt-1 flex items-center gap-2 text-2xs text-subtle">
            <Logo size="sm" className="opacity-70" />
            <span>Your Digital Partner</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export function PortalBackButton({ to = '/portal' }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <Button variant="ghost" size="sm" onClick={() => navigate(to)} className="-ml-2 mb-2">
      Back to overview
    </Button>
  );
}
