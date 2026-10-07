import type { ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

const ICONS: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/**
 * Shared frame for every unauthenticated screen. The theme toggle is available
 * here too, so someone on a dark-mode machine is not blinded before signing in.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { mode, setMode } = useTheme();

  return (
    <div className="relative flex min-h-full items-center justify-center bg-bg px-4 py-10">
      {/* Soft brand wash; purely decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-info/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 flex gap-1">
        {(['light', 'dark', 'system'] as ThemeMode[]).map((option) => {
          const Icon = ICONS[option];
          return (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              title={`${option} theme`}
              aria-label={`${option} theme`}
              className={cn(
                'rounded-lg border p-2 transition-colors',
                mode === option
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-transparent text-muted hover:bg-surface-2',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>

        <div className="dd-card p-6">{children}</div>

        <p className="mt-6 text-center text-2xs text-subtle">
          Digital Dude · Poonamallee, Chennai · Internal use only
        </p>
      </div>
    </div>
  );
}

/** Live checklist shown while someone picks a new password. */
export function PasswordRules({ value }: { value: string }) {
  // Mirrors validatePasswordStrength in the API; keep the two in step.
  const rules = [
    { label: 'At least 10 characters', ok: value.length >= 10 },
    { label: 'Contains a letter', ok: /[a-zA-Z]/.test(value) },
    { label: 'Contains a number', ok: /[0-9]/.test(value) },
  ];

  return (
    <ul className="mt-2 space-y-1">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={cn(
            'flex items-center gap-2 text-xs transition-colors',
            rule.ok ? 'text-success' : 'text-muted',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              rule.ok ? 'bg-success' : 'bg-border-strong',
            )}
          />
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

export const passwordIsValid = (value: string) =>
  value.length >= 10 && /[a-zA-Z]/.test(value) && /[0-9]/.test(value);
