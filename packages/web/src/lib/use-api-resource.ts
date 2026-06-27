import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getJson } from './api-client';

/**
 * Read a JSON resource from the API as cached server state.
 *
 * Replaces the per-page `useState` + `useEffect(fetch)` triad: provides
 * loading/error/data uniformly, dedupes concurrent reads of the same path,
 * and surfaces real errors instead of silently swallowing them into `[]`.
 *
 * @param key   Stable query key. A string is wrapped into a single-element key.
 * @param path  API path passed to `getJson` (e.g. `/api/clients`).
 */
export function useApiResource<T>(
  key: string | readonly unknown[],
  path: string,
  options?: { enabled?: boolean },
): UseQueryResult<T> {
  return useQuery<T>({
    queryKey: typeof key === 'string' ? [key] : key,
    queryFn: () => getJson<T>(path),
    enabled: options?.enabled,
  });
}
