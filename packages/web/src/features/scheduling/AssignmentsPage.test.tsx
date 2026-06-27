import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssignmentsPage } from './AssignmentsPage.js';

function renderWithRouter() {
  // Reads now flow through TanStack Query (useApiResource), so a client is
  // required. Disable retries so the test isn't slowed by transient-failure
  // backoff and so errors surface immediately.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AssignmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

interface FetchInit {
  method?: string;
  body?: string;
}

describe('AssignmentsPage', () => {
  it('submits a coordinator assignment form with caregiver picker', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: FetchInit) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body ?? '{}');
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({
            id: '123',
            clientId: body.clientId || 'client-1',
            caregiverId: body.caregiverId || 'caregiver-1',
            visitTemplateId: body.visitTemplateId || 'template-1',
            visitDate: body.visitDate || '',
          }),
        });
      }
      if (url === '/api/templates') {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve([{ id: 'template-1', name: 'Morning Routine', clientId: 'client-1' }]),
        });
      }
      if (url === '/api/staff') {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'caregiver-1', firstName: 'Roberto', lastName: 'Smith', email: 'rob@example.com', status: 'active' },
            ],
          }),
        });
      }
      if (url === '/api/clients') {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve([
            { id: 'client-1', firstName: 'Anita', lastName: 'Lopez', dateOfBirth: '1948-03-12' },
          ]),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve([]),
      });
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    renderWithRouter();

    // Wait for templates, caregivers, and clients to load
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Morning Routine/i })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Smith, Roberto/i })).toBeInTheDocument();
    });
    await waitFor(() => {
      // "Lopez, Anita" appears in BOTH the client dropdown and the template
      // dropdown (because the template's client name is rendered there too),
      // so we assert at-least-one rather than exactly-one.
      expect(screen.getAllByRole('option', { name: /Lopez, Anita/i }).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Caregiver'), { target: { value: 'caregiver-1' } });
    fireEvent.change(screen.getByLabelText('Visit Template'), { target: { value: 'template-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Assignment/i }));

    await waitFor(() => {
      expect(screen.getByText('Assignment created successfully')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalled();
  });
});
