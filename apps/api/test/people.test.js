import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { buildApp } from '../src/app.js';
import { createLimiter } from '../src/auth/limiter.js';
import { hashSecret } from '../src/auth/passwords.js';
import { onboardStudent } from '../src/students/service.js';

const dir = path.resolve(import.meta.dirname, '../migrations/school');
let db, app, mails, texts, head, teacherCookie;
const tokenOf = (m) => /token=([\w-]+)/.exec(m.text)[1];
const call = (method, url, payload, cookie = head) =>
  app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });
const login = async (role, payload) => {
  const r = await app.inject({ method: 'POST', url: `/api/auth/${role}/login`, payload });
  return r.statusCode === 200 ? r.headers['set-cookie'].split(';')[0] : r;
};

before(async () => {
  db = new PGlite();
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  mails = [];
  texts = [];
  app = buildApp({
    resolveDb: async () => db,
    mailer: { send: async (m) => void mails.push(m) },
    whatsapp: { send: async (m) => void texts.push(m) },
    limiter: { account: createLimiter({ max: 100 }), ip: createLimiter({ max: 1000 }) },
    resetLink: (t) => `https://x.test/set-password?token=${t}`,
  });
  await db.query(
    "INSERT INTO staff (email, full_name, role, status, password_hash, security_code_hash) VALUES ('head@school.ng', 'Principal', 'head', 'active', $1, $2)",
    [await hashSecret('head-pass'), await hashSecret('305771')],
  );
  head = await login('head', { email: 'head@school.ng', password: 'head-pass', securityCode: '305771' });
});

const teacher = (over = {}) => ({
  fullName: 'Mrs Funke Bello',
  email: 'Funke@School.ng',
  formClass: 'JSS 1A',
  subjects: ['Maths'],
  ...over,
});

/* ------------------------------------------------------------------ teachers */

test('head adds a teacher: no password is set, one email invitation goes out, email is stored lower case', async () => {
  const res = await call('POST', '/api/staff', teacher());
  assert.equal(res.statusCode, 201);
  const out = res.json();
  assert.equal(out.teacher.email, 'funke@school.ng');
  assert.equal(out.teacher.status, 'invited');
  assert.equal(out.invitationSent, true);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'funke@school.ng');
  assert.equal(texts.length, 0, 'teachers are invited by email only');
  const row = (await db.query("SELECT password_hash FROM staff WHERE email = 'funke@school.ng'")).rows[0];
  assert.equal(row.password_hash, null);
});

test('only the head can manage teachers', async () => {
  assert.equal((await call('POST', '/api/staff', teacher({ email: 'x@y.ng' }), null)).statusCode, 401);
  const tokenRow = tokenOf(mails[0]);
  assert.ok(tokenRow);
  // sign the new teacher in properly first, then try the head routes as a teacher
  const set = await call('POST', '/api/auth/parent/set-password', { token: tokenRow, password: 'funke-pass-1' }, null);
  assert.equal(set.statusCode, 200);
  assert.equal(set.json().role, 'teacher');
  teacherCookie = await login('teacher', { email: 'FUNKE@school.ng', password: 'funke-pass-1' });
  assert.equal(typeof teacherCookie, 'string');
  for (const [m, u] of [
    ['GET', '/api/staff'],
    ['POST', '/api/staff'],
    ['GET', '/api/guardians'],
    ['GET', '/api/fee-schedules'],
  ])
    assert.equal((await call(m, u, {}, teacherCookie)).statusCode, 403, `${m} ${u}`);
});

test('the invitation link works once, and the teacher becomes active', async () => {
  const again = await call(
    'POST',
    '/api/auth/parent/set-password',
    { token: tokenOf(mails[0]), password: 'other-pass-99' },
    null,
  );
  assert.equal(again.statusCode, 400);
  const list = (await call('GET', '/api/staff')).json().teachers;
  assert.equal(list.find((t) => t.email === 'funke@school.ng').status, 'active');
});

test('a teacher cannot sign in before choosing a password', async () => {
  await call('POST', '/api/staff', teacher({ fullName: 'Mr Tunde Ade', email: 'tunde@school.ng', formClass: null }));
  const r = await login('teacher', { email: 'tunde@school.ng', password: 'anything-at-all' });
  assert.equal(r.statusCode, 401);
});

test('the same email, and a second form teacher for one class, are refused', async () => {
  const dup = await call('POST', '/api/staff', teacher({ email: 'FUNKE@school.ng', formClass: null }));
  assert.equal(dup.statusCode, 409);
  const second = await call(
    'POST',
    '/api/staff',
    teacher({ fullName: 'Mrs Other Person', email: 'other@school.ng', formClass: 'JSS 1A' }),
  );
  assert.equal(second.statusCode, 409);
  assert.match(second.json().error, /already the form teacher of JSS 1A/);
});

test('head edits a teacher', async () => {
  const id = (await call('GET', '/api/staff')).json().teachers.find((t) => t.email === 'tunde@school.ng').id;
  const res = await call('PUT', `/api/staff/${id}`, {
    fullName: 'Mr Tunde Adeyemi',
    formClass: 'JSS 2B',
    subjects: ['English', 'Civic'],
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().teacher.subjects, ['English', 'Civic']);
  assert.equal(res.json().teacher.formClass, 'JSS 2B');
});

test('resending an invitation waits 10 minutes, cancels the older link, and the new link works', async () => {
  const id = (await call('GET', '/api/staff')).json().teachers.find((t) => t.email === 'tunde@school.ng').id;
  const first = tokenOf(mails.findLast((m) => m.to === 'tunde@school.ng'));
  const before = mails.length;
  const quick = await call('POST', `/api/staff/${id}/invitation`, {});
  assert.equal(quick.statusCode, 429);
  assert.equal(mails.length, before, 'no message sent while waiting');
  await db.query("UPDATE password_tokens SET created_at = now() - interval '11 minutes' WHERE staff_id = $1", [id]);
  assert.equal((await call('POST', `/api/staff/${id}/invitation`, {})).statusCode, 200);
  assert.equal(mails.length, before + 1);
  const second = tokenOf(mails.at(-1));
  assert.notEqual(first, second);
  assert.equal(
    (await call('POST', '/api/auth/parent/set-password', { token: first, password: 'tunde-pass-1' }, null)).statusCode,
    400,
    'old link is dead',
  );
  assert.equal(
    (await call('POST', '/api/auth/parent/set-password', { token: second, password: 'tunde-pass-1' }, null)).statusCode,
    200,
  );
});

test('removing a teacher ends their open sessions at once and blocks sign-in; restoring lets them back', async () => {
  const id = (await call('GET', '/api/staff')).json().teachers.find((t) => t.email === 'funke@school.ng').id;
  assert.equal((await call('GET', '/api/me', undefined, teacherCookie)).statusCode, 200);
  assert.equal((await call('POST', `/api/staff/${id}/remove`, {})).statusCode, 200);
  assert.equal((await call('GET', '/api/me', undefined, teacherCookie)).statusCode, 401);
  const blocked = await login('teacher', { email: 'funke@school.ng', password: 'funke-pass-1' });
  assert.equal(blocked.statusCode, 401);
  assert.match(blocked.json().error, /deactivated/);
  const removed = (await call('GET', '/api/staff')).json().teachers.find((t) => t.id === id);
  assert.equal(removed.status, 'removed');
  assert.equal(removed.formClass, null, 'a removed teacher no longer holds a form class');
  assert.equal(
    (await call('POST', `/api/staff/${id}/invitation`, {})).statusCode,
    409,
    'no invitation for a removed teacher',
  );
  assert.equal((await call('POST', `/api/staff/${id}/restore`, {})).statusCode, 200);
  assert.equal(typeof (await login('teacher', { email: 'funke@school.ng', password: 'funke-pass-1' })), 'string');
});

test('the head account can never be reached through teacher routes', async () => {
  const headId = (await db.query("SELECT id FROM staff WHERE role = 'head'")).rows[0].id;
  assert.equal((await call('POST', `/api/staff/${headId}/remove`, {})).statusCode, 404);
  assert.equal((await call('POST', `/api/staff/${headId}/invitation`, {})).statusCode, 404);
  assert.equal((await call('PUT', `/api/staff/${headId}`, { fullName: 'Hacked Name', subjects: [] })).statusCode, 404);
  assert.equal(
    (await call('GET', '/api/staff')).json().teachers.some((t) => t.id === headId),
    false,
  );
});

/* ------------------------------------------------------------------ parents */

test('parents list shows children and invitation status', async () => {
  await onboardStudent(db, {
    fullName: 'Adaeze Okafor',
    dateOfBirth: '2012-03-04',
    admissionNo: 'UHC/1',
    enrolYear: 2025,
    enrolClass: 'JSS 1A',
    guardian: { fullName: 'Mrs Okafor', phone: '0803 555 0142', email: 'okafor@example.com' },
  });
  const g = (await call('GET', '/api/guardians')).json().guardians;
  assert.equal(g.length, 1);
  assert.equal(g[0].status, 'expired', 'no invitation was sent through onboardStudent directly');
  assert.equal(g[0].children[0].id, '2025-J1A-AO-01');
});

test('resending a parent invitation: sends on both channels, waits 10 minutes, then shows as invited and later active', async () => {
  const id = (await call('GET', '/api/guardians')).json().guardians[0].id;
  const t0 = texts.length,
    m0 = mails.length;
  assert.equal((await call('POST', `/api/guardians/${id}/invitation`, {})).statusCode, 200);
  assert.equal(texts.length, t0 + 1);
  assert.equal(mails.length, m0 + 1);
  assert.equal((await call('GET', '/api/guardians')).json().guardians[0].status, 'invited');
  assert.equal((await call('POST', `/api/guardians/${id}/invitation`, {})).statusCode, 429);
  assert.equal(texts.length, t0 + 1, 'the blocked resend cost nothing');
  const link = tokenOf(texts.at(-1));
  assert.equal(
    (await call('POST', '/api/auth/parent/set-password', { token: link, password: 'okafor-pass-1' }, null)).json().role,
    'parent',
  );
  assert.equal((await call('GET', '/api/guardians')).json().guardians[0].status, 'active');
  assert.equal((await call('POST', `/api/guardians/not-an-id/invitation`, {})).statusCode, 404);
});

/* ------------------------------------------------------------------ fee schedules */

const sched = (over = {}) => ({
  level: 'JSS 1',
  term: 'First term',
  title: 'School fees',
  items: [
    { name: 'Tuition', amount: 120000 },
    { name: 'PTA', amount: 5000 },
  ],
  ...over,
});

test('head saves a fee schedule; saving the same level and term again replaces it', async () => {
  const a = await call('PUT', '/api/fee-schedules', sched());
  assert.equal(a.statusCode, 200);
  assert.equal(a.json().schedule.total, 125000);
  const b = await call('PUT', '/api/fee-schedules', sched({ items: [{ name: 'Tuition', amount: 130000 }] }));
  assert.equal(b.json().schedule.id, a.json().schedule.id, 'same row, updated');
  const all = (await call('GET', '/api/fee-schedules')).json().schedules;
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].items, [{ name: 'Tuition', amount: 130000 }]);
});

test('fee schedule rules: valid level and term, at least one item, whole positive naira', async () => {
  for (const bad of [
    sched({ level: 'JSS 4' }),
    sched({ term: 'Fourth term' }),
    sched({ items: [] }),
    sched({ items: [{ name: 'x', amount: 0 }] }),
    sched({ items: [{ name: 'x', amount: 10.5 }] }),
  ])
    assert.equal((await call('PUT', '/api/fee-schedules', bad)).statusCode, 400);
});

test('changing a schedule never changes an invoice already made from it', async () => {
  const s = (await call('GET', '/api/fee-schedules')).json().schedules[0];
  const sid = (await db.query("SELECT id FROM students WHERE id = '2025-J1A-AO-01'")).rows[0].id;
  const made = await call('POST', '/api/invoices', {
    mode: 'student',
    studentId: sid,
    term: 'First term',
    session: '2026/2027',
    dueDate: '2026-12-01',
    title: 'School fees',
    items: s.items,
  });
  assert.equal(made.statusCode, 201);
  await call('PUT', '/api/fee-schedules', sched({ items: [{ name: 'Tuition', amount: 999000 }] }));
  const inv = (await call('GET', '/api/invoices')).json().invoices[0];
  assert.equal(inv.total, 130000);
});

test('head deletes a schedule', async () => {
  const s = (await call('GET', '/api/fee-schedules')).json().schedules[0];
  assert.equal((await call('DELETE', `/api/fee-schedules/${s.id}`)).statusCode, 200);
  assert.equal((await call('DELETE', `/api/fee-schedules/${s.id}`)).statusCode, 404);
  assert.equal((await call('GET', '/api/fee-schedules')).json().schedules.length, 0);
});
