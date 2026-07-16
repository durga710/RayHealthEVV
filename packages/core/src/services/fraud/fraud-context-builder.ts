/**
 * Assembles a `VisitFeatureContext` for the pure fraud engine from data
 * RayHealthEVV already stores. This is the one place that touches the database;
 * the detectors themselves stay pure. Everything is tenant-scoped by agency via
 * the `users.agency_id` join (visits carry no agency column of their own).
 */
import type { Knex } from 'knex';
import { EvvRepository } from '../../repositories/evv-repository.js';
import { ClientRepository } from '../../repositories/client-repository.js';
import type { EvvVisit } from '../../domain/evv.js';
import { DEFAULT_FRAUD_CONFIG, type FraudConfig, type FraudLocation, type VisitFeatureContext } from './types.js';

/** How far on either side of the visit to pull sibling visits for the history signals. */
const HISTORY_WINDOW_MS = 36 * 3_600_000;
/** Most completed visits of a service code to sample for the duration baseline. */
const BASELINE_SAMPLE_LIMIT = 500;
/** Minimum samples before a duration baseline is trustworthy enough to z-score against. */
const BASELINE_MIN_SAMPLES = 5;

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function toFraudLocation(loc: EvvVisit['clockInLocation'] | undefined | null): FraudLocation | null {
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
  return { lat: loc.lat, lng: loc.lng };
}

export class FraudContextBuilder {
  private readonly evv: EvvRepository;
  private readonly clients: ClientRepository;

  constructor(
    private readonly db: Knex,
    private readonly config: FraudConfig = DEFAULT_FRAUD_CONFIG,
  ) {
    this.evv = new EvvRepository(db);
    this.clients = new ClientRepository(db);
  }

  /** Build the context for one visit, or null if the visit isn't in this agency. */
  async build(visitId: string, agencyId: string): Promise<VisitFeatureContext | null> {
    const visit = await this.evv.getVisitByIdForAgency(visitId, agencyId);
    if (!visit) return null;

    const clockInAtMs = toMs(visit.clockInTime);

    const [authorization, caregiverRecentVisits, clientRecentVisits, durationBaseline] =
      await Promise.all([
        this.loadAuthorization(visit.clientId, agencyId),
        this.loadCaregiverRecentVisits(visit.caregiverId, agencyId, clockInAtMs, visitId),
        this.loadClientRecentVisits(visit.clientId, agencyId, clockInAtMs, visitId),
        this.loadDurationBaseline(visit.serviceCode ?? null, agencyId),
      ]);

    return {
      visit: {
        id: visit.id ?? visitId,
        caregiverId: visit.caregiverId,
        clientId: visit.clientId ?? null,
        serviceCode: visit.serviceCode ?? null,
        clockInAtMs,
        clockOutAtMs: toMs(visit.clockOutTime),
        clockInLocation: toFraudLocation(visit.clockInLocation),
      },
      authorization,
      caregiverRecentVisits,
      clientRecentVisits,
      durationBaseline,
      config: this.config,
    };
  }

  private async loadAuthorization(
    clientId: string | undefined,
    agencyId: string,
  ): Promise<VisitFeatureContext['authorization']> {
    if (!clientId) return null;
    const geo = await this.clients.getClientGeofence(clientId, agencyId);
    if (!geo) return null;
    const location =
      geo.latitude != null && geo.longitude != null ? { lat: geo.latitude, lng: geo.longitude } : null;
    return { location, radiusMeters: geo.geofenceRadiusM ?? 150 };
  }

  private async loadCaregiverRecentVisits(
    caregiverId: string,
    agencyId: string,
    clockInAtMs: number | null,
    excludeVisitId: string,
  ): Promise<VisitFeatureContext['caregiverRecentVisits']> {
    const all = await this.evv.getVisitsForCaregiverInAgency(caregiverId, agencyId);
    return all
      .filter((v) => v.id !== excludeVisitId)
      .map((v) => ({
        id: v.id ?? '',
        clockInAtMs: toMs(v.clockInTime),
        clockInLocation: toFraudLocation(v.clockInLocation),
      }))
      .filter((v) => withinWindow(v.clockInAtMs, clockInAtMs));
  }

  private async loadClientRecentVisits(
    clientId: string | undefined,
    agencyId: string,
    clockInAtMs: number | null,
    excludeVisitId: string,
  ): Promise<VisitFeatureContext['clientRecentVisits']> {
    if (!clientId || clockInAtMs == null) return [];
    const fromIso = new Date(clockInAtMs - HISTORY_WINDOW_MS).toISOString();
    const toIso = new Date(clockInAtMs + HISTORY_WINDOW_MS).toISOString();
    const rows = await this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.client_id', clientId)
      .andWhereNot('v.id', excludeVisitId)
      .andWhereBetween('v.clock_in_time', [fromIso, toIso])
      .select('v.id', 'v.caregiver_id', 'v.clock_in_time')
      .limit(200);
    return rows.map((r) => ({
      id: String(r.id),
      caregiverId: String(r.caregiver_id),
      clockInAtMs: toMs(r.clock_in_time instanceof Date ? r.clock_in_time.toISOString() : r.clock_in_time),
    }));
  }

  private async loadDurationBaseline(
    serviceCode: string | null,
    agencyId: string,
  ): Promise<VisitFeatureContext['durationBaseline']> {
    if (!serviceCode) return null;
    const rows = await this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.service_code', serviceCode)
      .whereNotNull('v.clock_out_time')
      .orderBy('v.clock_in_time', 'desc')
      .select('v.clock_in_time', 'v.clock_out_time')
      .limit(BASELINE_SAMPLE_LIMIT);

    const durations: number[] = [];
    for (const r of rows) {
      const inMs = toMs(r.clock_in_time instanceof Date ? r.clock_in_time.toISOString() : r.clock_in_time);
      const outMs = toMs(r.clock_out_time instanceof Date ? r.clock_out_time.toISOString() : r.clock_out_time);
      if (inMs != null && outMs != null && outMs > inMs) durations.push((outMs - inMs) / 60_000);
    }
    if (durations.length < BASELINE_MIN_SAMPLES) return null;

    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((a, b) => a + (b - mean) ** 2, 0) / durations.length;
    return { meanMinutes: mean, stdMinutes: Math.sqrt(variance) };
  }
}

function withinWindow(candidateMs: number | null, anchorMs: number | null): boolean {
  if (candidateMs == null || anchorMs == null) return true; // keep undated siblings; detectors guard on nulls
  return Math.abs(candidateMs - anchorMs) <= HISTORY_WINDOW_MS;
}
