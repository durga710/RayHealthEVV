import type { ReactElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisitCorrectionsTrackingPage } from './VisitCorrectionsTrackingPage.js';

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
  status: 'pending' | 'approved' | 'rejected';
  caregiverSignaturePresent?: boolean;
  clientSignaturePresent?: boolean;
  approverId?: string;
}

const VISIT_ID = '33333333-3333-4333-8333-333333333333';

function makeFetch(rows: VmurFixture[]): typeof global.fetch & ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/maintenance/history')) {
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, data: rows }),
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

const baseRow: VmurFixture = {
  id: 'vm-1',
  visitId: VISIT_ID,
  requesterId: '11111111-1111-4111-8111-111111111111',
  reason: 'late clock-in',
  reasonCategoryCode: 'MFLB',
  correctionCode: 'TIME_CHANGE',
  originatorRole: 'caregiver',
  status: 'pending',
  caregiverSignaturePresent: false,
  clientSignaturePresent: true,
};

describe('VisitCorrectionsTrackingPage', () => {
  it('renders rows with status, originator, and reason code', async () => {
    global.fetch = makeFetch([
      { ...baseRow, id: 'vm-1', status: 'approved', approverId: '22222222-2222-4222-8222-222222222222' },
      { ...baseRow, id: 'vm-2', status: 'rejected', reasonCategoryCode: 'OTHR' },
      { ...baseRow, id: 'vm-3', status: 'pending', originatorRole: 'coordinator' },
    ]);

    const { container } = renderWithClient(<VisitCorrectionsTrackingPage />);

    // Wait for the table to populate, then scope status assertions to <span>
    // badges (the words "Approved" / "Rejected" / "Pending" also appear as
    // <option>s in the filter bar, so unscoped getByText is ambiguous).
    // DataTable renders a <table> while loading (skeleton rows), so wait on
    // real row content rather than the table element itself.
    await waitFor(() => {
      expect(container.querySelector('tbody')?.textContent).toContain('Approved');
    });
    const tbody = container.querySelector('tbody');
    expect(tbody).not.toBeNull();
    const tbodyEl = tbody as HTMLTableSectionElement;
    expect(tbodyEl.textContent).toContain('Approved');
    expect(tbodyEl.textContent).toContain('Rejected');
    expect(tbodyEl.textContent).toContain('Pending');
    expect(tbodyEl.textContent).toContain('MFLB');
    expect(tbodyEl.textContent).toContain('OTHR');
    // Originator column shows distinct roles
    expect(tbodyEl.textContent).toContain('caregiver');
    expect(tbodyEl.textContent).toContain('coordinator');
  });

  it('shows the empty state when there is no history', async () => {
    global.fetch = makeFetch([]);
    renderWithClient(<VisitCorrectionsTrackingPage />);
    await screen.findByText(/No corrections match the current filters/i);
  });

  it('re-fetches with query params when a filter changes', async () => {
    const fetchFn = makeFetch([]);
    global.fetch = fetchFn;

    renderWithClient(<VisitCorrectionsTrackingPage />);

    await screen.findByText(/No corrections match/i);

    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'approved' } });

    await waitFor(() => {
      const lastUrl = fetchFn.mock.calls[fetchFn.mock.calls.length - 1]?.[0];
      expect(lastUrl).toContain('/api/maintenance/history?');
      expect(lastUrl).toContain('status=approved');
    });
  });

  it('renders signature pills correctly for missing caregiver / present client', async () => {
    global.fetch = makeFetch([baseRow]);
    renderWithClient(<VisitCorrectionsTrackingPage />);

    await screen.findByText(/CG ✗/);
    expect(screen.getByText(/CL ✓/)).toBeInTheDocument();
  });
});
