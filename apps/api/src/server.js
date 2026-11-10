import { buildApp } from './app.js';
import { config } from './config.js';
import { poolFor } from './db/pool.js';
import { createLocalStorage } from './storage/local.js';

/**
 * Find the school's database from the request: the "x-school" header (set by the web app
 * from the address the school uses), looked up in the registry.
 */
async function resolveDb(req) {
  // The school is the first part of the address (unity.classbridge.ng). Pictures such as payment screenshots
  // are loaded by the browser without custom headers, so the address must be enough. The header and
  // DEFAULT_SCHOOL are for development and the mobile apps.
  const host = String(req.hostname || '').split(':')[0];
  const fromHost = host.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(host) ? host.split('.')[0] : '';
  const slug = String(req.headers['x-school'] || fromHost || process.env.DEFAULT_SCHOOL || '').toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  const { rows } = await poolFor(config.registryDb).query('SELECT db_name FROM schools WHERE slug = $1', [slug]);
  return rows[0] ? poolFor(rows[0].db_name) : null;
}

// Email and WhatsApp sending are not connected yet. For now messages are only logged.
const mailer = {
  async send(m) {
    console.log(`[email to ${m.to}] ${m.subject}: ${m.text}`);
  },
};
const whatsapp = {
  async send(m) {
    console.log(`[whatsapp to ${m.to}] ${m.text}`);
  },
};

const app = buildApp({
  logger: true,
  resolveDb,
  mailer,
  whatsapp,
  storage: createLocalStorage(config.uploadsDir),
  secureCookie: process.env.NODE_ENV === 'production',
});
app.listen({ port: config.port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
