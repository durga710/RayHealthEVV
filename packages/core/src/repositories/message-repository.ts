/**
 * Repository for `message_threads` and `messages`.
 *
 * Tenancy: every method takes an agencyId and filters on it, including the
 * message reads, which is why `messages.agency_id` is denormalized. A
 * caregiver working at two agencies has two separate threads and neither
 * agency can observe the other, preserving the standing cross-agency rule.
 *
 * MESSAGE BODIES ARE PHI. People discuss clients here. Bodies never leave an
 * agency-scoped query and are never copied into a notification payload or an
 * audit payload.
 */

import type { Knex } from 'knex'

export type MessageSender = 'staff' | 'caregiver'

export interface MessageThread {
  id: string
  agencyId: string
  caregiverId: string
  lastMessageAt: string | null
  caregiverReadAt: string | null
  staffReadAt: string | null
}

export interface Message {
  id: string
  threadId: string
  senderType: MessageSender
  senderUserId: string | null
  body: string
  createdAt: string
}

function toIso(value: unknown): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

function mapThread(row: Record<string, unknown>): MessageThread {
  return {
    id: String(row.id),
    agencyId: String(row.agency_id),
    caregiverId: String(row.caregiver_id),
    lastMessageAt: toIso(row.last_message_at),
    caregiverReadAt: toIso(row.caregiver_read_at),
    staffReadAt: toIso(row.staff_read_at),
  }
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    senderType: (row.sender_type as MessageSender) ?? 'staff',
    senderUserId: row.sender_user_id ? String(row.sender_user_id) : null,
    body: String(row.body),
    createdAt: toIso(row.created_at) ?? '',
  }
}

export class MessageRepository {
  constructor(private readonly db: Knex) {}

  /**
   * The thread for one caregiver at one agency, creating it on first use.
   *
   * Idempotent through the (agency_id, caregiver_id) unique constraint, so two
   * concurrent opens cannot produce two threads and split a conversation in
   * half.
   */
  async ensureThread(agencyId: string, caregiverId: string): Promise<MessageThread> {
    const existing = await this.db('message_threads')
      .where({ agency_id: agencyId, caregiver_id: caregiverId })
      .first()
    if (existing) return mapThread(existing as Record<string, unknown>)

    await this.db('message_threads')
      .insert({ agency_id: agencyId, caregiver_id: caregiverId })
      .onConflict(['agency_id', 'caregiver_id'])
      .ignore()

    const row = await this.db('message_threads')
      .where({ agency_id: agencyId, caregiver_id: caregiverId })
      .first()
    return mapThread(row as Record<string, unknown>)
  }

  /**
   * Threads for an agency, most recently active first, for the staff inbox.
   *
   * Unread counts are a second aggregate query rather than a conditional join.
   * The join version has to express "newer than staff_read_at, or all of them
   * when it is null", and a null comparison in SQL quietly yields no rows,
   * which would report zero unread on a thread nobody has ever opened, the
   * exact opposite of the truth.
   */
  async listThreadsForAgency(
    agencyId: string,
    limit = 200,
  ): Promise<Array<MessageThread & { unreadForStaff: number }>> {
    const rows = (await this.db('message_threads')
      .where({ agency_id: agencyId })
      .orderByRaw('last_message_at desc nulls last')
      .limit(Math.min(limit, 500))
      .select('*')) as Record<string, unknown>[]
    if (rows.length === 0) return []

    const threads = rows.map(mapThread)
    const counts = await this.countUnread(
      agencyId,
      threads.map((t) => ({ threadId: t.id, since: t.staffReadAt })),
      'caregiver',
    )
    return threads.map((t) => ({ ...t, unreadForStaff: counts.get(t.id) ?? 0 }))
  }

  /**
   * Unread messages per thread from one side of the conversation.
   *
   * A null `since` means that side has never opened the thread, so every
   * message from the other side counts. Grouped in a single query rather than
   * one per thread so an agency with a hundred caregivers does not pay a
   * hundred round trips to render its inbox.
   */
  private async countUnread(
    agencyId: string,
    threads: Array<{ threadId: string; since: string | null }>,
    senderType: MessageSender,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (threads.length === 0) return counts

    const rows = (await this.db('messages')
      .where({ agency_id: agencyId, sender_type: senderType })
      .whereIn(
        'thread_id',
        threads.map((t) => t.threadId),
      )
      .groupBy('thread_id')
      .select('thread_id')
      .count({ total: '*' })) as Array<{ thread_id: string; total: string | number }>

    // Totals per thread, then subtract what was already seen. Two small
    // queries keep the null-read case correct without conditional SQL.
    const totals = new Map(rows.map((r) => [String(r.thread_id), Number(r.total)]))

    const readThreads = threads.filter((t) => t.since)
    const seenRows = readThreads.length
      ? ((await this.db('messages')
          .where({ agency_id: agencyId, sender_type: senderType })
          .whereIn(
            'thread_id',
            readThreads.map((t) => t.threadId),
          )
          .where((builder) => {
            for (const t of readThreads) {
              void builder.orWhere((inner) => {
                void inner
                  .where('thread_id', t.threadId)
                  .andWhere('created_at', '<=', t.since as string)
              })
            }
          })
          .groupBy('thread_id')
          .select('thread_id')
          .count({ total: '*' })) as Array<{ thread_id: string; total: string | number }>)
      : []
    const seen = new Map(seenRows.map((r) => [String(r.thread_id), Number(r.total)]))

    for (const t of threads) {
      const total = totals.get(t.threadId) ?? 0
      counts.set(t.threadId, Math.max(0, total - (seen.get(t.threadId) ?? 0)))
    }
    return counts
  }

  /** Messages in a thread, oldest first. Tenant-scoped on the message rows. */
  async listMessages(threadId: string, agencyId: string, limit = 200): Promise<Message[]> {
    const rows = await this.db('messages')
      .where({ thread_id: threadId, agency_id: agencyId })
      .orderBy('created_at', 'asc')
      .limit(Math.min(limit, 500))
      .select('*')
    return (rows as Record<string, unknown>[]).map(mapMessage)
  }

  /**
   * Append a message and stamp the thread's activity time in one transaction,
   * so a thread can never show a message it does not list, or list a message
   * without appearing active.
   */
  async postMessage(input: {
    threadId: string
    agencyId: string
    senderType: MessageSender
    senderUserId: string | null
    body: string
  }): Promise<Message> {
    return this.db.transaction(async (trx) => {
      const [row] = await trx('messages')
        .insert({
          thread_id: input.threadId,
          agency_id: input.agencyId,
          sender_type: input.senderType,
          sender_user_id: input.senderUserId,
          body: input.body,
        })
        .returning('*')
      await trx('message_threads')
        .where({ id: input.threadId, agency_id: input.agencyId })
        .update({ last_message_at: trx.fn.now(), updated_at: trx.fn.now() })
      return mapMessage(row as Record<string, unknown>)
    })
  }

  /** Move one side's read high-water mark to now. */
  async markRead(threadId: string, agencyId: string, side: MessageSender): Promise<void> {
    const column = side === 'caregiver' ? 'caregiver_read_at' : 'staff_read_at'
    await this.db('message_threads')
      .where({ id: threadId, agency_id: agencyId })
      .update({ [column]: this.db.fn.now(), updated_at: this.db.fn.now() })
  }

  /** Count of messages the caregiver has not seen, for the mobile badge. */
  async unreadForCaregiver(caregiverId: string, agencyId: string): Promise<number> {
    const thread = await this.db('message_threads')
      .where({ agency_id: agencyId, caregiver_id: caregiverId })
      .first()
    if (!thread) return 0
    const row = thread as Record<string, unknown>
    let q = this.db('messages')
      .where({ thread_id: String(row.id), agency_id: agencyId, sender_type: 'staff' })
    if (row.caregiver_read_at) q = q.andWhere('created_at', '>', row.caregiver_read_at as string)
    const result = (await q.count({ count: '*' }).first()) as { count?: string | number } | undefined
    return Number(result?.count ?? 0)
  }
}
