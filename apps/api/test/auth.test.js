import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { buildApp } from '../src/app.js';
import { createLimiter } from '../src/auth/limiter.js';
import { hashSecret, verifySecret } from '../src/auth/passwords.js';

const dir = path.resolve(import.meta.dirname, '../migrations/school');
let db, app, mails, texts, clock;
const ids = {};

before(async () => {
  db = new PGlite();
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const h = (s) => hashSecret(s);
  ids.parent = (
    await db.query(
      "INSERT INTO guardians (full_name, phone, email, password_hash) VALUES ('Mrs Okafor', '08035550142', 'okafor@example.com', $1) RETURNING id",
      [await h('Kf7pm2xqzt')],
    )
  ).rows[0].id;
  ids.noEmail = (
    await db.query(
      "INSERT INTO guardians (full_name, phone, password_hash) VALUES ('Mr Bello', '08031112222', $1) RETURNING id",
      [await h('Zz9yy8xx7w')],
    )
  ).rows[0].id;
  ids.teacher = (
    await db.query(
      "INSERT INTO staff (email, full_name, role, status, password_hash) VALUES ('t.adebayo@school.ng', 'Mrs Adebayo', 'teacher', 'active', $1) RETURNING id",
      [await h('teach-pass')],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO staff (email, full_name, role, status, password_hash) VALUES ('gone@school.ng', 'Mr Gone', 'teacher', 'removed', $1)",
    [await h('gone-pass')],
  );
  await db.query(
    "INSERT INTO staff (email, full_name, role, status, password_hash, security_code_hash) VALUES ('head@school.ng', 'Principal', 'head', 'active', $1, $2)",
    [await h('head-pass'), await h('305771')],
  );
  await db.query(
    "INSERT INTO students (id, admission_no, full_name, date_of_birth, enrol_year, enrol_class, current_class, pin_hash) VALUES ('2025-J1A-AO-01', 'A1', 'Adaeze Okafor', '2012-01-01', 2025, 'JSS 1A', 'JSS 1A', $1)",
    [await h('4821')],
  );
  mails = [];
  texts = [];
  clock = { t: Date.now() };
  app = buildApp({
    resolveDb: async (req) => (req.headers['x-school'] === 'unity' ? db : null),
    mailer: {
      send: async (m) => {
        mails.push(m);
      },
    },
    whatsapp: {
      send: async (m) => {
        texts.push(m);
      },
    },
    limiter: { account: createLimiter({ now: () => clock.t }), ip: createLimiter({ max: 50, now: () => clock.t }) },
    resetLink: (t) => `https://x.test/reset?token=${t}`,
  });
  app.get('/api/head-only', { preHandler: app.requireRole('head') }, async () => ({ ok: true }));
});

const post = (url, payload, headers = {}) =>
  app.inject({ method: 'POST', url, payload, headers: { 'x-school': 'unity', ...headers } });
const cookieOf = (res) => res.headers['set-cookie'].split(';')[0];
const get = (url, cookie) => app.inject({ url, headers: { 'x-school': 'unity', ...(cookie ? { cookie } : {}) } });

test('passwords are hashed, verifiable and never stored readable', async () => {
  const hash = await hashSecret('Kf7pm2xqzt');
  assert.match(hash, /^scrypt\$/);
  assert.ok(!hash.includes('Kf7pm2xqzt'));
  assert.equal(await verifySecret('Kf7pm2xqzt', hash), true);
  assert.equal(await verifySecret('wrong', hash), false);
  const stored = (await db.query('SELECT password_hash FROM guardians WHERE phone = $1', ['08035550142'])).rows[0]
    .password_hash;
  assert.ok(stored.startsWith('scrypt$') && !stored.includes('Kf7pm2xqzt'));
});

test('parent signs in with the number written any way, and the cookie is protected', async () => {
  const res = await post('/api/auth/parent/login', { phone: '+234 803 555 0142', password: 'Kf7pm2xqzt' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user.role, 'parent');
  assert.match(res.headers['set-cookie'], /HttpOnly/);
  assert.match(res.headers['set-cookie'], /SameSite=Strict/);
  assert.equal(res.json().token, undefined, 'web response does not expose the token');
  const me = await get('/api/me', cookieOf(res));
  assert.equal(me.json().user.name, 'Mrs Okafor');
  assert.ok(me.json().can.includes('payment.submit') && !me.json().can.includes('payment.confirm'));
});

test('wrong password and unknown number get the same answer', async () => {
  const a = await post('/api/auth/parent/login', { phone: '08035550142', password: 'nope' });
  const b = await post('/api/auth/parent/login', { phone: '08099999999', password: 'nope' });
  assert.equal(a.statusCode, 401);
  assert.deepEqual(a.json(), b.json());
});

test('mobile clients can ask for the token and use it as a bearer token', async () => {
  const res = await post(
    '/api/auth/parent/login',
    { phone: '08035550142', password: 'Kf7pm2xqzt' },
    { 'x-client': 'mobile' },
  );
  const me = await app.inject({
    url: '/api/me',
    headers: { 'x-school': 'unity', authorization: `Bearer ${res.json().token}` },
  });
  assert.equal(me.statusCode, 200);
});

test('repeated failures lock the account, then it opens again after the wait', async () => {
  for (let i = 0; i < 5; i += 1)
    await post(
      '/api/auth/parent/login',
      { phone: '08031112222', password: 'bad' },
      { 'x-forwarded-for': `10.0.0.${i}` },
    );
  const locked = await post('/api/auth/parent/login', { phone: '08031112222', password: 'Zz9yy8xx7w' });
  assert.equal(locked.statusCode, 429);
  assert.match(locked.json().error, /Too many attempts/);
  clock.t += 16 * 60_000;
  const ok = await post('/api/auth/parent/login', { phone: '08031112222', password: 'Zz9yy8xx7w' });
  assert.equal(ok.statusCode, 200);
});

test('teacher signs in; a removed teacher is blocked', async () => {
  const ok = await post('/api/auth/teacher/login', { email: 'T.Adebayo@school.ng', password: 'teach-pass' });
  assert.equal(ok.statusCode, 200);
  const gone = await post('/api/auth/teacher/login', { email: 'gone@school.ng', password: 'gone-pass' });
  assert.equal(gone.statusCode, 401);
  assert.match(gone.json().error, /deactivated/);
});

test('removing a teacher ends the session they already have', async () => {
  const res = await post('/api/auth/teacher/login', { email: 't.adebayo@school.ng', password: 'teach-pass' });
  const cookie = cookieOf(res);
  assert.equal((await get('/api/me', cookie)).statusCode, 200);
  await db.query("UPDATE staff SET status = 'removed' WHERE id = $1", [ids.teacher]);
  assert.equal((await get('/api/me', cookie)).statusCode, 401);
  await db.query("UPDATE staff SET status = 'active' WHERE id = $1", [ids.teacher]);
});

test('head needs the security code too', async () => {
  assert.equal(
    (await post('/api/auth/head/login', { email: 'head@school.ng', password: 'head-pass', securityCode: '000000' }))
      .statusCode,
    401,
  );
  const ok = await post('/api/auth/head/login', {
    email: 'head@school.ng',
    password: 'head-pass',
    securityCode: '305771',
  });
  assert.equal(ok.statusCode, 200);
  assert.equal((await get('/api/head-only', cookieOf(ok))).statusCode, 200);
});

test('roles are isolated: a parent cannot use a head-only route', async () => {
  const res = await post('/api/auth/parent/login', { phone: '08035550142', password: 'Kf7pm2xqzt' });
  assert.equal((await get('/api/head-only', cookieOf(res))).statusCode, 403);
  assert.equal((await get('/api/head-only')).statusCode, 401);
  // a parent's details do not work on the teacher sign-in page
  assert.equal(
    (await post('/api/auth/teacher/login', { email: 'okafor@example.com', password: 'Kf7pm2xqzt' })).statusCode,
    401,
  );
});

test('student signs in with Student ID and PIN', async () => {
  const ok = await post('/api/auth/student/login', { studentId: '2025-J1A-AO-01', pin: '4821' });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().user.role, 'student');
  assert.equal((await post('/api/auth/student/login', { studentId: '2025-J1A-AO-01', pin: '0000' })).statusCode, 401);
});

test('logout ends the session', async () => {
  const res = await post('/api/auth/parent/login', { phone: '08035550142', password: 'Kf7pm2xqzt' });
  const cookie = cookieOf(res);
  await post('/api/auth/logout', {}, { cookie });
  assert.equal((await get('/api/me', cookie)).statusCode, 401);
});

test('unknown school and bad input are refused', async () => {
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/auth/parent/login',
        payload: { phone: '08035550142', password: 'x' },
        headers: { 'x-school': 'nope' },
      })
    ).statusCode,
    404,
  );
  assert.equal((await post('/api/auth/parent/login', { phone: '08035550142' })).statusCode, 400);
  assert.equal((await post('/api/auth/janitor/login', {})).statusCode, 404);
});

test('forgotten password: emailed link works once, then the old password stops working', async () => {
  mails.length = 0;
  const unknown = await post('/api/auth/parent/forgot', { phone: '08000000000' });
  const known = await post('/api/auth/parent/forgot', { phone: '0803 555 0142' });
  assert.deepEqual(unknown.json(), known.json(), 'same answer either way');
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'okafor@example.com');
  const token = /token=([\w-]+)/.exec(mails[0].text)[1];
  const stored = (await db.query('SELECT token_hash FROM password_tokens')).rows;
  assert.ok(
    stored.every((r) => r.token_hash !== token),
    'token itself is not stored',
  );
  const before = await post('/api/auth/parent/login', { phone: '08035550142', password: 'Kf7pm2xqzt' });
  const reset = await post('/api/auth/parent/set-password', { token, password: 'brand-new-pass' });
  assert.equal(reset.statusCode, 200);
  assert.equal((await get('/api/me', cookieOf(before))).statusCode, 401, 'old sessions signed out');
  assert.equal(
    (await post('/api/auth/parent/login', { phone: '08035550142', password: 'Kf7pm2xqzt' })).statusCode,
    401,
  );
  assert.equal(
    (await post('/api/auth/parent/login', { phone: '08035550142', password: 'brand-new-pass' })).statusCode,
    200,
  );
  assert.equal(
    (await post('/api/auth/parent/set-password', { token, password: 'another-pass-1' })).statusCode,
    400,
    'link is single use',
  );
});

test('expired reset link is refused', async () => {
  mails.length = 0;
  await post('/api/auth/parent/forgot', { phone: '08035550142' });
  const token = /token=([\w-]+)/.exec(mails[0].text)[1];
  clock.t += 0; // limiter clock only; expiry uses real time, so age the row directly
  await db.query("UPDATE password_tokens SET expires_at = now() - interval '1 minute'");
  assert.equal((await post('/api/auth/parent/set-password', { token, password: 'yet-another-1' })).statusCode, 400);
});

test('parent can change their own password; wrong current password is refused', async () => {
  const res = await post('/api/auth/parent/login', { phone: '08035550142', password: 'brand-new-pass' });
  const cookie = cookieOf(res);
  assert.equal(
    (await post('/api/auth/parent/change-password', { current: 'wrong', password: 'my-own-pass-1' }, { cookie }))
      .statusCode,
    400,
  );
  assert.equal(
    (
      await post(
        '/api/auth/parent/change-password',
        { current: 'brand-new-pass', password: 'my-own-pass-1' },
        { cookie },
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (await post('/api/auth/parent/login', { phone: '08035550142', password: 'my-own-pass-1' })).statusCode,
    200,
  );
});

test('invitation: one WhatsApp and one email, the parent chooses the password, the school never sees it', async () => {
  const guardian = (
    await db.query(
      "INSERT INTO guardians (full_name, phone, email) VALUES ('Mrs Eze', '08077778888', 'eze@example.com') RETURNING id",
    )
  ).rows[0].id;
  mails.length = 0;
  texts.length = 0;
  // before choosing a password nobody can sign in
  assert.equal(
    (await post('/api/auth/parent/login', { phone: '08077778888', password: 'anything-1' })).statusCode,
    401,
  );
  const sent = await app.inviteGuardian({ headers: { 'x-school': 'unity' } }, guardian);
  assert.equal(sent.ok, true);
  assert.equal(texts.length, 1);
  assert.equal(mails.length, 1);
  assert.equal(texts[0].to, '08077778888');
  assert.equal(mails[0].to, 'eze@example.com');
  const token = /token=([\w-]+)/.exec(texts[0].text)[1];
  assert.ok(!/password is/i.test(texts[0].text), 'the message contains no password');
  assert.equal(
    (await post('/api/auth/parent/set-password', { token, password: 'short' })).statusCode,
    400,
    'too short',
  );
  assert.equal((await post('/api/auth/parent/set-password', { token, password: 'Ngozi-chose-this' })).statusCode, 200);
  assert.equal(
    (await post('/api/auth/parent/login', { phone: '0807 777 8888', password: 'Ngozi-chose-this' })).statusCode,
    200,
  );
  assert.equal(
    (await post('/api/auth/parent/set-password', { token, password: 'someone-else-1' })).statusCode,
    400,
    'link works once',
  );
  const row = (await db.query('SELECT password_hash FROM guardians WHERE id = $1', [guardian])).rows[0];
  assert.ok(row.password_hash.startsWith('scrypt$') && !row.password_hash.includes('Ngozi'));
});

test('invitation link stays valid for weeks; a reset link does not', async () => {
  const guardian = (
    await db.query("INSERT INTO guardians (full_name, phone) VALUES ('Mr Late', '08066665555') RETURNING id")
  ).rows[0].id;
  texts.length = 0;
  mails.length = 0;
  await app.inviteGuardian({ headers: { 'x-school': 'unity' } }, guardian);
  const rows = (await db.query('SELECT purpose, expires_at FROM password_tokens WHERE guardian_id = $1', [guardian]))
    .rows;
  assert.equal(rows[0].purpose, 'invite');
  const days = (new Date(rows[0].expires_at) - Date.now()) / 86_400_000;
  assert.ok(days > 25 && days <= 30.1, `invitation lasts about 30 days, got ${days}`);
  assert.equal(texts.length, 1, 'no email on file: WhatsApp only');
  assert.equal(mails.length, 0);
});
