import type { Knex } from 'knex';
import { paTasks } from '../config/pa-tasks.js';
import type {
  VisitTaskCompletion,
  VisitTaskCompletionInput,
  VisitTaskPlanItem,
} from '../domain/visit-task-completion.js';

type CompletionRow = {
  id: string;
  agency_id: string;
  visit_id: string;
  caregiver_id: string;
  client_event_id: string;
  task_code: string | null;
  task_label: string;
  status: VisitTaskCompletion['status'];
  recorded_at: Date | string;
  created_at?: Date | string;
  updated_at?: Date | string;
};

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export function normalizeVisitTaskPlan(value: unknown): VisitTaskPlanItem[] {
  const tasks = parseJson(value);
  if (!Array.isArray(tasks)) return [];

  const byDuty = new Map(paTasks.map((task) => [task.duty.toLowerCase(), task]));
  const byCode = new Map(paTasks.map((task) => [task.id, task]));
  const normalized: VisitTaskPlanItem[] = [];
  const seen = new Set<string>();

  for (const raw of tasks) {
    let taskCode: string | undefined;
    let taskLabel: string | undefined;
    if (typeof raw === 'string') {
      taskLabel = raw.trim();
      taskCode = byDuty.get(taskLabel.toLowerCase())?.id;
    } else if (raw && typeof raw === 'object') {
      const record = raw as Record<string, unknown>;
      const code = typeof record.id === 'string'
        ? record.id
        : typeof record.taskCode === 'string'
          ? record.taskCode
          : undefined;
      const label = typeof record.duty === 'string'
        ? record.duty
        : typeof record.label === 'string'
          ? record.label
          : typeof record.taskLabel === 'string'
            ? record.taskLabel
            : undefined;
      taskCode = code && /^\d{3}$/.test(code) ? code : undefined;
      taskLabel = label?.trim() || (taskCode ? byCode.get(taskCode)?.duty : undefined);
    }
    if (!taskLabel) continue;
    const canonical = taskCode ? byCode.get(taskCode) : byDuty.get(taskLabel.toLowerCase());
    const item = {
      taskCode: canonical?.id ?? taskCode,
      taskLabel: canonical?.duty ?? taskLabel,
    };
    const key = `${item.taskCode ?? ''}:${item.taskLabel.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
  }
  return normalized;
}

export class VisitTaskCompletionRepository {
  constructor(private readonly db: Knex) {}

  async getForVisit(
    visitId: string,
    agencyId: string,
  ): Promise<{ plan: VisitTaskPlanItem[]; completions: VisitTaskCompletion[] }> {
    const visit = await this.db('evv_visits as v')
      .join('assignments as a', 'a.id', 'v.assignment_id')
      .join('visit_templates as vt', 'vt.id', 'a.visit_template_id')
      .join('clients as c', 'c.id', 'vt.client_id')
      .where('v.id', visitId)
      .andWhere('c.agency_id', agencyId)
      .select('vt.tasks')
      .first();

    if (!visit) return { plan: [], completions: [] };

    const rows = await this.db<CompletionRow>('visit_task_completions')
      .where({ agency_id: agencyId, visit_id: visitId })
      .orderBy('task_label', 'asc');

    return {
      plan: normalizeVisitTaskPlan(visit.tasks),
      completions: rows.map((row) => this.mapRow(row)),
    };
  }

  async upsertBatch(input: {
    agencyId: string;
    visitId: string;
    caregiverId: string;
    completions: VisitTaskCompletionInput[];
  }): Promise<VisitTaskCompletion[]> {
    return this.db.transaction(async (trx) => {
      const saved: VisitTaskCompletion[] = [];
      for (const completion of input.completions) {
        const replay = await trx<CompletionRow>('visit_task_completions')
          .where({
            agency_id: input.agencyId,
            visit_id: input.visitId,
            caregiver_id: input.caregiverId,
            client_event_id: completion.clientEventId,
          })
          .first();
        if (replay) {
          saved.push(this.mapRow(replay));
          continue;
        }

        const existing = await trx<CompletionRow>('visit_task_completions')
          .where({
            agency_id: input.agencyId,
            visit_id: input.visitId,
            task_label: completion.taskLabel,
          })
          .first();

        let row: CompletionRow;
        if (existing) {
          [row] = await trx<CompletionRow>('visit_task_completions')
            .where({ id: existing.id, agency_id: input.agencyId })
            .update({
              caregiver_id: input.caregiverId,
              client_event_id: completion.clientEventId,
              task_code: completion.taskCode ?? null,
              status: completion.status,
              recorded_at: trx.fn.now(),
              updated_at: trx.fn.now(),
            })
            .returning('*');
        } else {
          [row] = await trx<CompletionRow>('visit_task_completions')
            .insert({
              id: crypto.randomUUID(),
              agency_id: input.agencyId,
              visit_id: input.visitId,
              caregiver_id: input.caregiverId,
              client_event_id: completion.clientEventId,
              task_code: completion.taskCode ?? null,
              task_label: completion.taskLabel,
              status: completion.status,
              recorded_at: trx.fn.now(),
            })
            .returning('*');
        }
        saved.push(this.mapRow(row));
      }
      return saved;
    });
  }

  private mapRow(row: CompletionRow): VisitTaskCompletion {
    return {
      id: row.id,
      visitId: row.visit_id,
      caregiverId: row.caregiver_id,
      clientEventId: row.client_event_id,
      taskCode: row.task_code ?? undefined,
      taskLabel: row.task_label,
      status: row.status,
      recordedAt: row.recorded_at instanceof Date
        ? row.recorded_at.toISOString()
        : new Date(row.recorded_at).toISOString(),
    };
  }
}
