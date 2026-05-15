import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { StatusPage } from './StatusPage.js';

/**
 * StatusPage polls three real backend probes on mount and re-renders the
 * cards into the marketing chrome. The chrome itself (header, footer,
 * SupportChat) depends on react-router's Link, so we wrap the tree in a
 * MemoryRouter.
 */

function mockFetchOk() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/health')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'ok',
            uptimeSeconds: 42,
            timestamp: '2026-05-15T12:00:00.000Z',
            version: 'dev',
          }),
      });
    }
    if (url.endsWith('/health/db')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'ok',
            latencyMs: 7,
            timestamp: '2026-05-15T12:00:00.000Z',
          }),
      });
    }
    if (url.endsWith('/health/audit')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'ok',
            lastEventAt: '2026-05-15T11:30:00.000Z',
            ageSeconds: 1_800,
            timestamp: '2026-05-15T12:00:00.000Z',
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe('StatusPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders OK pills for every probe when all three return status=ok', async () => {
    vi.stubGlobal('fetch', mockFetchOk());

    render(
      <MemoryRouter>
        <StatusPage />
      </MemoryRouter>,
    );

    // The first probe is async (Promise.all). Wait for the overall title
    // to flip from the loading placeholder to "All systems operational."
    await waitFor(() =>
      expect(screen.getByText(/all systems operational/i)).toBeInTheDocument(),
    );

    // Header row pill + one pill per service card = 4 "OK" pills.
    const okPills = screen.getAllByText(/^OK$/);
    expect(okPills.length).toBeGreaterThanOrEqual(4);

    // Service names are rendered.
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Audit pipeline')).toBeInTheDocument();
  });
});
