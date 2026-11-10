import { staffCreateSchema, staffUpdateSchema } from '@classbridge/shared';
import { z } from 'zod';
import { listGuardians } from '../guardians/service.js';
import { StaffError, createTeacher, listTeachers, setTeacherRemoved, updateTeacher } from '../staff/service.js';

/**
 * Head-only: teachers, and parents' invitations.
 *  GET  /api/staff                    teachers (invited, active, removed)
 *  POST /api/staff                    add a teacher and email them a link to choose a password
 *  PUT  /api/staff/:id                change name, form class, subjects
 *  POST /api/staff/:id/invitation     send a new link (first invitation again, or a forgotten password)
 *  POST /api/staff/:id/remove         remove: cannot sign in, open sessions end at once
 *  POST /api/staff/:id/restore
 *  GET  /api/guardians                parents with their children and invitation status
 *  POST /api/guardians/:id/invitation resend the parent's invitation (waits 10 minutes between sends)
 */
export default async function peopleRoutes(app, { resolveDb, kit }) {
  const head = { preHandler: app.requireRole('head') };
  const id = z.string().uuid();
  const bad = (reply, parsed) =>
    reply.code(400).send({ error: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join('.') });
  const guard = (fn) => async (req, reply) => {
    try {
      return await fn(req, reply);
    } catch (err) {
      if (err instanceof StaffError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  };
  const idOk = (req, reply) =>
    id.safeParse(req.params.id).success || (reply.code(404).send({ error: 'Not found.' }), false);

  app.get('/api/staff', head, async (req) => ({ teachers: await listTeachers(await resolveDb(req)) }));

  app.post(
    '/api/staff',
    head,
    guard(async (req, reply) => {
      const parsed = staffCreateSchema.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed);
      const teacher = await createTeacher(await resolveDb(req), parsed.data);
      const inv = await kit.inviteStaff(req, teacher.id);
      return reply.code(201).send({ teacher, invitationSent: Boolean(inv.sent) });
    }),
  );

  app.put(
    '/api/staff/:id',
    head,
    guard(async (req, reply) => {
      if (!idOk(req, reply)) return;
      const parsed = staffUpdateSchema.safeParse(req.body);
      if (!parsed.success) return bad(reply, parsed);
      return { teacher: await updateTeacher(await resolveDb(req), req.params.id, parsed.data) };
    }),
  );

  app.post(
    '/api/staff/:id/invitation',
    head,
    guard(async (req, reply) => {
      if (!idOk(req, reply)) return;
      const out = await kit.inviteStaff(req, req.params.id);
      if (out.tooSoon) return reply.code(429).send({ error: out.message });
      if (!out.ok) return reply.code(out.message?.includes('find') ? 404 : 409).send({ error: out.message });
      return { ok: true };
    }),
  );

  for (const [action, removed] of [
    ['remove', true],
    ['restore', false],
  ]) {
    app.post(
      `/api/staff/:id/${action}`,
      head,
      guard(async (req, reply) => {
        if (!idOk(req, reply)) return;
        const teacher = await setTeacherRemoved(await resolveDb(req), req.params.id, removed);
        if (removed) await kit.endSessions(req, 'teacher', req.params.id);
        return { teacher };
      }),
    );
  }

  app.get('/api/guardians', head, async (req) => ({ guardians: await listGuardians(await resolveDb(req)) }));

  app.post('/api/guardians/:id/invitation', head, async (req, reply) => {
    if (!idOk(req, reply)) return;
    const out = await kit.inviteGuardian(req, req.params.id, { force: true });
    if (out.tooSoon) return reply.code(429).send({ error: out.message });
    if (!out.ok) return reply.code(404).send({ error: out.message });
    return { ok: true };
  });
}
