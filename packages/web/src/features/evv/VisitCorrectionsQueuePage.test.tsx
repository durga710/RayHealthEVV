import type { ReactElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisitCorrectionsQueuePage } from './VisitCorrectionsQueuePage.js';

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

interface VmurFixture {
  id: string;
  visitId: string;
  requesterId: string;
  reason: string;
  reasonCategoryCode?: string;
  correctionCode?: string;
  originatorRole?: 'caregiver' | 'coordinator' | 'admin';
  status: 'pending';
  caregiverSignaturePresent?: boolean;
  clientSignaturePresent?: boolean;
  incompleteSignatureReason?: string;
}

const VISIT_ID = '33333333-3333-4333-8333-333333333333';
const VM_ID = 'vm-1';

function makeFetch(initialQueue: VmurFixture[]): typeof global.fetch & ReturnType<typeof vi.fn> {
  let queue = [...initialQueue];
  // vi.fn().mockImplementation returns a Mock that doesn't perfectly satisfy
  // the typed fetch signature in strict TS. Cast through unknown — the runtime
  // behavior is correct, this is only a type-system reconciliation.
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (typeof url === 'string' && url.endsWith('/api/maintenance/queue') && (!options || options.method === undefined || options.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: () => Promise.resolve({ success: true, data: queue }),
      });
    }
    if (typeof url === 'string' && url.startsWith('/api/maintenance/approve-unlock/') && options?.method === 'POST') {
      queue = queue.filter((q) => !url.endsWith(q.id));
      return Promise.resolve({
        ok: true,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: () => Promise.resolve({ success: true, data: { id: VM_ID, status: 'approved' } }),
      });
    }
    if (typeof url === 'string' && url.startsWith('/api/maintenance/reject-unlock/') && options?.method === 'POST') {
      queue = queue.filter((q) => !url.endsWith(q.id));
      return Promise.resolve({
        ok: true,
        headers: { get: (k: string) => (k === 'content-type' ? 'application/json' : null) },
        json: () => Promise.resolve({ success: true, data: { id: VM_ID, status: 'rejected' } }),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: () => Promise.resolve({}),
    });
  }) as unknown as typeof global.fetch & ReturnType<typeof vi.fn>;
}

const fixture: VmurFixture = {
  id: VM_ID,
  visitId: VISIT_ID,
  requesterId: '11111111-1111-4111-8111-111111111111',
  reason: 'Caregiver forgot to clock in until 10 minutes after arrival.',
  reasonCategoryCode: 'MFLB',
  correctionCode: 'TIME_CHANGE',
  originatorRole: 'caregiver',
  caregiverSignaturePresent: false,
  clientSignaturePresent: true,
  incompleteSignatureReason: 'Caregiver phone died before signature capture.',
  status: 'pending',
};

describe('VisitCorrectionsQueuePage', () => {
  it('renders pending corrections with reason code, correction code, and signature status', async () => {
    global.fetch = makeFetch([fixture]);

    renderWithClient(<VisitCorrectionsQueuePage />);

    await screen.findByText((content) => content.includes('MFLB'));
    expect(screen.getByText(/Manual entry — late/i)).toBeInTheDocument();
    expect(screen.getByText(/Time changed/i)).toBeInTheDocument();
    expect(screen.getByText(/Originator:/i)).toBeInTheDocument();
    // Signature pills
    expect(screen.getByText(/Caregiver: ✗ missing/i)).toBeInTheDocument();
    expect(screen.getByText(/Client: ✓ present/i)).toBeInTheDocument();
    expect(screen.getByText(/Justification:/i)).toBeInTheDocument();
  });

  it('approves a correction and refreshes the queue', async () => {
    const fetchFn = makeFetch([fixture]);
    global.fetch = fetchFn;

    renderWithClient(<VisitCorrectionsQueuePage />);

    await screen.findByRole('button', { name: /approve correction/i });
    fireEvent.click(screen.getByRole('button', { name: /approve correction/i }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledWith(
        `/api/maintenance/approve-unlock/${VM_ID}`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
    // After approval, the queue refresh should leave an empty state.
    await screen.findByText(/Queue is clear/i);
  });

  it('requires a reason before rejecting and then submits it', async () => {
    const fetchFn = makeFetch([fixture]);
    global.fetch = fetchFn;

    renderWithClient(<VisitCorrectionsQueuePage />);

    await screen.findByRole('button', { name: /reject…|reject/i });
    fireEvent.click(screen.getByRole('button', { name: 'Reject…' }));

    const textarea = await screen.findByPlaceholderText(/insufficient documentation/i);
    fireEvent.change(textarea, { target: { value: 'needs more docs' } });

    fireEvent.click(screen.getByRole('button', { name: /confirm rejection/i }));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledWith(
        `/api/maintenance/reject-unlock/${VM_ID}`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('needs more docs'),
        }),
      );
    });
  });

  it('shows the empty state when the queue is clear', async () => {
    global.fetch = makeFetch([]);

    renderWithClient(<VisitCorrectionsQueuePage />);

    await screen.findByText(/Queue is clear/i);
  });

  it('surfaces server errors when approve fails', async () => {
    let firstCall = true;
    global.fetch = (vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith('/api/maintenance/queue') && (!options || options.method === undefined)) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true, data: [fixture] }),
        });
      }
      if (url.startsWith('/api/maintenance/approve-unlock/') && options?.method === 'POST') {
        if (firstCall) {
          firstCall = false;
          return Promise.resolve({
            ok: false,
            status: 404,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ success: false, error: 'Unlock request not found' }),
          });
        }
      }
      return Promise.resolve({ ok: false, status: 404, headers: { get: () => null }, json: () => Promise.resolve({}) });
    })) as unknown as typeof global.fetch;

    renderWithClient(<VisitCorrectionsQueuePage />);
    await screen.findByRole('button', { name: /approve correction/i });
    fireEvent.click(screen.getByRole('button', { name: /approve correction/i }));

    await screen.findByText(/Unlock request not found/i);
  });
});
