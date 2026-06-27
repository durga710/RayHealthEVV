import type { ReactElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisitReviewPage } from './VisitReviewPage.js';

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('VisitReviewPage', () => {
  it('creates a maintenance request when a visit needs correction', async () => {
    const mockFetch = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/evv/visits') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: '33333333-3333-4333-8333-333333333333',
              assignmentId: '22222222-2222-4222-8222-222222222222',
              caregiverId: '11111111-1111-4111-8111-111111111111',
              clockInTime: '2026-05-08T12:00:00.000Z',
              status: 'pending'
            }
          ])
        });
      }

      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'maintenance-1', status: 'pending' })
        });
      }

      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });
    global.fetch = mockFetch;

    renderWithClient(<VisitReviewPage />);

    await screen.findByText('11111111...');
    fireEvent.click(screen.getByRole('button', { name: /request correction/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/maintenance/request-unlock',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            visitId: '33333333-3333-4333-8333-333333333333',
            reason: 'Coordinator requested EVV correction review from Visit Review'
          })
        })
      );
    });
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/maintenance/approve-unlock'), expect.anything());
  });
});
