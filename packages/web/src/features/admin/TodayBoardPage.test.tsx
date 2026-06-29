import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TodayBoardPage } from './TodayBoardPage.js';

const board = {
  generatedAt: '2026-06-28T14:00:00.000Z',
  counts: { scheduledToday: 3, late: 1, inProgress: 1, upcoming: 0, completed: 1 },
  visits: [
    {
      assignmentId: 'a1', clientName: 'Anita Late', caregiverName: 'Care One',
      scheduledStartTime: '2026-06-28T13:00:00Z', clockInTime: null, clockOutTime: null, status: 'late',
    },
    {
      assignmentId: 'a2', clientName: 'Bob Active', caregiverName: 'Care Two',
      scheduledStartTime: '2026-06-28T13:30:00Z', clockInTime: '2026-06-28T13:31:00Z', clockOutTime: null, status: 'in_progress',
    },
    {
      assignmentId: 'a3', clientName: 'Cara Done', caregiverName: 'Care Three',
      scheduledStartTime: '2026-06-28T09:00:00Z', clockInTime: '2026-06-28T09:01:00Z', clockOutTime: '2026-06-28T13:00:00Z', status: 'completed',
    },
  ],
};

describe('TodayBoardPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all visits with status badges', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(board) }),
    ));

    render(
      <MemoryRouter>
        <TodayBoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Anita Late')).toBeInTheDocument();
    expect(screen.getByText('Bob Active')).toBeInTheDocument();
    expect(screen.getByText('Cara Done')).toBeInTheDocument();
    expect(screen.getByText('Late to start')).toBeInTheDocument();
  });

  it('filters to a single bucket when a tab is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(board) }),
    ));

    render(
      <MemoryRouter>
        <TodayBoardPage />
      </MemoryRouter>,
    );

    await screen.findByText('Anita Late');

    // Click the "Completed" filter tab — only the completed visit should remain.
    fireEvent.click(screen.getByRole('button', { name: /Completed/i }));

    await waitFor(() => expect(screen.queryByText('Anita Late')).not.toBeInTheDocument());
    expect(screen.getByText('Cara Done')).toBeInTheDocument();
  });
});
