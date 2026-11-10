/**
 * Saved fee schedules: the usual fees of one class level (JSS 1, SS 3...) for one term.
 * A schedule is only a starting point. Using it copies the items into an invoice, so changing
 * a schedule later never changes an invoice that was already sent.
 */
import { invoiceTotal } from '@classbridge/shared';
import { withTransaction } from '../db/tx.js';

export class FeeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function listSchedules(db) {
  const { rows } = await db.query('SELECT id, level, term, title, updated_at FROM fee_schedules ORDER BY level, term');
  if (!rows.length) return [];
  const items = (
    await db.query('SELECT schedule_id, name, amount FROM fee_schedule_items ORDER BY schedule_id, position')
  ).rows;
  return rows.map((r) => {
    const mine = items.filter((i) => i.schedule_id === r.id).map((i) => ({ name: i.name, amount: i.amount }));
    return {
      id: r.id,
      level: r.level,
      term: r.term,
      title: r.title,
      updatedAt: r.updated_at,
      items: mine,
      total: invoiceTotal({ items: mine }),
    };
  });
}

/** Create or replace the schedule for a level and term. */
export async function saveSchedule(db, input, staffId) {
  const id = await withTransaction(db, async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO fee_schedules (level, term, title, updated_by, updated_at) VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (level, term) DO UPDATE SET title = EXCLUDED.title, updated_by = EXCLUDED.updated_by, updated_at = now() RETURNING id`,
      [input.level, input.term, input.title, staffId],
    );
    const sid = rows[0].id;
    await tx.query('DELETE FROM fee_schedule_items WHERE schedule_id = $1', [sid]);
    for (const [position, item] of input.items.entries())
      await tx.query('INSERT INTO fee_schedule_items (schedule_id, position, name, amount) VALUES ($1, $2, $3, $4)', [
        sid,
        position,
        item.name,
        item.amount,
      ]);
    return sid;
  });
  return (await listSchedules(db)).find((s) => s.id === id);
}

export async function deleteSchedule(db, id) {
  const { rowCount } = await db.query('DELETE FROM fee_schedules WHERE id = $1', [id]);
  if (!rowCount) throw new FeeError('We could not find that schedule.', 404);
}
