import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
  /** Shown in the message so the person knows what failed. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Stops one broken render from taking down the whole app.
 *
 * Without this, a single unexpected null in one screen leaves a blank page and
 * a stack trace in the console - which is exactly what a user cannot act on.
 * Here they keep the shell, the navigation and a way out.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept to the console deliberately: this is where a developer looks first,
    // and it is the hook to attach Sentry or similar later.
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-fg">
          {this.props.label ?? 'This screen failed to load'}
        </h1>
        <p className="mt-1 max-w-md text-sm text-muted">
          Something went wrong rendering this page. The rest of the CRM is fine &mdash; try again,
          or move to another screen.
        </p>

        <pre className="mt-4 max-w-xl overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-left text-2xs text-muted">
          {error.message}
        </pre>

        <div className="mt-5 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => this.setState({ error: null })}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Try again
          </Button>
          <Button onClick={() => window.location.assign('/')}>Go to dashboard</Button>
        </div>
      </div>
    );
  }
}
