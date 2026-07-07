import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuditPacketPage } from './AuditPacketPage.js';

const visitId = '00000000-0000-4000-8000-000000000c01';

const samplePacket = {
  packet: {
    generatedAt: '2026-07-06T18:00:00.000Z',
    generatedBy: '00000000-0000-4000-8000-000000000a09',
    agencyId: '00000000-0000-4000-8000-000000000a00',
    integritySha256: 'a'.repeat(64)
  },
  visit: {
    id: visitId,
    status: 'verified',
    serviceCode: 'T1019',
    serviceDescription: 'Personal care services, per 15 minutes',
    scheduledStartTime: '2026-06-01T14:00:00.000Z',
    scheduledEndTime: '2026-06-01T16:00:00.000Z',
    clockInTime: '2026-06-01T14:02:00.000Z',
    clockOutTime: '2026-06-01T16:01:00.000Z'
  },
  caregiver: { id: '00000000-0000-4000-8000-000000000c03', name: 'Jane Caregiver' },
  client: { id: '00000000-0000-4000-8000-000000000c04', name: 'John Client' },
  curesActElements: {
    'service-type': true,
    beneficiary: true,
    date: true,
    location: true,
    provider: true,
    'start-time': true,
    'end-time': true
  },
  geofence: {
    clockIn: { captured: true, accuracyM: 10, result: 'within', distanceM: 5, allowedM: 150 },
    clockOut: { captured: true, accuracyM: 8, result: 'within', distanceM: 6, allowedM: 150 }
  },
  exceptions: [
    {
      id: 'exc-1',
      exceptionType: 'late-clock-in',
      reason: 'Traffic delay',
      status: 'resolved',
      resolvedBy: '00000000-0000-4000-8000-000000000c05',
      resolvedAt: '2026-06-01T18:00:00.000Z'
    }
  ],
  corrections: [
    {
      id: 'corr-1',
      status: 'approved',
      requesterId: '00000000-0000-4000-8000-000000000c06',
      requesterName: 'Pat Requester',
      reason: 'Device damaged mid-shift',
      reasonCategoryCode: 'DCDB',
      correctionCode: 'TIME_CHANGE',
      approverId: '00000000-0000-4000-8000-000000000c07',
      approverName: 'Alex Approver',
      approvedAt: '2026-06-02T09:00:00.000Z',
      originalStartTime: '2026-06-01T14:00:00.000Z',
      originalEndTime: '2026-06-01T15:45:00.000Z',
      adjustedStartTime: '2026-06-01T14:02:00.000Z',
      adjustedEndTime: '2026-06-01T16:01:00.000Z'
    }
  ],
  auditEvents: [
    {
      id: 'evt-1',
      eventType: 'exception.filed',
      entityType: 'evv.visit',
      outcome: 'success',
      actorId: '00000000-0000-4000-8000-000000000c08',
      actorType: 'user',
      occurredAt: '2026-06-01T15:00:00.000Z',
      payloadSha256: 'b'.repeat(64)
    }
  ],
  aggregator: {
    sandataStatus: 'submitted',
    sandataConfirmationId: 'SAND-CONF-1',
    hhaexchangeStatus: null,
    hhaexchangeConfirmationId: null
  }
};

/** api-client's extractError() calls response.clone().json(), plain mock
 *  response objects need a self-returning `clone()` for that to work. */
function errorResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
    clone(this: unknown) {
      return this;
    }
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/audit-packet" element={<AuditPacketPage />} />
        <Route path="/admin/audit-packet/:visitId" element={<AuditPacketPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuditPacketPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every packet section from a mocked response, with the integrity hash visible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(samplePacket) })
    );

    renderAt(`/admin/audit-packet/${visitId}`);

    expect(await screen.findByText('Jane Caregiver')).toBeInTheDocument();
    expect(screen.getByText('John Client')).toBeInTheDocument();
    expect(screen.getByText('Personal care services, per 15 minutes')).toBeInTheDocument();
    expect(screen.getByText('Traffic delay')).toBeInTheDocument();
    expect(screen.getByText('Device damaged mid-shift')).toBeInTheDocument();
    expect(screen.getByText('Pat Requester')).toBeInTheDocument();
    expect(screen.getByText('Alex Approver')).toBeInTheDocument();
    expect(screen.getByText(/exception.filed/i)).toBeInTheDocument();
    expect(screen.getByText('SAND-CONF-1')).toBeInTheDocument();
    // Integrity hash rendered prominently.
    expect(screen.getByText(samplePacket.packet.integritySha256)).toBeInTheDocument();
  });

  it('shows a loading skeleton before the fetch resolves', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => {})) // never resolves
    );
    renderAt(`/admin/audit-packet/${visitId}`);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders ErrorRetry on a non-404 fetch failure, and retry re-fetches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500, { message: 'boom' }))
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(samplePacket) });
    vi.stubGlobal('fetch', fetchMock);

    renderAt(`/admin/audit-packet/${visitId}`);

    expect(await screen.findByText('boom')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.getByText('Jane Caregiver')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders a not-found empty state on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(404, { message: 'Visit not found' })));

    renderAt(`/admin/audit-packet/${visitId}`);
    expect(await screen.findByText('Visit not found')).toBeInTheDocument();
  });

  it('never renders raw lat/lng-like coordinate fields, geofence shows only result/distance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(samplePacket) })
    );

    const { container } = renderAt(`/admin/audit-packet/${visitId}`);
    await screen.findByText('Jane Caregiver');

    const html = container.innerHTML;
    expect(html).not.toMatch(/"lat"/);
    expect(html).not.toMatch(/"lng"/);
    expect(html).not.toMatch(/clockInLocation/);
    expect(html).not.toMatch(/clockOutLocation/);
    // Geofence facts render, but only the derived result/distance/allowed shape.
    expect(screen.getAllByText(/within geofence/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('5 m').length).toBeGreaterThan(0);
  });

  it('calls window.print when the Print packet button is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(samplePacket) })
    );
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    renderAt(`/admin/audit-packet/${visitId}`);
    const printButton = await screen.findByRole('button', { name: /print packet/i });
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('renders a visit-id lookup form when no visitId param is present', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderAt('/admin/audit-packet');
    expect(screen.getByRole('button', { name: /view packet/i })).toBeInTheDocument();
  });
});
