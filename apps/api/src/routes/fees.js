import { feeScheduleSchema } from '@classbridge/shared';
import { z } from 'zod';
import { FeeError, deleteSchedule, listSchedules, saveSchedule } from '../fees/service.js';

/**
 * Saved fee schedules (head only): the usual fees per class level and term.
 *  GET    /api/fee-schedules
 *  PUT    /api/fee-schedules       create or replace the schedule for one level and term
 *  DELETE /api/fee-schedules/:id
 */
export default async function feeRoutes(app, { resolveDb }) {
  const head = { preHandler: app.requireRole('head') };
  app.get('/api/fee-schedules', head, async (req) => ({ schedules: await listSchedules(await resolveDb(req)) }));
  app.put('/api/fee-schedules', head, async (req, reply) => {
    const parsed = feeScheduleSchema.safeParse(req.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join('.') });
    return { schedule: await saveSchedule(await resolveDb(req), parsed.data, req.user.id) };
  });
  app.delete('/api/fee-schedules/:id', head, async (req, reply) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(404).send({ error: 'Not found.' });
    try {
      await deleteSchedule(await resolveDb(req), req.params.id);
      return { ok: true };
    } catch (err) {
      if (err instanceof FeeError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });
}
