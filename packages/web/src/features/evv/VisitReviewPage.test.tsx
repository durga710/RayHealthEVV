import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { VisitReviewPage } from './VisitReviewPage.js';

describe('VisitReviewPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests a maintenance correction instead of directly approving a visit', async () => {
    const mockFetch = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/evv/visits') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'visit-1',
              assignmentId: 'assignment-1',
              caregiverId: 'caregiver-1',
              clockInTime: '2026-05-20T14:00:00.000Z',
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

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<VisitReviewPage />);

    const correctionButton = await screen.findByRole('button', { name: /request correction/i });
    fireEvent.click(correctionButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/maintenance/request-unlock',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            visitId: 'visit-1',
            reason: 'Coordinator requested EVV correction review from Visit Review'
          })
        })
      );
    });
    expect(screen.getByText('Correction request submitted successfully.')).toBeInTheDocument();
  });
});
