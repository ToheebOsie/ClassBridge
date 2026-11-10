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
let db, app, mails, texts, headCookie, parentCookie, teacherCookie;

const body = (over = {}) => ({
  fullName: 'Adaeze Okafor',
  dateOfBirth: '2012-03-04',
  admissionNo: 'UHC/2025/101',
  enrolYear: 2025,
  enrolClass: 'JSS 1A',
  guardian: { fullName: 'Mrs Okafor', phone: '0803 555 0142', email: 'okafor@example.com' },
  ...over,
});

before(async () => {
  db = new PGlite();
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  mails = [];
  texts = [];
  app = buildApp({
    resolveDb: async () => db,
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
    limiter: { account: createLimiter({ max: 100 }), ip: createLimiter({ max: 1000 }) },
    resetLink: (t) => `https://x.test/set-password?token=${t}`,
  });
  await db.query(
    "INSERT INTO staff (email, full_name, role, status, password_hash, security_code_hash) VALUES ('head@school.ng', 'Principal', 'head', 'active', $1, $2)",
    [await hashSecret('head-pass'), await hashSecret('305771')],
  );
  await db.query(
    "INSERT INTO staff (email, full_name, role, status, password_hash) VALUES ('t@school.ng', 'Teacher', 'teacher', 'active', $1)",
    [await hashSecret('teach-pass')],
  );
  const login = async (role, payload) =>
    (await app.inject({ method: 'POST', url: `/api/auth/${role}/login`, payload })).headers['set-cookie'].split(';')[0];
  headCookie = await login('head', { email: 'head@school.ng', password: 'head-pass', securityCode: '305771' });
  teacherCookie = await login('teacher', { email: 't@school.ng', password: 'teach-pass' });
  // a parent who already has a password
  await db.query("INSERT INTO guardians (full_name, phone, password_hash) VALUES ('Mr Bello', '08031112222', $1)", [
    await hashSecret('parent-pass-1'),
  ]);
  parentCookie = await login('parent', { phone: '08031112222', password: 'parent-pass-1' });
});

const enrol = (payload, cookie = headCookie) =>
  app.inject({ method: 'POST', url: '/api/students', payload, headers: { cookie } });

test('head onboards a student: ID, PIN, parent linked, invitation sent once', async () => {
  const res = await enrol(body());
  assert.equal(res.statusCode, 201);
  const out = res.json();
  assert.equal(out.student.id, '2025-J1A-AO-01');
  assert.match(out.pin, /^\d{4}$/);
  assert.equal(out.invitationSent, true);
  assert.equal(texts.length, 1);
  assert.equal(texts[0].to, '08035550142', 'phone is stored in one normal form');
  assert.equal(mails.length, 1);
  const g = (
    await db.query(
      'SELECT g.phone FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id WHERE sg.student_id = $1',
      ['2025-J1A-AO-01'],
    )
  ).rows;
  assert.deepEqual(
    g.map((r) => r.phone),
    ['08035550142'],
  );
  const stored = (await db.query('SELECT pin_hash FROM students WHERE id = $1', ['2025-J1A-AO-01'])).rows[0].pin_hash;
  assert.ok(stored.startsWith('scrypt$') && !stored.includes(out.pin), 'PIN is stored hashed');
  // the student can sign in with the PIN the head was given
  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/student/login',
    payload: { studentId: '2025-J1A-AO-01', pin: out.pin },
  });
  assert.equal(signIn.statusCode, 200);
});

test('same year, class and initials get the next sequence number', async () => {
  const res = await enrol(
    body({
      fullName: 'Aisha Oni',
      admissionNo: 'UHC/2025/102',
      dateOfBirth: '2012-05-06',
      guardian: { fullName: 'Mr Oni', phone: '08099990000' },
    }),
  );
  assert.equal(res.json().student.id, '2025-J1A-AO-02');
});

test('a second child of the same parent reuses the parent and does not send a second invitation', async () => {
  const before = texts.length;
  const res = await enrol(
    body({ fullName: 'Chidera Okafor', admissionNo: 'UHC/2025/103', dateOfBirth: '2014-01-02', enrolClass: 'JSS 1B' }),
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().guardian.existing, true);
  assert.equal(res.json().invitationSent, false);
  assert.equal(texts.length, before);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM guardians WHERE phone = '08035550142'")).rows[0].n, 1);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id WHERE g.phone = '08035550142'",
      )
    ).rows[0].n,
    2,
  );
});

test('a parent who already has a password gets no invitation', async () => {
  const before = texts.length;
  const res = await enrol(
    body({
      fullName: 'Tunde Bello',
      admissionNo: 'UHC/2025/104',
      dateOfBirth: '2013-07-08',
      guardian: { fullName: 'Mr Bello', phone: '+234 803 111 2222' },
    }),
  );
  assert.equal(res.json().invitationSent, false);
  assert.equal(texts.length, before);
});

test('the same child is never enrolled twice', async () => {
  const sameAdmission = await enrol(body({ fullName: 'Someone Else', dateOfBirth: '2011-01-01' }));
  assert.equal(sameAdmission.statusCode, 409);
  assert.match(sameAdmission.json().error, /already enrolled with ID 2025-J1A-AO-01/);
  const sameNameAndBirth = await enrol(
    body({ admissionNo: 'UHC/2026/900', fullName: 'adaeze okafor', enrolYear: 2026 }),
  );
  assert.equal(sameNameAndBirth.statusCode, 409);
});

test('a graduated student cannot be enrolled again, and the message says so', async () => {
  await db.query("UPDATE students SET status = 'graduated', current_class = NULL WHERE id = '2025-J1A-AO-02'");
  const res = await enrol(
    body({ fullName: 'Aisha Oni', dateOfBirth: '2012-05-06', admissionNo: 'UHC/2027/1', enrolYear: 2027 }),
  );
  assert.equal(res.statusCode, 409);
  assert.match(res.json().error, /graduated, in the archive/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM students WHERE id LIKE '2027-%'")).rows[0].n, 0);
});

test('bad input is refused with a clear message', async () => {
  const noSurname = await enrol(body({ fullName: 'Madonna', admissionNo: 'X1' }));
  assert.equal(noSurname.statusCode, 400);
  assert.match(noSurname.json().error, /first name and last name/);
  assert.equal((await enrol(body({ enrolClass: 'Primary 4', admissionNo: 'X2' }))).statusCode, 400);
  assert.equal((await enrol(body({ dateOfBirth: '2999-01-01', admissionNo: 'X3' }))).statusCode, 400);
  assert.equal((await enrol(body({ guardian: { fullName: 'Mr X', phone: '1' }, admissionNo: 'X4' }))).statusCode, 400);
});

test('only the head can onboard or list students', async () => {
  assert.equal((await enrol(body({ admissionNo: 'Z1' }), parentCookie)).statusCode, 403);
  assert.equal((await enrol(body({ admissionNo: 'Z2' }), teacherCookie)).statusCode, 403);
  assert.equal((await enrol(body({ admissionNo: 'Z3' }), '')).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/students', headers: { cookie: parentCookie } })).statusCode, 403);
});

test('head lists students, including archived ones, and can filter', async () => {
  const all = (await app.inject({ url: '/api/students', headers: { cookie: headCookie } })).json().students;
  assert.ok(all.length >= 4);
  assert.ok(all.some((s) => s.status === 'graduated'));
  const active = (await app.inject({ url: '/api/students?status=active', headers: { cookie: headCookie } })).json()
    .students;
  assert.ok(active.every((s) => s.status === 'active') && active.length < all.length);
  assert.ok(!JSON.stringify(all).includes('pin'), 'no PIN data in the list');
});

test('all or nothing: if the parent cannot be saved, the student is not created either', async () => {
  const failing = {
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          query: (sql, p) =>
            sql.includes('INSERT INTO guardians') ? Promise.reject(new Error('boom')) : tx.query(sql, p),
        }),
      ),
  };
  await assert.rejects(
    onboardStudent(
      failing,
      body({
        fullName: 'Rolled Back',
        admissionNo: 'RB1',
        dateOfBirth: '2012-02-02',
        guardian: { fullName: 'Mr RB', phone: '08012345678' },
      }),
    ),
    /boom/,
  );
  assert.equal((await db.query("SELECT count(*)::int AS n FROM students WHERE admission_no = 'RB1'")).rows[0].n, 0);
});

test('two students onboarded at the same moment never share an ID', async () => {
  const mk = (n) =>
    onboardStudent(
      db,
      body({
        fullName: 'Ngozi Eze',
        admissionNo: `RACE${n}`,
        dateOfBirth: `2012-04-0${n}`,
        enrolYear: 2030,
        guardian: { fullName: 'P', phone: `0801000000${n}` },
      }),
    );
  const [a, b, c] = await Promise.all([mk(1), mk(2), mk(3)]);
  assert.equal(new Set([a.student.id, b.student.id, c.student.id]).size, 3);
});
