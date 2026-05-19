import { getCsrfToken } from './session-state.js';

/**
 * Error thrown by getJson/postJson on non-2xx responses. Carries the HTTP
 * status and the server-provided `{message}` field when present so admin
 * pages can render a real error string instead of "Request failed: 400".
 */
export class ApiError extends Error {
  status: number;
  serverMessage?: string;
  constructor(status: number, serverMessage?: string) {
    super(serverMessage || `Request failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

async function extractError(response: Response): Promise<ApiError> {
  let message: string | undefined;
  try {
    const body = (await response.clone().json()) as { message?: unknown };
    if (body && typeof body.message === 'string') message = body.message;
  } catch {
    // Body wasn't JSON — leave message undefined.
  }
  return new ApiError(response.status, message);
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw await extractError(response);
  }

  return (await response.json()) as T;
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw await extractError(response);
  }

  return (await response.json()) as T;
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(path, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw await extractError(response);
  }

  return (await response.json()) as T;
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
