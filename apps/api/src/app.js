import Fastify from 'fastify';
import { createLimiter } from './auth/limiter.js';
import { createAuthKit } from './routes/auth.js';
import feeRoutes from './routes/fees.js';
import invoiceRoutes from './routes/invoices.js';
import peopleRoutes from './routes/people.js';
import { createMemoryStorage } from './storage/local.js';
import studentRoutes from './routes/students.js';
import healthRoutes from './routes/health.js';
import metaRoutes from './routes/meta.js';

/**
 * Build the API without starting it, so tests can call it directly.
 * Add new route files here (one file per feature) and document them in docs/architecture.md.
 *
 * @param {import('fastify').FastifyServerOptions & {
 *   resolveDb?: (req: import('fastify').FastifyRequest) => Promise<{ query: Function } | null>,
 *   mailer?: { send(message: { to: string, subject: string, text: string }): Promise<void> },
 *   whatsapp?: { send(message: { to: string, text: string }): Promise<void> },
 *   storage?: { put(key: string, buffer: Buffer): Promise<void>, get(key: string): Promise<Buffer | null> },
 *   limiter?: { account: ReturnType<typeof createLimiter>, ip: ReturnType<typeof createLimiter> },
 *   resetLink?: (token: string) => string,
 *   secureCookie?: boolean,
 * }} [options]
 */
export function buildApp({
  resolveDb,
  mailer,
  whatsapp,
  storage = createMemoryStorage(),
  limiter = { account: createLimiter(), ip: createLimiter({ max: 50 }) },
  resetLink = (t) => `/set-password?token=${t}`,
  secureCookie,
  ...fastifyOptions
} = {}) {
  const app = Fastify(fastifyOptions);
  app.register(healthRoutes);
  app.register(metaRoutes);
  if (resolveDb) {
    // Created here (not in a plugin) so routes can use app.requireRole(...) straight away.
    const kit = createAuthKit({ resolveDb, limiter, mailer, whatsapp, resetLink, secureCookie });
    app.decorate('requireRole', kit.requireRole);
    app.decorate('inviteGuardian', kit.inviteGuardian);
    app.register(kit.routes);
    app.register(studentRoutes, { resolveDb, kit });
    app.register(peopleRoutes, { resolveDb, kit });
    app.register(feeRoutes, { resolveDb });
    app.register(invoiceRoutes, { resolveDb, storage, whatsapp });
  }
  return app;
}
