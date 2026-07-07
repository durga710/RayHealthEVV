import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AssignmentsPage } from './AssignmentsPage.js';

describe('AssignmentsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a coordinator assignment form', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: '123',
            clientId: body.clientId || 'client-1',
            caregiverId: body.caregiverId || 'caregiver-1',
            visitTemplateId: body.visitTemplateId || 'template-1',
          })
        });
      }
      if (url === '/api/assignments') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === '/api/templates') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'template-1', name: 'Morning Routine', clientId: 'client-1' }])
        });
      }
      if (url === '/api/clients') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'client-1', firstName: 'Jane', lastName: 'Doe' }])
        });
      }
      if (url === '/api/staff') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'caregiver-1', email: 'care@example.com', role: 'caregiver' }])
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<AssignmentsPage />);

    // Templates and clients load in the same Promise.all. Morning Routine
    // appearing confirms all data is available.
    await screen.findByRole('option', { name: /Morning Routine/i });

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Caregiver'), { target: { value: 'caregiver-1' } });
    fireEvent.change(screen.getByLabelText('Visit Template'), { target: { value: 'template-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Assignment' }));

    await waitFor(() => {
      expect(screen.getByText(/Assignment created for/i)).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/assignments',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
