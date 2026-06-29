import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommandCenterPage } from './CommandCenterPage.js';

// Auth is only used for the greeting name; stub it so no network is needed.
vi.mock('../../lib/AuthContext.js', () => ({
  useAuth: () => ({ user: { firstName: 'Durga' } }),
}));

const summary = {
  asOf: '2026-06-28',
  generatedAt: '2026-06-28T14:00:00.000Z',
  today: { scheduledToday: 10, completed: 4, inProgress: 1, lateStart: 2, upcoming: 3 },
  exceptions: { openExceptions: 1 },
  authorizations: { activeAuthorizations: 9, expiringIn14d: 0, recentlyExpired: 0 },
  credentials: { activeCredentials: 12, expiringIn30d: 0, recentlyExpired: 0 },
  claims: { verifiedVisitsLast7d: 20, flaggedVisitsLast7d: 0 },
  payroll: { verifiedHoursLast7d: 120, inProgressVisits: 0 },
  training: { complianceRate: 0.93, overdue: 0, expired: 0 },
  coverage: { totalGaps: 3 },
  attention: [
    {
      id: 'visits-late-start',
      severity: 'critical',
      title: '2 visits late to start',
      detail: 'Scheduled start passed with no clock-in. Confirm coverage now.',
      count: 2,
      to: '/admin/today',
    },
  ],
};

function mockFetch(handlers: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const body = handlers[url] ?? {};
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
}

describe('CommandCenterPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the prioritized attention item and the coverage-gap KPI', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/api/command-center/summary': summary }));

    render(
      <MemoryRouter>
        <CommandCenterPage />
      </MemoryRouter>,
    );

    // Attention item from the server is rendered as a deep-link.
    const link = await screen.findByText('2 visits late to start');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/admin/today');

    // The Cycle-5 coverage KPI surfaces the forecast gap count.
    expect(screen.getByText('Coverage gaps (14d)')).toBeInTheDocument();
  });

  it('fetches and shows an AI briefing on demand', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/api/command-center/summary': summary,
        '/api/command-center/briefing': {
          available: true,
          briefing: 'Prioritize coverage for the 2 visits late to start.',
          provider: 'bedrock',
        },
      }),
    );

    render(
      <MemoryRouter>
        <CommandCenterPage />
      </MemoryRouter>,
    );

    const btn = await screen.findByRole('button', { name: /summarize my day/i });
    fireEvent.click(btn);

    await waitFor(() =>
      expect(
        screen.getByText(/Prioritize coverage for the 2 visits late to start\./i),
      ).toBeInTheDocument(),
    );
  });
});
