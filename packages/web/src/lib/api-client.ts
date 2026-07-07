import { getCsrfToken, setCsrfToken } from './session-state.js';

async function refreshCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include', headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrfToken?: string };
    if (data.csrfToken) { setCsrfToken(data.csrfToken); return data.csrfToken; }
  } catch { /* ignore */ }
  return null;
}

/**
 * Error thrown by getJson/postJson on non-2xx responses. Carries the HTTP
 * status and the server-provided `{message}` field when present so admin
 * pages can render a real error string instead of "Request failed: 400".
 */
export class ApiError extends Error {
  status: number;
  serverMessage?: string;
  body?: any;
  constructor(status: number, serverMessage?: string, body?: any) {
    super(serverMessage || `Request failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.serverMessage = serverMessage;
    this.body = body;
  }
}

async function extractError(response: Response): Promise<ApiError> {
  let message: string | undefined;
  let body: any = null;
  try {
    body = await response.clone().json();
    if (body) {
      if (typeof body.message === 'string') {
        message = body.message;
      } else if (typeof body.error === 'string') {
        message = body.error;
      }
    }
  } catch {
    // Body wasn't JSON, leave message undefined.
  }
  return new ApiError(response.status, message, body);
}

async function mutate<T>(method: string, path: string, body?: unknown): Promise<T> {
  let token = getCsrfToken();
  const makeHeaders = (t: string | null) => ({
    'content-type': 'application/json',
    ...(t ? { 'x-csrf-token': t } : {})
  });
  const opts = (t: string | null): RequestInit => ({
    method,
    credentials: 'include' as RequestCredentials,
    headers: makeHeaders(t),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  let response = await fetch(path, opts(token));

  // CSRF token may have been rotated server-side (e.g. stale tab, re-deploy).
  // Refresh once and retry before surfacing the error.
  if (response.status === 403) {
    const err = await extractError(response);
    if (err.serverMessage === 'Invalid CSRF token') {
      const fresh = await refreshCsrfToken();
      if (fresh) {
        response = await fetch(path, opts(fresh));
      }
    }
    if (!response.ok) throw err;
  }

  if (!response.ok) throw await extractError(response);
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return mutate<T>('POST', path, body);
}

/**
 * POST a raw text body (e.g. a CSV upload) with the CSRF token. Used by the
 * data-import flow where the payload can exceed the JSON body limit, so it is
 * sent as text/csv and consumed by a route-scoped text parser server-side.
 */
export async function postText<T>(path: string, text: string): Promise<T> {
  const opts = (t: string | null): RequestInit => ({
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'text/csv',
      ...(t ? { 'x-csrf-token': t } : {}),
    },
    body: text,
  });

  let response = await fetch(path, opts(getCsrfToken()));
  if (response.status === 403) {
    const err = await extractError(response);
    if (err.serverMessage === 'Invalid CSRF token') {
      const fresh = await refreshCsrfToken();
      if (fresh) response = await fetch(path, opts(fresh));
    }
    if (!response.ok) throw err;
  }
  if (!response.ok) throw await extractError(response);
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  return mutate<T>('PUT', path, body);
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  return mutate<T>('PATCH', path, body);
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw await extractError(response);
  }

  return (await response.json()) as T;
}

export async function deleteJson<T = void>(path: string): Promise<T | null> {
  return mutate<T | null>('DELETE', path);
}
