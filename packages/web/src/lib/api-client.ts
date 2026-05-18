import { getCsrfToken } from './session-state.js';

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
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
