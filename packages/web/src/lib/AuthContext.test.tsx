import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AuthProvider, useAuth } from './AuthContext.js';

function Probe() {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="state">{isAuthenticated ? 'in' : 'out'}</div>
      <button onClick={() => login('admin@rayhealth.example', 'password')}>login</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('hydrates from /auth/me and never stores JWTs in localStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        userId: 'user-1',
        role: 'admin',
        agencyId: 'agency-1',
        csrfToken: 'csrf-1'
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    expect(localStorage.getItem('rayhealth_token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('logs in through cookie session response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Not authenticated' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ userId: 'user-1', role: 'admin', agencyId: 'agency-1', csrfToken: 'csrf-login' })
      }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('out'));
    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    expect(localStorage.length).toBe(0);
  });
});
