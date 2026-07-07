import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors from a single route so one broken page degrades to
 * a localized message instead of blanking the entire admin shell. Reset it on
 * navigation by passing a changing `key` (the pathname) from the parent layout.
 *
 * Error boundaries must be class components, there is no hook equivalent for
 * `getDerivedStateFromError` / `componentDidCatch`.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the crash in dev; swap for the app logger when one lands.
    console.error('Route render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ maxWidth: 560, margin: '3rem auto', padding: '0 1rem' }}>
        <div
          style={{
            background: 'var(--color-accent-bg, #FEF2F2)',
            border: '1px solid var(--color-accent, #FCA5A5)',
            borderRadius: 12,
            padding: '1.25rem 1.4rem',
          }}
        >
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', color: 'var(--color-accent, #B91C1C)' }}>
            Something went wrong on this page
          </h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--color-text, #0F172A)', lineHeight: 1.5 }}>
            This page failed to render. The rest of the app is still available, try reloading, or pick
            another page from the menu.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--color-primary, #107480)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
