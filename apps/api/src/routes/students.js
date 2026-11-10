import { studentOnboardSchema } from '@classbridge/shared';
import { OnboardError, listStudents, onboardStudent } from '../students/service.js';

/**
 * Head-only student routes.
 *  POST /api/students   onboard a student: issues the Student ID and PIN, creates or links the parent,
 *                       and sends the parent the invitation to choose a password.
 *  GET  /api/students   list students (?status=active|graduated|left)
 */
export default async function studentRoutes(app, { resolveDb, kit }) {
  app.post('/api/students', { preHandler: app.requireRole('head') }, async (req, reply) => {
    const parsed = studentOnboardSchema.safeParse(req.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join('.') });
    const db = await resolveDb(req);
    try {
      const out = await onboardStudent(db, parsed.data);
      // The invitation is sent once, when the parent has no password yet.
      let invitationSent = false;
      if (out.guardian.needsInvitation) invitationSent = (await kit.inviteGuardian(req, out.guardian.id)).sent;
      return reply
        .code(201)
        .send({ student: out.student, pin: out.pin, guardian: { existing: out.guardian.existing }, invitationSent });
    } catch (err) {
      if (err instanceof OnboardError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.get('/api/students', { preHandler: app.requireRole('head') }, async (req) => {
    const status = ['active', 'graduated', 'left'].includes(req.query.status) ? req.query.status : undefined;
    return { students: await listStudents(await resolveDb(req), { status }) };
  });
}
