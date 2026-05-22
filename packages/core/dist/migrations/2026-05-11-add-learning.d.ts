/**
 * Migration: Learning Hub — courses, enrollments, completions.
 *
 * Three tables:
 *
 *   learning_courses        — catalog. agency_id NULL = global course shared
 *                             across all agencies (e.g. HIPAA refresh).
 *   course_enrollments      — one row per (caregiver, course). Tracks the
 *                             current state — last completion, expiry.
 *   course_completions      — append-only event log of completion records.
 *
 * Idempotent.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-05-11-add-learning.d.ts.map