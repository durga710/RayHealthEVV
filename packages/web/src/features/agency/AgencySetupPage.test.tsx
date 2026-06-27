import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AgencySetupPage } from './AgencySetupPage.js';
import { setCsrfToken } from '../../lib/session-state.js';

interface FetchInit {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

describe('AgencySetupPage', () => {
  it('persists agency name changes through the API', async () => {
    setCsrfToken('csrf-test-token');

    const mockFetch = vi.fn().mockImplementation((url: string, options?: FetchInit) => {
      if (url === '/api/agencies/current' && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({
            id: 'agency-1',
            name: 'New Keystone Care',
            state: 'PA',
            operatingTracks: ['personal-assistance'],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ id: 'agency-1', name: 'Keystone Care', state: 'PA' }),
      });
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    render(<AgencySetupPage />);

    const nameInput = await screen.findByLabelText(/Agency Name/);
    fireEvent.change(nameInput, { target: { value: 'New Keystone Care' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Agency updated successfully')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agencies/current',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-csrf-token': 'csrf-test-token',
        }),
        body: JSON.stringify({ name: 'New Keystone Care' }),
      }),
    );
  });
});
