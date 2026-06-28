/**
 * Recurring schedule routes.
 *
 *   GET    /recurring-schedules              — list patterns (with names)
 *   POST   /recurring-schedules              — create a weekly pattern
 *   PATCH  /recurring-schedules/:id/status   — active | paused | ended
 *   DELETE /recurring-schedules/:id          — delete a pattern
 *   POST   /recurring-schedules/:id/materialize  — generate assignments (one)
 *   POST   /recurring-schedules/materialize      — generate for all active
 *
 * Materialization expands a pattern into concrete `assignments` over a rolling
 * horizon (default 14 days, max 90), idempotently — re-running never
 * double-books a date. Reads use schedule.read; every mutation uses
 * schedule.write (admin + coordinator; caregivers excluded).
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=recurring-schedule-routes.d.ts.map