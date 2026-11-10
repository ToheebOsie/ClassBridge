/**
 * Invoices, class batches, parent payments and receipts.
 * Rules (see docs/decisions/0006-two-step-receipt.md and the PRD "Invoices and payment confirmation"):
 *  - one invoice per student, term, session and title
 *  - a class batch makes a separate invoice for every student, skipping anyone who already has it
 *  - a total can never fall below what is already confirmed as paid
 *  - parents report payments with a screenshot, never more than the open balance
 *  - the head confirms in two steps; a payment produces exactly one receipt, ever
 *  - a sent receipt is a snapshot and never changes
 * Money is whole naira integers. `db` is a pg Pool or PGlite (anything with query()).
 */
import { randomUUID } from 'node:crypto';
import { balance, confirmedTotal, invoiceStatus, invoiceTotal, payableRoom, pendingTotal } from '@classbridge/shared';
import { withTransaction } from '../db/tx.js';
import { decodeImage } from './images.js';

export class InvoiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const naira = (n) => `₦${Math.round(n).toLocaleString('en-NG')}`;
const rowsOf = async (db, sql, params) => (await db.query(sql, params)).rows;
const oneOf = async (db, sql, params) => (await rowsOf(db, sql, params))[0];

/** Next number such as INV-2026-0002. One counter per prefix and year, increased atomically. */
async function nextNumber(tx, prefix) {
  const name = `${prefix}-${new Date().getFullYear()}`;
  const row = await oneOf(
    tx,
    'INSERT INTO counters (name, value) VALUES ($1, 1) ON CONFLICT (name) DO UPDATE SET value = counters.value + 1 RETURNING value',
    [name],
  );
  return `${name}-${String(row.value).padStart(4, '0')}`;
}

/* ------------------------------------------------------------------ reading */

/**
 * Load invoices with their items, payments and worked-out totals.
 * @param {{ ids?: string[], studentIds?: string[], batchId?: string }} [filter]
 */
export async function loadInvoices(db, { ids, studentIds, batchId } = {}) {
  const invs = await rowsOf(
    db,
    `SELECT i.id, i.number, i.student_id, i.batch_id, i.title, i.term, i.session, i.due_date::text AS due_date, i.note, i.revised, i.customised, i.seen_by_parent,
            s.full_name AS student_name, s.current_class, b.label AS batch_label
       FROM invoices i JOIN students s ON s.id = i.student_id LEFT JOIN invoice_batches b ON b.id = i.batch_id
      WHERE ($1::uuid[] IS NULL OR i.id = ANY($1)) AND ($2::text[] IS NULL OR i.student_id = ANY($2)) AND ($3::uuid IS NULL OR i.batch_id = $3)
      ORDER BY i.number DESC`,
    [ids ?? null, studentIds ?? null, batchId ?? null],
  );
  if (!invs.length) return [];
  const idList = invs.map((i) => i.id);
  const items = await rowsOf(
    db,
    'SELECT invoice_id, name, amount FROM invoice_items WHERE invoice_id = ANY($1::uuid[]) ORDER BY position',
    [idList],
  );
  const pays = await rowsOf(
    db,
    `SELECT p.id, p.invoice_id, p.amount, p.paid_on::text AS paid_on, p.method, p.reference, p.note, p.status, p.reject_reason, p.parent_ack, p.created_at, r.number AS receipt_number
       FROM payments p LEFT JOIN receipts r ON r.id = p.receipt_id WHERE p.invoice_id = ANY($1::uuid[]) ORDER BY p.created_at, p.id`,
    [idList],
  );
  return invs.map((i) => {
    const inv = {
      id: i.id,
      number: i.number,
      studentId: i.student_id,
      studentName: i.student_name,
      className: i.current_class,
      title: i.title,
      term: i.term,
      session: i.session,
      dueDate: i.due_date,
      note: i.note,
      revised: i.revised,
      customised: i.customised,
      seenByParent: i.seen_by_parent,
      batchId: i.batch_id,
      batchLabel: i.batch_label,
      items: items.filter((x) => x.invoice_id === i.id).map((x) => ({ name: x.name, amount: x.amount })),
      payments: pays
        .filter((p) => p.invoice_id === i.id)
        .map((p) => ({
          id: p.id,
          amount: p.amount,
          date: p.paid_on,
          method: p.method,
          reference: p.reference,
          note: p.note,
          status: p.status,
          rejectReason: p.reject_reason,
          parentSeen: p.parent_ack,
          receiptNumber: p.receipt_number,
        })),
    };
    return {
      ...inv,
      total: invoiceTotal(inv),
      confirmed: confirmedTotal(inv),
      pending: pendingTotal(inv),
      balance: balance(inv),
      room: payableRoom(inv),
      status: invoiceStatus(inv),
    };
  });
}

/** Students of a guardian. */
const childIds = async (db, guardianId) =>
  (await rowsOf(db, 'SELECT student_id FROM student_guardians WHERE guardian_id = $1', [guardianId])).map(
    (r) => r.student_id,
  );

export async function invoicesForGuardian(db, guardianId) {
  const kids = await childIds(db, guardianId);
  return kids.length ? loadInvoices(db, { studentIds: kids }) : [];
}

/** Opening the Invoices page clears the "new or revised" dot and any unseen rejection. */
export async function markInvoicesSeen(db, guardianId) {
  const kids = await childIds(db, guardianId);
  if (!kids.length) return;
  await db.query('UPDATE invoices SET seen_by_parent = true WHERE student_id = ANY($1::text[])', [kids]);
  await db.query(
    'UPDATE payments SET parent_ack = true WHERE invoice_id IN (SELECT id FROM invoices WHERE student_id = ANY($1::text[]))',
    [kids],
  );
}

/* ------------------------------------------------------------------ creating */

/** Who would get a class invoice. Used for the head's "review and send" screen and when sending. */
export async function classRecipients(db, { classes, term, session, title, skipStudentIds = [] }) {
  const students = await rowsOf(
    db,
    "SELECT id, full_name, current_class FROM students WHERE status = 'active' AND current_class = ANY($1::text[]) ORDER BY current_class, full_name",
    [classes],
  );
  const have = new Set(
    (
      await rowsOf(db, 'SELECT student_id FROM invoices WHERE term = $1 AND session = $2 AND title = $3', [
        term,
        session,
        title,
      ])
    ).map((r) => r.student_id),
  );
  const skip = new Set(skipStudentIds);
  const rows = students.map((s) => ({
    id: s.id,
    name: s.full_name,
    className: s.current_class,
    alreadyHasIt: have.has(s.id),
    leftOut: skip.has(s.id),
  }));
  return { students: rows, willSend: rows.filter((r) => !r.alreadyHasIt && !r.leftOut) };
}

async function insertInvoice(tx, { number, studentId, batchId, input, createdBy }) {
  const inv = await oneOf(
    tx,
    `INSERT INTO invoices (number, student_id, batch_id, title, term, session, due_date, note, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, number`,
    [number, studentId, batchId, input.title, input.term, input.session, input.dueDate, input.note, createdBy],
  );
  for (const [position, item] of input.items.entries()) {
    await tx.query('INSERT INTO invoice_items (invoice_id, position, name, amount) VALUES ($1, $2, $3, $4)', [
      inv.id,
      position,
      item.name,
      item.amount,
    ]);
  }
  return inv;
}

/**
 * Create invoices: one for a student, or one for every student of the chosen classes.
 * @returns {Promise<{ created: { id: string, number: string, studentId: string }[], skippedAlreadyHad: number, batchId: string | null }>}
 */
export async function createInvoices(db, input, createdBy) {
  const result = await withTransaction(db, async (tx) => {
    if (input.mode === 'student') {
      const s = await oneOf(tx, "SELECT id, full_name FROM students WHERE id = $1 AND status = 'active'", [
        input.studentId,
      ]);
      if (!s) throw new InvoiceError('We could not find that student.', 404);
      const dup = await oneOf(
        tx,
        'SELECT number FROM invoices WHERE student_id = $1 AND term = $2 AND session = $3 AND title = $4',
        [s.id, input.term, input.session, input.title],
      );
      if (dup)
        throw new InvoiceError(
          `${s.full_name} already has an invoice called "${input.title}" for ${input.term}, ${input.session} (${dup.number}). Edit that one, or give this one a different title, such as Excursion.`,
          409,
        );
      const inv = await insertInvoice(tx, {
        number: await nextNumber(tx, 'INV'),
        studentId: s.id,
        batchId: null,
        input,
        createdBy,
      });
      return { created: [{ id: inv.id, number: inv.number, studentId: s.id }], skippedAlreadyHad: 0, batchId: null };
    }
    const { students, willSend } = await classRecipients(tx, input);
    if (!students.length) throw new InvoiceError('There are no active students in the chosen classes.', 404);
    if (!willSend.length)
      throw new InvoiceError('Nobody is left to send to. Everyone is left out or already has this invoice.', 409);
    const batch = await oneOf(tx, 'INSERT INTO invoice_batches (label) VALUES ($1) RETURNING id', [
      `${input.classes.join(' + ')} · ${input.title} · ${input.term} ${input.session}`,
    ]);
    const created = [];
    for (const s of willSend) {
      const inv = await insertInvoice(tx, {
        number: await nextNumber(tx, 'INV'),
        studentId: s.id,
        batchId: batch.id,
        input,
        createdBy,
      });
      created.push({ id: inv.id, number: inv.number, studentId: s.id });
    }
    return { created, skippedAlreadyHad: students.filter((s) => s.alreadyHasIt).length, batchId: batch.id };
  });
  return result;
}

/* ------------------------------------------------------------------ editing */

/**
 * Change a sent invoice. `applyToBatch` changes every invoice sent with it, except ones changed on their own,
 * and skips any student who has already paid more than the new total (they are listed in `skipped`).
 */
export async function editInvoice(db, invoiceId, input, { applyToBatch = false } = {}) {
  return withTransaction(db, async (tx) => {
    const inv = await oneOf(tx, 'SELECT id, number, batch_id FROM invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
    if (!inv) throw new InvoiceError('We could not find that invoice.', 404);
    const total = input.items.reduce((s, i) => s + i.amount, 0);
    const confirmedOf = async (id) =>
      (
        await oneOf(
          tx,
          "SELECT COALESCE(SUM(amount), 0)::int AS n FROM payments WHERE invoice_id = $1 AND status = 'confirmed'",
          [id],
        )
      ).n;

    let targets = [inv];
    if (applyToBatch && inv.batch_id)
      targets = await rowsOf(
        tx,
        'SELECT id, number, batch_id FROM invoices WHERE batch_id = $1 AND (id = $2 OR customised = false) ORDER BY number FOR UPDATE',
        [inv.batch_id, inv.id],
      );
    if (!applyToBatch) {
      const paid = await confirmedOf(inv.id);
      if (total < paid) throw new InvoiceError(`The total cannot be lower than the ${naira(paid)} already confirmed.`);
    }
    const updated = [],
      skipped = [];
    for (const t of targets) {
      if (total < (await confirmedOf(t.id))) {
        skipped.push(t.number);
        continue;
      }
      const old = await rowsOf(tx, 'SELECT name, amount FROM invoice_items WHERE invoice_id = $1 ORDER BY position', [
        t.id,
      ]);
      const changed =
        JSON.stringify(old.map((o) => [o.name, o.amount])) !==
        JSON.stringify(input.items.map((o) => [o.name, o.amount]));
      await tx.query(
        'UPDATE invoices SET title = $1, term = $2, session = $3, due_date = $4, note = $5, revised = true, seen_by_parent = false, customised = customised OR $6 WHERE id = $7',
        [
          input.title,
          input.term,
          input.session,
          input.dueDate,
          input.note,
          !applyToBatch && !!t.batch_id && changed,
          t.id,
        ],
      );
      await tx.query('DELETE FROM invoice_items WHERE invoice_id = $1', [t.id]);
      for (const [position, item] of input.items.entries())
        await tx.query('INSERT INTO invoice_items (invoice_id, position, name, amount) VALUES ($1, $2, $3, $4)', [
          t.id,
          position,
          item.name,
          item.amount,
        ]);
      updated.push(t.id);
    }
    if (!updated.length)
      throw new InvoiceError('Nothing was changed: the new total is lower than what has already been confirmed.');
    return { updatedIds: updated, skipped };
  });
}

/* ------------------------------------------------------------------ parent payments */

/**
 * A parent reports a payment, with the screenshot of their payment receipt.
 * @param {import('../storage/local.js').createLocalStorage extends (...a: any) => infer R ? R : never} storage
 */
export async function submitPayment(db, storage, { guardianId, invoiceId, input }) {
  const img = decodeImage(input.screenshot);
  if ('error' in img) throw new InvoiceError(img.error);
  const key = `payments/${randomUUID()}.${img.ext}`;
  const out = await withTransaction(db, async (tx) => {
    // Lock the invoice so two payments sent at the same moment cannot together exceed the balance.
    const inv = await oneOf(tx, 'SELECT id, student_id FROM invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
    const linked =
      inv &&
      (await oneOf(tx, 'SELECT 1 AS x FROM student_guardians WHERE student_id = $1 AND guardian_id = $2', [
        inv.student_id,
        guardianId,
      ]));
    if (!linked) throw new InvoiceError('We could not find that invoice.', 404);
    const [full] = await loadInvoices(tx, { ids: [invoiceId] });
    if (input.amount > full.room) {
      throw new InvoiceError(
        full.room > 0
          ? `That is more than you can still pay. You can send up to ${naira(full.room)}.`
          : 'There is nothing left to pay on this invoice, or all of the balance is already waiting for the school to confirm.',
      );
    }
    const pay = await oneOf(
      tx,
      `INSERT INTO payments (invoice_id, amount, paid_on, method, reference, note, screenshot_key, submitted_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [invoiceId, input.amount, input.date, input.method, input.reference, input.note, key, guardianId],
    );
    return { id: pay.id, studentId: inv.student_id, number: full.number };
  });
  await storage.put(key, img.buffer); // after the database accepted it; an orphan file is harmless, a payment without a file is not
  return out;
}

/** The screenshot of a payment, only for the head or the parent who sent it. */
export async function paymentScreenshot(db, storage, paymentId, viewer) {
  const p = await oneOf(
    db,
    'SELECT p.screenshot_key, i.student_id FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.id = $1',
    [paymentId],
  );
  if (!p) return null;
  if (
    viewer.role === 'parent' &&
    !(await oneOf(db, 'SELECT 1 AS x FROM student_guardians WHERE student_id = $1 AND guardian_id = $2', [
      p.student_id,
      viewer.id,
    ]))
  )
    return null;
  const buffer = await storage.get(p.screenshot_key);
  return buffer ? { buffer, ext: p.screenshot_key.split('.').pop() } : null;
}

/* ------------------------------------------------------------------ head: review, confirm, reject */

/** Payments waiting for the head (oldest first), with the invoice and student. */
export async function pendingPayments(db) {
  const rows = await rowsOf(
    db,
    "SELECT p.id, p.invoice_id FROM payments p WHERE p.status = 'pending' ORDER BY p.created_at, p.id",
    [],
  );
  if (!rows.length) return [];
  const invs = await loadInvoices(db, { ids: [...new Set(rows.map((r) => r.invoice_id))] });
  return rows.map((r) => {
    const inv = invs.find((i) => i.id === r.invoice_id);
    return { payment: inv.payments.find((p) => p.id === r.id), invoice: inv };
  });
}

/** Work out the receipt for a payment at the amount the head says was received. Writes nothing. */
async function draftReceipt(tx, paymentId, amount) {
  const p = await oneOf(
    tx,
    'SELECT id, invoice_id, status, method, reference, paid_on::text AS paid_on FROM payments WHERE id = $1',
    [paymentId],
  );
  if (!p) throw new InvoiceError('We could not find that payment.', 404);
  const [inv] = await loadInvoices(tx, { ids: [p.invoice_id] });
  const confirmedBefore = inv.confirmed; // pending and rejected payments never count
  if (!Number.isInteger(amount) || amount <= 0 || amount > inv.total - confirmedBefore) {
    throw new InvoiceError(
      `The amount received must be between ₦1 and the balance of ${naira(inv.total - confirmedBefore)}.`,
    );
  }
  return {
    payment: p,
    invoice: inv,
    receipt: {
      invoiceNumber: inv.number,
      studentId: inv.studentId,
      studentName: inv.studentName,
      className: inv.className,
      term: inv.term,
      session: inv.session,
      items: inv.items,
      total: inv.total,
      before: confirmedBefore,
      paid: amount,
      balance: inv.total - confirmedBefore - amount,
      method: p.method,
      reference: p.reference,
      paidOn: p.paid_on,
    },
  };
}

/** Step 1 for the head: show exactly what would be sent. Nothing is created and no number is used up. */
export async function previewReceipt(db, paymentId, amount) {
  const { payment, receipt } = await draftReceipt(db, paymentId, amount);
  if (payment.status !== 'pending') throw new InvoiceError('This payment has already been dealt with.', 409);
  return { ...receipt, number: null };
}

/**
 * Step 2: confirm the payment and create its receipt, in one transaction.
 * Safe to repeat: a payment that is already confirmed returns its existing receipt and creates nothing new.
 */
export async function confirmPayment(db, paymentId, amount, staffId) {
  return withTransaction(db, async (tx) => {
    const p = await oneOf(tx, 'SELECT id, status, receipt_id FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);
    if (!p) throw new InvoiceError('We could not find that payment.', 404);
    if (p.status === 'confirmed') return { alreadyConfirmed: true, receipt: await receiptById(tx, p.receipt_id) };
    if (p.status === 'rejected') throw new InvoiceError('This payment was already sent back to the parent.', 409);
    const { invoice, receipt } = await draftReceipt(tx, paymentId, amount);
    const number = await nextNumber(tx, 'RCP');
    const r = await oneOf(
      tx,
      `INSERT INTO receipts (number, invoice_id, student_id, paid, balance_before, balance_after, payment_id, items, total, term, session, method, reference, paid_on, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
      [
        number,
        invoice.id,
        invoice.studentId,
        receipt.paid,
        invoiceTotal(invoice) - receipt.before,
        receipt.balance,
        paymentId,
        JSON.stringify(receipt.items),
        receipt.total,
        receipt.term,
        receipt.session,
        receipt.method,
        receipt.reference,
        receipt.paidOn,
        staffId,
      ],
    );
    await tx.query(
      "UPDATE payments SET status = 'confirmed', amount = $1, receipt_id = $2, decided_by = $3, decided_at = now() WHERE id = $4",
      [amount, r.id, staffId, paymentId],
    );
    return { alreadyConfirmed: false, receipt: await receiptById(tx, r.id) };
  });
}

export async function rejectPayment(db, paymentId, reason, staffId) {
  return withTransaction(db, async (tx) => {
    const p = await oneOf(tx, 'SELECT id, status, amount, invoice_id FROM payments WHERE id = $1 FOR UPDATE', [
      paymentId,
    ]);
    if (!p) throw new InvoiceError('We could not find that payment.', 404);
    if (p.status !== 'pending') throw new InvoiceError('This payment has already been dealt with.', 409);
    await tx.query(
      "UPDATE payments SET status = 'rejected', reject_reason = $1, parent_ack = false, decided_by = $2, decided_at = now() WHERE id = $3",
      [reason, staffId, paymentId],
    );
    const inv = await oneOf(tx, 'SELECT student_id FROM invoices WHERE id = $1', [p.invoice_id]);
    return { studentId: inv.student_id, amount: p.amount };
  });
}

/* ------------------------------------------------------------------ receipts */

const shapeReceipt = (r) => ({
  number: r.number,
  invoiceNumber: r.invoice_number,
  studentId: r.student_id,
  studentName: r.student_name,
  className: r.current_class,
  term: r.term,
  session: r.session,
  items: r.items,
  total: r.total,
  before: r.total - r.balance_before,
  paid: r.paid,
  balance: r.balance_after,
  method: r.method,
  reference: r.reference,
  paidOn: r.paid_on,
  createdAt: r.created_at,
  seenByParent: r.seen_by_parent,
});
const RECEIPT_SELECT = `SELECT r.number, r.student_id, r.term, r.session, r.items, r.total, r.paid, r.balance_before, r.balance_after, r.method, r.reference, r.paid_on::text AS paid_on, r.created_at, r.seen_by_parent,
       i.number AS invoice_number, s.full_name AS student_name, s.current_class FROM receipts r LEFT JOIN invoices i ON i.id = r.invoice_id JOIN students s ON s.id = r.student_id`;
const receiptById = async (db, id) => shapeReceipt(await oneOf(db, `${RECEIPT_SELECT} WHERE r.id = $1`, [id]));

export async function receiptsForGuardian(db, guardianId) {
  const kids = await childIds(db, guardianId);
  if (!kids.length) return [];
  return (
    await rowsOf(db, `${RECEIPT_SELECT} WHERE r.student_id = ANY($1::text[]) ORDER BY r.number DESC`, [kids])
  ).map(shapeReceipt);
}
export async function markReceiptsSeen(db, guardianId) {
  const kids = await childIds(db, guardianId);
  if (kids.length)
    await db.query('UPDATE receipts SET seen_by_parent = true WHERE student_id = ANY($1::text[])', [kids]);
}
export async function allReceipts(db) {
  return (await rowsOf(db, `${RECEIPT_SELECT} ORDER BY r.number DESC`, [])).map(shapeReceipt);
}

/** Who to message about something concerning a student: their guardians' phone numbers. */
export async function guardianPhones(db, studentId) {
  return (
    await rowsOf(
      db,
      'SELECT g.phone FROM guardians g JOIN student_guardians sg ON sg.guardian_id = g.id WHERE sg.student_id = $1',
      [studentId],
    )
  ).map((r) => r.phone);
}
export { naira };
