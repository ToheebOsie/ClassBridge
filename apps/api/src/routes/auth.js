import {
  ROLES,
  actionsFor,
  parentLoginSchema,
  teacherLoginSchema,
  headLoginSchema,
  studentLoginSchema,
  resetRequestSchema,
  resetCompleteSchema,
} from '@classbridge/shared';
import { z } from 'zod';
import { createAuthService } from '../auth/service.js';

const LOGIN_SCHEMAS = {
  parent: parentLoginSchema,
  teacher: teacherLoginSchema,
  head: headLoginSchema,
  student: studentLoginSchema,
};
const COOKIE = 'cb_session';

const readCookie = (header, name) =>
  (header || '')
    .split(';')
    .map((p) => p.trim().split('='))
    .find(([k]) => k === name)?.[1];
const bearer = (header) => ((header || '').startsWith('Bearer ') ? header.slice(7) : undefined);
/** The web app uses the cookie; the future mobile apps send the token as "Authorization: Bearer". */
export const tokenFrom = (req) => bearer(req.headers.authorization) || readCookie(req.headers.cookie, COOKIE);

/**
 * Sign-in for all roles. Returns `requireRole` (to protect other routes) and `routes` (a Fastify plugin).
 *  POST /api/auth/:role/login           role = parent | teacher | head | student
 *  POST /api/auth/logout
 *  GET  /api/me
 *  POST /api/auth/parent/set-password   uses the link from the invitation or reset message (parents and teachers)
 *  POST /api/auth/parent/forgot         emails a reset link (always answers the same)
 *  POST /api/auth/parent/change-password
 * Parents choose their own password through the invitation link. See docs/decisions/0005-parent-sign-in.md.
 */
export function createAuthKit({ resolveDb, limiter, mailer, whatsapp, resetLink, secureCookie = false }) {
  const services = new WeakMap();
  /** One auth service per school database. */
  const authFor = async (req) => {
    const db = await resolveDb(req);
    if (!db) return null;
    if (!services.has(db)) services.set(db, createAuthService({ db, limiter, mailer, whatsapp }));
    return services.get(db);
  };
  const noSchool = (reply) => reply.code(404).send({ error: 'We could not find that school.' });

  /** Fastify preHandler: `{ preHandler: app.requireRole('head') }`. No roles listed = any signed-in user. */
  const requireRole =
    (...roles) =>
    async (req, reply) => {
      const auth = await authFor(req);
      if (!auth) return noSchool(reply);
      const user = await auth.resolveSession(tokenFrom(req));
      if (!user) return reply.code(401).send({ error: 'Please sign in.' });
      if (roles.length && !roles.includes(user.role))
        return reply.code(403).send({ error: 'You do not have access to this.' });
      req.user = user;
    };

  /** Sending the invitation is done by the onboarding feature, through this. */
  const inviteGuardian = async (req, guardianId, options) =>
    (await authFor(req)).inviteGuardian(guardianId, resetLink, options);

  /** Teachers are invited by email to choose their own password. */
  const inviteStaff = async (req, staffId) => (await authFor(req)).inviteStaff(staffId, resetLink);
  const endSessions = async (req, role, id) => (await authFor(req)).endAllSessions(role, id);

  async function routes(app) {
    app.post('/api/auth/:role/login', async (req, reply) => {
      const { role } = req.params;
      if (!ROLES.includes(role)) return reply.code(404).send({ error: 'Unknown sign-in page.' });
      const parsed = LOGIN_SCHEMAS[role].safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Please fill in every field.' });
      const auth = await authFor(req);
      if (!auth) return noSchool(reply);
      const res = await auth.login(role, parsed.data, req.ip);
      if (!res.ok) return reply.code(res.retryAfterSeconds ? 429 : 401).send({ error: res.message });
      reply.header(
        'Set-Cookie',
        `${COOKIE}=${res.token}; HttpOnly; SameSite=Strict; Path=/; Expires=${res.expires.toUTCString()}${secureCookie ? '; Secure' : ''}`,
      );
      return { user: res.user, ...(req.headers['x-client'] === 'mobile' ? { token: res.token } : {}) };
    });

    app.post('/api/auth/logout', async (req, reply) => {
      const auth = await authFor(req);
      if (auth) await auth.logout(tokenFrom(req));
      reply.header('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
      return { ok: true };
    });

    app.get('/api/me', { preHandler: requireRole() }, async (req) => ({
      user: req.user,
      can: actionsFor(req.user.role),
    }));

    app.post('/api/auth/parent/forgot', async (req) => {
      const parsed = resetRequestSchema.safeParse(req.body);
      const auth = await authFor(req);
      if (parsed.success && auth) await auth.requestReset(parsed.data.phone, resetLink);
      return { ok: true, message: 'If that number has an email on file, we have sent a link to it.' };
    });

    app.post('/api/auth/parent/set-password', async (req, reply) => {
      const parsed = resetCompleteSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
      const auth = await authFor(req);
      if (!auth) return noSchool(reply);
      const res = await auth.setPasswordWithToken(parsed.data.token, parsed.data.password);
      return res.ok ? { ok: true, role: res.role } : reply.code(400).send({ error: res.message });
    });

    app.post('/api/auth/parent/change-password', { preHandler: requireRole('parent') }, async (req, reply) => {
      const parsed = z
        .object({ current: z.string().min(1), password: z.string().min(8, 'Use at least 8 characters') })
        .safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
      const res = await (await authFor(req)).changePassword(req.user.id, parsed.data.current, parsed.data.password);
      return res.ok ? { ok: true } : reply.code(400).send({ error: res.message });
    });
  }

  return { requireRole, routes, inviteGuardian, inviteStaff, endSessions };
}
