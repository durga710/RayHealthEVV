import { QueryClient } from '@tanstack/react-query';
import { HttpError } from './api-client';

/**
 * Shared TanStack Query client. Server state lives here instead of per-page
 * useState/useEffect, which fixes refetch-on-mount, duplicate fetches, and
 * the silent-error-swallowing the audit found across list pages.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry auth/permission/not-found — only transient failures.
        if (error instanceof HttpError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});
