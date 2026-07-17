import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson, patchJson, deleteJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface RecurringSchedule {
  id: string;
  caregiverId: string;
  caregiverName: string | null;
  visitTemplateId: string;
  templateName: string;
  clientName: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'paused' | 'ended';
}

interface StaffMember { id: string; email: string; role: string; }
interface Template { id: string; clientId: string; name: string; }

interface MaterializeResult {
  created: number;
  skipped: number;
  windowStart: string;
  windowEnd: string;
  schedules?: number;
}

interface CoverageGap {
  scheduleId: string;
  caregiverName: string | null;
  clientName: string;
  templateName: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface CoverageForecast {
  windowStart: string;
  windowEnd: string;
  totalGaps: number;
  gaps: CoverageGap[];
}

const DAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
];

function dowLabel(days: number[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order
    .filter((d) => days.includes(d))
    .map((d) => DAYS.find((x) => x.value === d)?.short)
    .join(', ');
}

const STATUS_COLORS: Record<RecurringSchedule['status'], { bg: string; fg: string }> = {
  active: { bg: 'rgba(16, 116, 128, 0.1)', fg: '#107480' },
  paused: { bg: '#FEF3C7', fg: '#92400E' },
  ended: { bg: '#F1F5F9', fg: '#64748B' },
};

export function RecurringSchedulesPage() {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [caregiverId, setCaregiverId] = useState('');
  const [visitTemplateId, setVisitTemplateId] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [forecast, setForecast] = useState<CoverageForecast | null>(null);

  const loadForecast = useCallback(() => {
    getJson<CoverageForecast>('/api/recurring-schedules/forecast?days=14')
      .then((data) => setForecast(data))
      .catch(() => { /* non-critical advisory */ });
  }, []);

  const loadSchedules = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getJson<RecurringSchedule[]>('/api/recurring-schedules')
      .then((data) => setSchedules(data || []))
      .catch((err: Error) => setLoadError(err.message || 'Failed to load recurring schedules'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSchedules();
    loadForecast();
    getJson<StaffMember[]>('/api/staff')
      .then((data) => setStaff(data || []))
      .catch(() => { /* non-critical */ });
    getJson<Template[]>('/api/templates')
      .then((data) => setTemplates(data || []))
      .catch(() => { /* non-critical */ });
  }, [loadSchedules, loadForecast]);

  const caregivers = staff.filter((s) => s.role === 'caregiver' || s.role === 'coordinator');

  const toggleDay = (value: number) => {
    setDaysOfWeek((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (daysOfWeek.size === 0) {
      setBanner({ kind: 'error', text: 'Select at least one day of the week.' });
      return;
    }
    try {
      const { warnings } = await postJson<{ id: string; warnings?: string[] }>('/api/recurring-schedules', {
        caregiverId,
        visitTemplateId,
        daysOfWeek: Array.from(daysOfWeek),
        startTime,
        endTime,
        startDate,
        endDate,
      });
      setCaregiverId('');
      setVisitTemplateId('');
      setDaysOfWeek(new Set([1, 2, 3, 4, 5]));
      setStartDate('');
      setEndDate('');
      setBanner({
        kind: 'success',
        text:
          warnings && warnings.length > 0
            ? `Recurring schedule created. Review before visits run: ${warnings.join(' ')}`
            : 'Recurring schedule created.',
      });
      loadSchedules();
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to create recurring schedule.' });
    }
  };

  const setStatus = async (id: string, status: RecurringSchedule['status']) => {
    setBusyId(id);
    setBanner(null);
    try {
      await patchJson(`/api/recurring-schedules/${encodeURIComponent(id)}/status`, { status });
      setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to update status.' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setBanner(null);
    try {
      await deleteJson(`/api/recurring-schedules/${encodeURIComponent(id)}`);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      setBanner({ kind: 'success', text: 'Recurring schedule deleted.' });
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to delete.' });
    } finally {
      setBusyId(null);
    }
  };

  const materializeOne = async (id: string) => {
    setBusyId(id);
    setBanner(null);
    try {
      const r = await postJson<MaterializeResult>(
        `/api/recurring-schedules/${encodeURIComponent(id)}/materialize`,
        { days: 14 },
      );
      setBanner({
        kind: 'success',
        text: `Generated ${r.created} visit${r.created === 1 ? '' : 's'} (${r.skipped} already existed) through ${r.windowEnd}.`,
      });
      loadForecast();
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to generate visits.' });
    } finally {
      setBusyId(null);
    }
  };

  const materializeAll = async () => {
    setBusyId('__all__');
    setBanner(null);
    try {
      const r = await postJson<MaterializeResult>('/api/recurring-schedules/materialize', { days: 14 });
      setBanner({
        kind: 'success',
        text: `Generated ${r.created} visit${r.created === 1 ? '' : 's'} across ${r.schedules ?? 0} schedule${r.schedules === 1 ? '' : 's'} (${r.skipped} already existed) through ${r.windowEnd}.`,
      });
      loadForecast();
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to generate visits.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Recurring Schedules</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            Define weekly recurring visit patterns and auto-generate the assignment calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={materializeAll}
          className="btn-primary"
          disabled={busyId === '__all__' || schedules.length === 0}
        >
          {busyId === '__all__' ? 'Generating…' : 'Generate next 14 days'}
        </button>
      </header>

      {banner && (
        <div
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className={`info-banner ${banner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
          style={{ marginBottom: '1rem' }}
        >
          {banner.text}
        </div>
      )}

      {forecast && forecast.totalGaps > 0 && (
        <div
          role="status"
          style={{
            marginBottom: '1rem',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '10px',
            padding: '0.9rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: '12rem' }}>
            <div style={{ fontWeight: 700, color: '#92400E' }}>
              {forecast.totalGaps} upcoming visit{forecast.totalGaps === 1 ? '' : 's'} not yet generated
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#92400E', opacity: 0.9 }}>
              Active recurring patterns have visits in the next 14 days that aren't on the calendar yet, caregivers won't see them until you generate them.
              {' '}
              {forecast.gaps.slice(0, 3).map((g, i) => (
                <span key={`${g.scheduleId}-${g.date}`}>
                  {i > 0 ? '; ' : 'Soonest: '}
                  {g.clientName} on {g.date} {g.startTime}
                </span>
              ))}
              {forecast.totalGaps > 3 ? `; +${forecast.totalGaps - 3} more` : '.'}
            </div>
          </div>
          <button
            type="button"
            onClick={materializeAll}
            className="btn-primary btn-sm"
            disabled={busyId === '__all__'}
          >
            {busyId === '__all__' ? 'Generating…' : 'Generate now'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        <div className="form-card">
          <h3 className="section-title" style={{ margin: '0 0 1.25rem' }}>New recurring schedule</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="rsCaregiver" className="label">Caregiver</label>
              <select id="rsCaregiver" value={caregiverId} onChange={(e) => setCaregiverId(e.target.value)} required className="select-field">
                <option value="">Select a caregiver…</option>
                {caregivers.map((s) => (
                  <option key={s.id} value={s.id}>{s.email} ({s.role})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="rsTemplate" className="label">Visit template</label>
              <select id="rsTemplate" value={visitTemplateId} onChange={(e) => setVisitTemplateId(e.target.value)} required className="select-field">
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label className="label">Days of week</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {DAYS.map((d) => {
                  const on = daysOfWeek.has(d.value);
                  return (
                    <button
                      type="button"
                      key={d.value}
                      onClick={() => toggleDay(d.value)}
                      aria-pressed={on}
                      style={{
                        padding: '0.4rem 0.7rem',
                        borderRadius: '6px',
                        border: `1px solid ${on ? '#107480' : '#E2E8F0'}`,
                        backgroundColor: on ? 'rgba(16, 116, 128, 0.1)' : 'white',
                        color: on ? '#107480' : '#64748B',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                      }}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="rsStart" className="label">Start time</label>
                <input id="rsStart" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="rsEnd" className="label">End time</label>
                <input id="rsEnd" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="input-field" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="rsStartDate" className="label">Start date</label>
                <input id="rsStartDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="rsEndDate" className="label">End date</label>
                <input id="rsEndDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="input-field" />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
              Create schedule
            </button>
          </form>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Active patterns</h3>
            {!loading && !loadError && schedules.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>{schedules.length} total</span>
            )}
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} columns={3} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadSchedules} />
          ) : schedules.length === 0 ? (
            <EmptyState
              title="No recurring schedules yet"
              body="Create a weekly pattern to auto-generate a caregiver's visit calendar instead of booking each visit by hand."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {schedules.map((s) => {
                const sc = STATUS_COLORS[s.status];
                const busy = busyId === s.id;
                return (
                  <div
                    key={s.id}
                    style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.1rem 1.25rem', backgroundColor: 'white' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A' }}>
                          {s.templateName} <span style={{ color: '#94A3B8', fontWeight: 400 }}>· {s.clientName}</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.2rem' }}>
                          {s.caregiverName || s.caregiverId.slice(0, 8) + '…'}, {dowLabel(s.daysOfWeek)} · {s.startTime}-{s.endTime}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.2rem' }}>
                          {s.startDate} → {s.endDate}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          backgroundColor: sc.bg,
                          color: sc.fg,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.9rem' }}>
                      <button type="button" className="btn-ghost btn-sm" disabled={busy || s.status !== 'active'} onClick={() => materializeOne(s.id)}>
                        Generate 14d
                      </button>
                      {s.status === 'active' ? (
                        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus(s.id, 'paused')}>
                          Pause
                        </button>
                      ) : s.status === 'paused' ? (
                        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus(s.id, 'active')}>
                          Resume
                        </button>
                      ) : null}
                      {s.status !== 'ended' && (
                        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus(s.id, 'ended')}>
                          End
                        </button>
                      )}
                      <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => remove(s.id)} style={{ color: '#B91C1C' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
