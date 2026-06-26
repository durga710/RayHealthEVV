# RayHealth EVV — Next steps

Single playbook for everything that's left. Sorted by priority. Strike through each item as you do it.

Last updated: 2026-05-11. Companion to `PROJECT_STATUS.md` (which describes state); this file describes action.

---

## Tier 1 — Urgent (do tonight, 30 minutes total)

### 1. Revoke 4 leaked credentials (10 min, blocks nothing technically but ends a real risk)

Every credential pasted into chat is alive until you click Revoke. Four are pending (their literal values were redacted from this doc on 2026-05-12 — they were sitting committed in the tree which is itself a leak; treat all four as compromised regardless of prior rotation status):

| Credential | Revoke at | Identifier hint |
|---|---|---|
| Atlassian API token | https://id.atlassian.com/manage-profile/security/api-tokens | starts `ATATT3x…` (full value redacted) |
| Bitbucket app password | https://bitbucket.org/account/settings/app-passwords/ | revoke all — Bitbucket is no longer used by this project, no app password should remain |
| Google API key #1 | https://console.cloud.google.com/apis/credentials | suffix redacted |
| Google API key #2 | https://console.cloud.google.com/apis/credentials | suffix redacted |

While you're in Google Cloud Console: check **Billing → Reports** for unexpected usage in the last 24h. Set a budget alert at $50 if you don't have one already — `Billing → Budgets & alerts`.

### 2. Fix marketing/.env placeholders (2 min)

```
open -a TextEdit "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/marketing/.env"
```

Replace the three `REPLACE_ME` strings with real keys. Save (Cmd+S). The key you just generated for Veo 3 goes after `GOOGLE_AI_API_KEY=`.

### 3. Verify Vercel deploy fix (2 min)

```
cd "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"
npx vercel --prod
```

Watch the install step duration. Under 90s = R-05 in the risk analysis flips to CLOSED.

### 4. Smoke test Veo 3 pipeline (2 min, ~$0.60)

```
cd "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/marketing/pipeline"
python3 generate_clips_veo3.py --shot s1-shot3-checkin --model fast
```

If the resulting clip in `marketing/clips/spot1/s1-shot3-checkin.mp4` looks usable, you've validated the pipeline.

---

## Tier 2 — This week (1–4 hours total)

### 5. Full Veo 3 Fast pass + VO generation (~45 min wall-clock, ~$17 total)

```
cd "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/marketing/pipeline"
python3 generate_vo.py
python3 generate_clips_veo3.py --model fast
```

VO finishes in ~2 minutes. Video runs sequentially ~30 minutes. Leave it running while you work on other things.

### 6. Send BAA emails — Google + Resend + Neon + Vercel (~25 min)

Use the templates in `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md`. They're already pre-filled with your name and title. Order:
1. **Google** — self-service in Cloud Console (5 min, instant)
2. **AWS** — already active in Artifact, just verify
3. **Resend** — email `support@resend.com`
4. **Neon** — **send only after Neon HIPAA mode is enabled** — email `support@neon.tech`
5. **Vercel** — email `compliance@vercel.com`. Likely route is Enterprise upgrade; the fallback (move API to AWS) is documented in BAA_REQUEST_EMAILS.md §1.

### 7. Enable Neon HIPAA mode (your action item)

https://console.neon.tech → project `late-art-87716813` → Settings → enable HIPAA mode (requires plan upgrade). Notify the rest of the team in your TodoList once done.

### 8. Sign the HIPAA risk analysis (10 min)

Open `docs/compliance/hipaa/RISK_ANALYSIS_2026.md`. Print or PDF-sign the attestation block (section 7). Store the signed PDF in your password manager / private vault (do not commit). Set a calendar reminder for 2027-05-11 to refresh.

### 9. Bind cyber liability insurance (1–2 hours, ~$1.5–4k/yr)

Get quotes from Hiscox, Coalition, and Embroker. Each has online portals for small healthcare SaaS. Pick the policy with the strongest HIPAA-breach rider and a $1M minimum.

---

## Tier 3 — Before App Store submission (4–8 hours of work, mostly mobile)

### 10. Replace placeholder app icon

In `rayhealth-evv-mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/`:
- Replace every PNG with the corresponding size from `deliverables/app-icon/`
- The 1024×1024 master is `rayhealth-icon-1024.png`
- Xcode 16+ can auto-generate all sizes from the 1024 — drag it into the AppIcon set, choose "Single Size"

### 11. DashboardScreen visit cards refactor (1–2 hours)

In `rayhealth-evv-mobile/src/screens/DashboardScreen.tsx` (or wherever the visit cards live), replace the call to `/evv/visits` with `getTodaysSchedule()` (same hook the Schedule tab already uses). Add countdown per card.

### 12. Clickability audit — VisitDetail / Correction / Notification / Profile (2–3 hours)

For each screen, walk through every tap-able element and confirm:
- The tap target is actually tap-able (no overlapping invisible elements)
- The destination route exists in the router
- The screen doesn't go blank on press

Common root cause from prior sessions: `<TouchableOpacity>` wrapped around content with `pointerEvents="none"` or `flex: 1` on a parent that doesn't cover the area you think it does.

### 13. Real-device E2E smoke (1 hour)

On a real iPhone (not simulator):
1. Install via TestFlight build
2. Log in as fixture caregiver
3. Clock in (geofence check)
4. Open visit detail, request correction, view notifications
5. Clock out
6. Verify all of the above shows up in admin dashboard via web

---

## Tier 4 — Before first paid agency (1–2 weeks)

### 14. Engage HIPAA-aware pen test firm (~$8–15k, 1 week engagement)

Get quotes from at least three. Cobalt, Bishop Fox, NCC Group all do HIPAA. Schedule 4-6 weeks out so they can hit production before first paying agency.

### 15. Cherry-pick this monorepo's code into `rayhealth-evv-platform`

The Sandata mapping module and audit retention sweep live in this monorepo but the actual deploy is `rayhealth-evv-platform`. Either:
- (a) Cherry-pick the commits across, or
- (b) Make this monorepo the deploy source if it isn't already.

Files to move:
- `packages/core/src/services/sandata-mapping.ts`
- `packages/core/src/services/audit-retention-sweep.ts`
- `packages/core/src/migrations/2026-05-11-*.ts` (both new migrations)
- `packages/app/src/routes/audit-retention-routes.ts`
- `packages/app/src/scripts/run-audit-retention-sweep.ts`
- `packages/app/src/app.ts` (wiring)
- `packages/core/src/config/pennsylvania.ts` (capabilities)
- `packages/core/src/index.ts` (re-exports)
- `packages/core/package.json` (bcrypt + zod)

Apply the migrations against the new Neon HIPAA project. Set `CRON_SECRET` env var in Vercel for the audit-retention cron.

### 16. Sandata first-agency onboarding (when you have a pilot agency)

Walk through `docs/sandata-onboarding.md`. Have them register with PA Aggregator, get a Provider ID, enter it in admin UI, map caregivers to External Worker IDs, run a test export. Verify against Sandata portal.

---

## Tier 5 — Stretch / longer-term

### 17. Extract this folder into its own git repo (1 hour, when you have downtime)

Right now `.git` is at `$HOME` which is structurally fragile. Use `git-filter-repo` (already installed):

```
git clone --no-local "$HOME" /tmp/rayhealth-permanent
cd /tmp/rayhealth-permanent
git filter-repo --subdirectory-filter Desktop/rayhealthevv-fresh/rayhealth-fresh
# Move /tmp/rayhealth-permanent over the existing folder once verified
```

After this, the folder has its own `.git`, `gh repo create` works, and pushing to remotes is safe.

### 18. Marketing video assembly in DaVinci Resolve (4–8 hours of editor work)

Per `marketing/README.md` §4. Per-spot timeline structure is:
- Track 1: ElevenLabs VO (master timing)
- Track 2: Veo 3 clips (cut to shot-list timing)
- Track 3: Music bed at -22 LUFS
- Track 4: Logo + brand overlays

Six 30-second masters, then variant exports per channel (16:9 master, 9:16 Reels, audio-only). DaVinci's free tier handles everything.

### 19. Music licensing (~$15)

Artlist / Epidemic Sound single track. Reference tracks in each script's "Music direction" section. Buy one track that fits Spot 1 and use the same composition for spots 2-5 (varied edits) for brand cohesion.

### 20. Localization — Spanish + Mandarin (when scaling beyond pilot)

PA home-care market has strong demand for both languages. Re-generate VO via ElevenLabs in target languages, re-shoot or dub Veo 3 clips, redo captions.

---

## What's currently in flight (no action needed from you tonight)

These are blocked on external timelines, not on you:

- BAA turnaround: 2–10 business days per vendor once requested
- Pen test scheduling: 4–6 weeks lead time
- Neon HIPAA upgrade: ~24 hours after request
- Vercel Enterprise quote: 3–7 business days

You can run the Tier 1 + Tier 2 actions in parallel with all of these.

---

## When in doubt — the one decision tree

```
                Is it tagged URGENT in the visual map?
                ──────────┬────────────────────
                          │
              ┌───────────┴───────────┐
            Yes                       No
              │                       │
              ▼                       ▼
        Do it now.            Is it tagged OWNER?
       (Tier 1 above.)                │
                          ┌───────────┴───────────┐
                        Yes                       No
                          │                       │
                          ▼                       ▼
                    Owner action —        Already done OR
                    Tier 2/3/4 above.     waiting on me — ignore.
```
