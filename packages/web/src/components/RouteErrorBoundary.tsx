import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors from a single route so one broken page degrades
 * to a localized message instead of blanking the entire app shell. Reset it on
 * navigation by passing a changing `key` (e.g. the pathname) from the parent.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console -- surface the crash in dev; swap for the app logger when one lands.
    console.error('Route render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg py-12">
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertTitle>Something went wrong on this page</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>
                This page failed to render. The rest of the app is still
                available — try reloading, or pick another page from the menu.
              </span>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Reload page
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
