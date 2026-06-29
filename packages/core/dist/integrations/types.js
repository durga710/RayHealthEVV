/**
 * Shared types for outbound EVV-aggregator and clearinghouse submission.
 *
 * Every transport returns a discriminated `SubmitResult` so callers can gate
 * honestly: `not_configured` means the agency has not finished integration
 * setup (no endpoint / no credentials / disabled) and must NEVER be conflated
 * with a real submission. A real call yields `ok` with per-item acknowledgments,
 * or `error` with the cause and whether a retry could succeed.
 */
export {};
//# sourceMappingURL=types.js.map