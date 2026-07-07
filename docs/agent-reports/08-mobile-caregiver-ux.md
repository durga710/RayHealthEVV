# Agent 08 — Mobile Caregiver UX

**Authored by Durga Ghimeray**

---

Scope: make the Expo/React Native caregiver app faster, clearer, and more
trustworthy on the two screens that make or break adoption — the Today dashboard
and the clock-in/clock-out flow — **without touching EVV/geofence logic or the
clock state machine.** All work reuses the mobile design tokens
(`src/features/common/tokens.ts`) and shared components; no web primitives, no
new dependencies, no hardcoded colors outside the token/alpha system.

## Files changed

- `packages/mobile/src/features/evv/DashboardScreen.tsx` — dashboard UX.
- `packages/mobile/src/features/evv/ClockInScreen.tsx` — clock-in copy/UX + completion actions.
- `packages/mobile/src/lib/evv-location.ts` — extracted pure clock-out location resolver (new).
- `packages/mobile/src/lib/evv-location.test.ts` — tests for the weak-GPS fallback + honesty flag (new).
- `docs/agent-reports/08-mobile-caregiver-ux.md` — this report.

No changes to `src/lib/visit-state.ts`, `src/lib/geofence.ts`, their tests, the
clock-in/clock-out network calls, or any threshold.

### EVV clock-out hardening (test coverage)

Per Agent 00 #4 (mobile EVV hardening), the weak-GPS clock-out decision — which
was previously inline in `handleClockOut` — was extracted, **behavior-preserving**,
into a pure `resolveClockOutLocation(live, lastKnown)` helper and covered by
tests. It encodes the two guarantees the caregiver relies on: (1) clock-out is
never blocked (zeroed payload fallback when no coordinate exists), and (2) the
`captured` flag — which drives the GPS-honesty completion badge — is true only
when a real live or last-known coordinate backed the payload. The screen now
calls this helper instead of open-coding the same logic, so the always-able-to-
clock-out fallback and the honesty badge are identical at runtime but now
regression-tested.

---

## Dashboard changes (`DashboardScreen.tsx`)

- **Next-visit hero card (`NextVisitHero`).** A single prominent card surfaces
  the one thing that matters next: an in-progress visit first, otherwise the
  soonest not-yet-completed visit (`pickHeroVisit`). It carries the client name,
  time, address, a route-preview slot, and one unmistakable primary action.
- **Live shift countdown / elapsed clock.** A 1-second tick (`nowTs`, gated so
  it only runs when there are visits) drives a "Starts in 2h 05m" countdown
  before the shift and a running "Elapsed" clock once the caregiver is clocked
  in. `formatCountdown` / `formatElapsed` are pure local helpers.
- **Clearer "tap to clock in / clock out" affordance.** The hero CTA reads
  "Tap to clock in" or "Tap to clock out" with a matching icon and arrow, tinted
  by state (brand gradient for upcoming, success gradient for in-progress). The
  existing per-visit cards keep their `tapHint` line.
- **Clearer timeline + status badges.** Existing per-card badges (Now / In
  progress / Completed / Done) are preserved; the hero adds an eyebrow label
  ("Up next · starting soon", "Visit in progress") so the list reads as a
  timeline anchored by the next action. A `doneCount` feeds an `AllDoneHero`
  "you're all caught up" state when every visit is complete.
- **Route preview placeholder.** A structured, clearly-labelled slot ("Route
  preview") inside the hero — **not a faked live route**. It states whether the
  client has coordinates and that the live map opens on the clock-in screen. A
  real map here is a follow-up (see below).
- **Quick help button.** A "Help" pill in the header routes to `/help`, and the
  improved empty state carries a secondary "Something look wrong? Get help"
  button — both wired to the existing Help route.
- **Better empty state.** Still reuses the shared `EmptyState`, with warmer,
  more actionable copy ("pull down to refresh") plus the help affordance.
- **Navigation dedup.** Hero and per-visit cards now share one `openVisit`
  helper so their `/clockin` params can never drift.

### Offline / connectivity banner — deliberately NOT faked

The brief says to add an offline banner **only if real connectivity
infrastructure already exists.** It does not: there is no `@react-native-community/netinfo`
dependency and no connectivity provider in `src/lib`. Per the honesty
non-negotiables (Agent 00 §2.4 / §9.3 — do not advertise offline behavior until
verified), **no offline banner was added.** It is logged as a follow-up rather
than mocked. The app already surfaces genuine load failures via `ErrorRetry`.

---

## Clock-In changes (`ClockInScreen.tsx`) — copy/UX only

**Preserved intact (no logic touched):** the live geofence `MapView` with the
radar ping, GPS accuracy readout, distance status, `haversineM` distance math,
the server-authoritative geofence (client is UX-only), permission recovery
(Retry / Open Settings), all haptics, the clock-in POST, the clock-out POST, and
the clock-out fallback that uses last-known / zeroed location so **a caregiver
with weak or denied GPS can always end a shift** (`canClockOut` is intentionally
NOT gated on a live fix — unchanged).

**GPS-honesty fix preserved.** The `completed.locationCaptured` flag and the
completion badge that only claims "GPS verified · EVV recorded" when a real
coordinate was captured (else "EVV recorded · location not captured" with an
alert icon) are **untouched**. The new "View visit summary" action deliberately
passes `status: 'pending'` — it does not fabricate a "verified" status the
client can't know, consistent with that same honesty principle.

**Copy/UX improvements:**

- **Permission-denied copy.** Rewritten to explain *why* location is needed for
  clock-in, that it is used only at clock-in/out (not between visits), and to
  guide the caregiver to enable + Retry.
- **Geofence explanation.** The EVV note now explains that presence is confirmed
  within the radius, that the check runs on the server, and that the on-screen
  map is only a guide.
- **Clock-in button clarity + "move closer" state.** Button labels
  ("Acquiring location…" / "Move closer to clock in" / "Clock In") are kept, and
  a new plain-language `statusHint` block sits above the button: outside → "You're
  240 m away. Clock In turns on once you're within 150 m of {client}"; inside →
  "You're inside the client's zone — you're good to clock in"; acquiring → a
  spinner + "Finding your location…". The hint is hidden once clocked in (so it
  never contradicts the always-available Clock Out) and when the server geofence
  banner is already showing.
- **Completion actions.** The single "Done" button is replaced with two:
  **"Return to today's visits"** (`router.back()` → dashboard) and **"View visit
  summary"** (`router.replace` to the existing `/visit-detail` screen with the
  visit's real times/service). No visit-summary route was invented — it reuses
  the visit-detail screen that already exists.

---

## Accessibility notes

- All new interactive elements are `accessibilityRole="button"` with descriptive
  `accessibilityLabel`s (the hero label reads the eyebrow, client, timing, and
  action). Large tap targets: hero CTA 50 px tall, completion buttons 52–54 px,
  help pills with `hitSlop`.
- Text uses the token type scale; status colors come from semantic tokens
  (`amber*` / `success*`) which carry sufficient contrast on their tinted
  backgrounds. No raw hex added outside the existing on-gradient white-alpha
  convention already used across the header styles.

---

## Structured placeholders & follow-ups

1. **Route preview → real map.** The hero slot is a labelled placeholder. A
   future follow-up can render a lightweight static route/map, but only via the
   already-present `react-native-maps` (no new heavy dependency) and without
   implying live turn-by-turn.
2. **Offline banner.** Requires adding a connectivity source (e.g. NetInfo) and
   verifying real offline clock-in behavior before any in-app offline claim.
   Not built, per the honesty rule.

---

## Verification (run from repo root)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/mobile/tsconfig.json` | **PASS** (exit 0) |
| `npm run lint --workspace=@rayhealth/mobile` (`eslint app src`) | **PASS** (exit 0, no warnings) |
| `npm run test --workspace=@rayhealth/mobile` (vitest) | **PASS** — 3 files, 19 tests (`visit-state` 6, `geofence` 8, `evv-location` 5) |

The pre-existing EVV logic tests stayed green; no test files were modified or
deleted. The new `evv-location.test.ts` adds 5 tests around the clock-out
fallback + GPS-honesty flag.
