/**
 * Minimal baseline-only migration runner. For the full set of dated
 * migrations use `packages/core/scripts/apply-new-migrations.ts` instead.
 *
 * Writes status to stderr (not stdout) so the parent shell can pipe stdout
 * for JSON without contamination. No `console.*` calls — keeps `npm run
 * lint` clean and matches the codebase's no-console-in-prod posture.
 */
export {};
//# sourceMappingURL=runner.d.ts.map