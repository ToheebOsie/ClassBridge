import {
  invoiceCreateSchema,
  invoiceEditSchema,
  paymentConfirmSchema,
  paymentRejectSchema,
  paymentSubmissionSchema,
} from '@classbridge/shared';
import { z } from 'zod';
import { typeForExt } from '../invoices/images.js';
import {
  InvoiceError,
  allReceipts,
  classRecipients,
  confirmPayment,
  createInvoices,
  editInvoice,
  guardianPhones,
  invoicesForGuardian,
  loadInvoices,
  markInvoicesSeen,
  markReceiptsSeen,
  naira,
  paymentScreenshot,
  pendingPayments,
  previewReceipt,
  receiptsForGuardian,
  rejectPayment,
  submitPayment,
} from '../invoices/service.js';

/**
 * Invoices, payments and receipts.
 *
 * Head:   POST /api/invoices/preview          who a class invoice would reach
 *         POST /api/invoices                  create (one student, or whole classes)
 *         GET  /api/invoices                  all invoices (?batchId=)
 *         PUT  /api/invoices/:id              edit (applyToBatch: change the whole class batch)
 *         GET  /api/payments/pending          payments waiting for confirmation
 *         POST /api/payments/:id/preview      step 1: the exact receipt, nothing sent
 *         POST /api/payments/:id/confirm      step 2: confirm and send the receipt (safe to repeat)
 *         POST /api/payments/:id/reject       send back with a reason
 *         GET  /api/receipts/all              every receipt
 * Parent: GET  /api/my/invoices, POST /api/my/invoices/seen
 *         POST /api/my/invoices/:id/payments  report a payment with its screenshot
 *         GET  /api/my/receipts, POST /api/my/receipts/seen
 * Both:   GET  /api/payments/:id/screenshot   head, or the parent who sent it
 */
export default async function invoiceRoutes(app, { resolveDb, storage, whatsapp }) {
  const head = { preHandler: app.requireRole('head') };
  const parent = { preHandler: app.requireRole('parent') };

  /** A failed WhatsApp message must never undo or fail the action it announces. */
  const tell = async (db, studentId, text) => {
    if (!whatsapp) return;
    try {
      for (const to of await guardianPhones(db, studentId)) await whatsapp.send({ to, text });
    } catch (err) {
      app.log.warn({ err }, 'whatsapp failed');
    }
  };
  const bad = (reply, parsed) =>
    reply.code(400).send({ error: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join('.') });
  /** Turn a business-rule error into a clean reply. */
  const guard = (fn) => async (req, reply) => {
    try {
      return await fn(req, reply);
    } catch (err) {
      if (err instanceof InvoiceError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  };
  const idParam = z.string().uuid();

  /* ---- head ---- */
  app.post(
    '/api/invoices/preview',
    head,
    guard(async (req, reply) => {
      const parsed = invoiceCreateSchema.safeParse({ ...req.body, mode: 'class' });
      if (!parsed.success) return bad(reply, parsed);
      return classRecipients(await resolveDb(req), parsed.data);
    }),
  );

  app.post(
    '/api/invoices',
    head,
    guard(async (req, reply) => {
      const parsed = invoiceCreateSchema.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed);
      const db = await resolveDb(req);
      const out = await createInvoices(db, parsed.data, req.user.id);
      const sent = await loadInvoices(db, { ids: out.created.map((c) => c.id) });
      for (const inv of sent)
        await tell(
          db,
          inv.studentId,
          `New invoice ${inv.number} for ${inv.studentName}: ${naira(inv.total)}, to pay by ${inv.dueDate}. Open ClassBridge to see it and send your payment.`,
        );
      return reply
        .code(201)
        .send({ created: out.created, skippedAlreadyHad: out.skippedAlreadyHad, batchId: out.batchId });
    }),
  );

  app.get('/api/invoices', head, async (req) => ({
    invoices: await loadInvoices(await resolveDb(req), {
      batchId: z.string().uuid().safeParse(req.query.batchId).data,
    }),
  }));

  app.put(
    '/api/invoices/:id',
    head,
    guard(async (req, reply) => {
      if (!idParam.safeParse(req.params.id).success)
        return reply.code(404).send({ error: 'We could not find that invoice.' });
      const parsed = invoiceEditSchema.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed);
      const db = await resolveDb(req);
      const { applyToBatch, ...input } = parsed.data;
      const out = await editInvoice(db, req.params.id, input, { applyToBatch });
      for (const inv of await loadInvoices(db, { ids: out.updatedIds }))
        await tell(
          db,
          inv.studentId,
          `Invoice ${inv.number} for ${inv.studentName} was revised: now ${naira(inv.total)}. Open ClassBridge to see it.`,
        );
      return out;
    }),
  );

  app.get('/api/payments/pending', head, async (req) => ({ pending: await pendingPayments(await resolveDb(req)) }));

  app.post(
    '/api/payments/:id/preview',
    head,
    guard(async (req, reply) => {
      const parsed = paymentConfirmSchema.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed);
      return { receipt: await previewReceipt(await resolveDb(req), req.params.id, parsed.data.amount) };
    }),
  );

  app.post(
    '/api/payments/:id/confirm',
    head,
    guard(async (req, reply) => {
      const parsed = paymentConfirmSchema.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed);
      const db = await resolveDb(req);
      const out = await confirmPayment(db, req.params.id, parsed.data.amount, req.user.id);
      // Only the call that really created the receipt messages the parent, so a repeated click costs nothing.
      if (!out.alreadyConfirmed)
        await tell(
          db,
          out.receipt.studentId,
          `Receipt ${out.receipt.number}: ${naira(out.receipt.paid)} received for ${out.receipt.studentName}. ${out.receipt.balance > 0 ? `Balance: ${naira(out.receipt.balance)}.` : 'Paid in full. Thank you.'}`,
        );
      return reply.code(out.alreadyConfirmed ? 200 : 201).send(out);
    }),
  );

  app.post(
    '/api/payments/:id/reject',
    head,
    guard(async (req, reply) => {
      const parsed = paymentRejectSchema.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed);
      const db = await resolveDb(req);
      const out = await rejectPayment(db, req.params.id, parsed.data.reason, req.user.id);
      await tell(
        db,
        out.studentId,
        `Your payment of ${naira(out.amount)} was not accepted: ${parsed.data.reason} Open ClassBridge to send it again.`,
      );
      return { ok: true };
    }),
  );

  app.get('/api/receipts/all', head, async (req) => ({ receipts: await allReceipts(await resolveDb(req)) }));

  /* ---- parent ---- */
  app.get('/api/my/invoices', parent, async (req) => ({
    invoices: await invoicesForGuardian(await resolveDb(req), req.user.id),
  }));
  app.post('/api/my/invoices/seen', parent, async (req) => {
    await markInvoicesSeen(await resolveDb(req), req.user.id);
    return { ok: true };
  });

  app.post(
    '/api/my/invoices/:id/payments',
    { ...parent, bodyLimit: 8 * 1024 * 1024 },
    guard(async (req, reply) => {
      if (!idParam.safeParse(req.params.id).success)
        return reply.code(404).send({ error: 'We could not find that invoice.' });
      const parsed = paymentSubmissionSchema.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed);
      const out = await submitPayment(await resolveDb(req), storage, {
        guardianId: req.user.id,
        invoiceId: req.params.id,
        input: parsed.data,
      });
      return reply.code(201).send({ id: out.id });
    }),
  );

  app.get('/api/my/receipts', parent, async (req) => ({
    receipts: await receiptsForGuardian(await resolveDb(req), req.user.id),
  }));
  app.post('/api/my/receipts/seen', parent, async (req) => {
    await markReceiptsSeen(await resolveDb(req), req.user.id);
    return { ok: true };
  });

  /* ---- either ---- */
  app.get('/api/payments/:id/screenshot', { preHandler: app.requireRole('head', 'parent') }, async (req, reply) => {
    if (!idParam.safeParse(req.params.id).success) return reply.code(404).send({ error: 'Not found.' });
    const file = await paymentScreenshot(await resolveDb(req), storage, req.params.id, req.user);
    if (!file) return reply.code(404).send({ error: 'Not found.' });
    return reply
      .header('Content-Type', typeForExt(file.ext))
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(file.buffer);
  });
}
