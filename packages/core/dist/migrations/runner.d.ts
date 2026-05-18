/**
 * Baseline migration runner — applies the inlined `schema.ts` migrations
 * idempotently via knex.schema.hasTable/hasColumn guards. Invoked by
 * `npm run db:migrate`.
 *
 * The eight dated 2026-05-11 migrations (learning, sandata, retention,
 * etc.) referenced by an earlier `apply-new-migrations.ts` script live in
 * a separate monorepo and have not been ported into this repo yet. The
 * features that depend on them (Learning Hub, audit retention sweep,
 * agency Sandata config) are tracked as pending engineering work in
 * PROJECT_STATUS.md.
 *
 * Writes status to stderr (not stdout) so the parent shell can pipe stdout
 * for JSON without contamination. No `console.*` calls — keeps `npm run
 * lint` clean and matches the codebase's no-console-in-prod posture.
 */
export {};
//# sourceMappingURL=runner.d.ts.map