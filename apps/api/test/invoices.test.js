import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { buildApp } from '../src/app.js';
import { createLimiter } from '../src/auth/limiter.js';
import { hashSecret } from '../src/auth/passwords.js';
import { createMemoryStorage } from '../src/storage/local.js';

const dir = path.resolve(import.meta.dirname, '../migrations/school');
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const YEAR = new Date().getFullYear();
let db, app, storage, texts, head, pA, pB, teacher;
const S = {}; // student ids

const call = (method, url, cookie, payload) => app.inject({ method, url, payload, headers: { cookie: cookie || '' } });
const items = (tuition = 150000) => [
  { name: 'Tuition', amount: tuition },
  { name: 'Books', amount: 25000 },
  { name: 'PTA levy', amount: 5000 },
];
const invoiceBody = (over = {}) => ({
  term: 'First term',
  session: '2026/2027',
  dueDate: '2026-11-15',
  note: 'Pay in instalments if you wish.',
  items: items(),
  ...over,
});
const cls = (over = {}) => invoiceBody({ mode: 'class', classes: ['JSS 2A'], ...over });
const mine = async (cookie) => (await call('GET', '/api/my/invoices', cookie)).json().invoices;
const payBody = (amount, over = {}) => ({
  amount,
  date: '2026-11-01',
  method: 'Bank transfer',
  reference: 'GTB 1',
  note: '',
  screenshot: PNG,
  ...over,
});

before(async () => {
  db = new PGlite();
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  storage = createMemoryStorage();
  texts = [];
  app = buildApp({
    resolveDb: async () => db,
    storage,
    mailer: { send: async () => {} },
    whatsapp: {
      send: async (m) => {
        texts.push(m);
      },
    },
    limiter: { account: createLimiter({ max: 1000 }), ip: createLimiter({ max: 1000 }) },
  });
  const student = async (id, name, cls_, dob) => {
    await db.query(
      'INSERT INTO students (id, admission_no, full_name, date_of_birth, enrol_year, enrol_class, current_class) VALUES ($1, $1, $2, $3, 2025, $4, $4)',
      [id, name, dob, cls_],
    );
    S[name.split(' ')[0]] = id;
  };
  await student('2025-J2A-AO-01', 'Adaeze Okafor', 'JSS 2A', '2012-01-01');
  await student('2025-J1B-CO-01', 'Chidera Okafor', 'JSS 1B', '2014-01-01');
  await student('2025-J2A-CE-01', 'Chinedu Eze', 'JSS 2A', '2012-02-02');
  await student('2025-J2A-FG-01', 'Fatima Garba', 'JSS 2A', '2012-03-03');
  await student('2025-J2A-DE-01', 'David Etim', 'JSS 2A', '2012-04-04');
  const guardian = async (phone, name, kids) => {
    const g = (
      await db.query('INSERT INTO guardians (full_name, phone, password_hash) VALUES ($1, $2, $3) RETURNING id', [
        name,
        phone,
        await hashSecret('parent-pass-1'),
      ])
    ).rows[0].id;
    for (const k of kids) await db.query('INSERT INTO student_guardians VALUES ($1, $2)', [k, g]);
  };
  await guardian('08030000001', 'Mr Okafor', [S.Adaeze, S.Chidera]);
  await guardian('08030000002', 'Mrs Eze', [S.Chinedu]);
  await db.query(
    "INSERT INTO staff (email, full_name, role, status, password_hash, security_code_hash) VALUES ('head@school.ng', 'Principal', 'head', 'active', $1, $2)",
    [await hashSecret('head-pass'), await hashSecret('305771')],
  );
  await db.query(
    "INSERT INTO staff (email, full_name, role, status, password_hash) VALUES ('t@school.ng', 'Teacher', 'teacher', 'active', $1)",
    [await hashSecret('teach-pass')],
  );
  const login = async (role, p) =>
    (await app.inject({ method: 'POST', url: `/api/auth/${role}/login`, payload: p })).headers['set-cookie'].split(
      ';',
    )[0];
  head = await login('head', { email: 'head@school.ng', password: 'head-pass', securityCode: '305771' });
  teacher = await login('teacher', { email: 't@school.ng', password: 'teach-pass' });
  pA = await login('parent', { phone: '08030000001', password: 'parent-pass-1' });
  pB = await login('parent', { phone: '08030000002', password: 'parent-pass-1' });
});

test('only the head can create or see all invoices', async () => {
  assert.equal((await call('POST', '/api/invoices', pA, cls())).statusCode, 403);
  assert.equal((await call('POST', '/api/invoices', teacher, cls())).statusCode, 403);
  assert.equal((await call('POST', '/api/invoices', '', cls())).statusCode, 401);
  assert.equal((await call('GET', '/api/invoices', pA)).statusCode, 403);
});

test('class invoice: preview, leave one out, then one separate invoice per student', async () => {
  const prev = (await call('POST', '/api/invoices/preview', head, cls({ skipStudentIds: [S.David] }))).json();
  assert.equal(prev.students.length, 4);
  assert.deepEqual(prev.willSend.map((s) => s.name).sort(), ['Adaeze Okafor', 'Chinedu Eze', 'Fatima Garba']);
  assert.equal((await call('GET', '/api/invoices', head)).json().invoices.length, 0, 'preview creates nothing');
  texts.length = 0;
  const res = await call('POST', '/api/invoices', head, cls({ skipStudentIds: [S.David] }));
  assert.equal(res.statusCode, 201);
  const out = res.json();
  assert.deepEqual(
    out.created.map((c) => c.number),
    [`INV-${YEAR}-0001`, `INV-${YEAR}-0002`, `INV-${YEAR}-0003`],
  );
  assert.equal(new Set(out.created.map((c) => c.studentId)).size, 3);
  assert.ok(!out.created.some((c) => c.studentId === S.David), 'left-out student got none');
  assert.equal(texts.length, 2, 'WhatsApp to the two students who have a parent on file (Fatima has none)');
  const all = (await call('GET', '/api/invoices', head)).json().invoices;
  assert.ok(all.every((i) => i.total === 180000 && i.status === 'unpaid' && i.batchId === out.batchId));
});

test('a parent sees only their own children’s invoices', async () => {
  const a = await mine(pA),
    b = await mine(pB);
  assert.deepEqual(
    a.map((i) => i.studentName),
    ['Adaeze Okafor'],
  );
  assert.deepEqual(
    b.map((i) => i.studentName),
    ['Chinedu Eze'],
  );
  assert.ok(a[0].seenByParent === false);
});

test('sending the same class invoice again skips everyone who has it; a new title reaches all', async () => {
  const again = await call('POST', '/api/invoices', head, cls());
  assert.equal(again.statusCode, 201);
  assert.equal(again.json().created.length, 1, 'only David was missing');
  assert.equal(again.json().skippedAlreadyHad, 3);
  assert.equal((await call('POST', '/api/invoices', head, cls())).statusCode, 409, 'now nobody is left');
  const excursion = await call(
    'POST',
    '/api/invoices',
    head,
    cls({ title: 'Excursion', items: [{ name: 'Trip', amount: 8000 }] }),
  );
  assert.equal(excursion.json().created.length, 4);
});

test('a single invoice for a student who already has it is refused with a hint', async () => {
  const dup = await call('POST', '/api/invoices', head, invoiceBody({ mode: 'student', studentId: S.Adaeze }));
  assert.equal(dup.statusCode, 409);
  assert.match(dup.json().error, /already has an invoice called "School fees"/);
  const ok = await call('POST', '/api/invoices', head, invoiceBody({ mode: 'student', studentId: S.Chidera }));
  assert.equal(ok.statusCode, 201);
  assert.equal(
    (await call('POST', '/api/invoices', head, invoiceBody({ mode: 'student', studentId: 'nope' }))).statusCode,
    404,
  );
});

test('invalid invoice input is refused', async () => {
  assert.equal((await call('POST', '/api/invoices', head, cls({ items: [] }))).statusCode, 400);
  assert.equal(
    (await call('POST', '/api/invoices', head, cls({ items: [{ name: 'X', amount: 10.5 }] }))).statusCode,
    400,
  );
  assert.equal((await call('POST', '/api/invoices', head, cls({ classes: [] }))).statusCode, 400);
  assert.equal((await call('POST', '/api/invoices', head, invoiceBody({ mode: 'student' }))).statusCode, 400);
});

let adaeze, adaezeInv;
test('parent reports a payment with a screenshot; rules for amount and image', async () => {
  adaezeInv = (await mine(pA)).find((i) => i.title === 'School fees' && i.studentId === S.Adaeze);
  const url = `/api/my/invoices/${adaezeInv.id}/payments`;
  assert.equal((await call('POST', url, pA, payBody(500000))).statusCode, 400, 'more than the balance');
  assert.equal(
    (await call('POST', url, pA, payBody(100000, { screenshot: '' }))).statusCode,
    400,
    'screenshot required',
  );
  assert.equal(
    (
      await call(
        'POST',
        url,
        pA,
        payBody(100000, {
          screenshot: 'data:image/png;base64,' + Buffer.from('this is not an image').toString('base64'),
        }),
      )
    ).statusCode,
    400,
    'contents must really be an image',
  );
  assert.equal(
    (
      await call(
        'POST',
        url,
        pA,
        payBody(100000, {
          screenshot:
            'data:image/png;base64,' +
            Buffer.concat([
              Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]),
              Buffer.alloc(6 * 1024 * 1024),
            ]).toString('base64'),
        }),
      )
    ).statusCode,
    413,
    'too large: refused before it is even read',
  );
  const justOver = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]),
    Buffer.alloc(5 * 1024 * 1024),
  ]).toString('base64');
  const over = await call('POST', url, pA, payBody(100000, { screenshot: 'data:image/png;base64,' + justOver }));
  assert.equal(over.statusCode, 400);
  assert.match(over.json().error, /under 5 MB/);
  assert.equal((await call('POST', url, pB, payBody(100000))).statusCode, 404, 'another family cannot pay or see it');
  assert.equal((await call('POST', url, head, payBody(100000))).statusCode, 403, 'head does not use the parent route');
  const ok = await call('POST', url, pA, payBody(100000));
  assert.equal(ok.statusCode, 201);
  adaeze = ok.json().id;
  assert.equal(storage.files.size, 1, 'only the valid screenshot was stored');
  const inv = (await mine(pA)).find((i) => i.id === adaezeInv.id);
  assert.equal(inv.pending, 100000);
  assert.equal(inv.confirmed, 0);
  assert.equal(inv.room, 80000, 'pending money counts against what can still be sent');
  assert.equal((await call('POST', url, pA, payBody(90000))).statusCode, 400);
  assert.match((await call('POST', url, pA, payBody(90000))).json().error, /up to ₦80,000/);
});

test('the screenshot is private to the head and the parent who sent it', async () => {
  const url = `/api/payments/${adaeze}/screenshot`;
  const h = await call('GET', url, head);
  assert.equal(h.statusCode, 200);
  assert.equal(h.headers['content-type'], 'image/png');
  assert.match(h.headers['cache-control'], /no-store/);
  assert.equal((await call('GET', url, pA)).statusCode, 200);
  assert.equal((await call('GET', url, pB)).statusCode, 404);
  assert.equal((await call('GET', url, teacher)).statusCode, 403);
  assert.equal((await call('GET', url, '')).statusCode, 401);
});

test('step 1 only previews: nothing is created, no number is used up', async () => {
  const pending = (await call('GET', '/api/payments/pending', head)).json().pending;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].invoice.studentName, 'Adaeze Okafor');
  const prev = await call('POST', `/api/payments/${adaeze}/preview`, head, { amount: 100000 });
  assert.equal(prev.statusCode, 200);
  const r = prev.json().receipt;
  assert.equal(r.number, null);
  assert.equal(r.paid, 100000);
  assert.equal(r.balance, 80000);
  assert.equal(r.total, 180000);
  assert.equal((await call('GET', '/api/receipts/all', head)).json().receipts.length, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM counters WHERE name LIKE 'RCP-%'")).rows[0].n, 0);
  assert.equal((await call('POST', `/api/payments/${adaeze}/preview`, head, { amount: 0 })).statusCode, 400);
  assert.equal((await call('POST', `/api/payments/${adaeze}/preview`, head, { amount: 999999 })).statusCode, 400);
  assert.equal((await call('POST', `/api/payments/${adaeze}/preview`, pA, { amount: 1000 })).statusCode, 403);
});

test('step 2 creates one receipt, tells the parent, and is safe to repeat', async () => {
  texts.length = 0;
  // the head received less than the parent claimed
  const res = await call('POST', `/api/payments/${adaeze}/confirm`, head, { amount: 90000 });
  assert.equal(res.statusCode, 201);
  const r = res.json().receipt;
  assert.equal(r.number, `RCP-${YEAR}-0001`);
  assert.equal(r.paid, 90000);
  assert.equal(r.before, 0);
  assert.equal(r.balance, 90000);
  assert.equal(r.invoiceNumber, adaezeInv.number);
  assert.equal(texts.length, 1);
  assert.match(texts[0].text, /Receipt .* ₦90,000 received/);
  // a double click, a retry, or two people clicking at once
  const [again, again2] = await Promise.all([
    call('POST', `/api/payments/${adaeze}/confirm`, head, { amount: 90000 }),
    call('POST', `/api/payments/${adaeze}/confirm`, head, { amount: 90000 }),
  ]);
  for (const x of [again, again2]) {
    assert.equal(x.statusCode, 200);
    assert.equal(x.json().alreadyConfirmed, true);
    assert.equal(x.json().receipt.number, r.number);
  }
  assert.equal(texts.length, 1, 'no second message');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM receipts')).rows[0].n, 1);
  const inv = (await mine(pA)).find((i) => i.id === adaezeInv.id);
  assert.equal(inv.confirmed, 90000);
  assert.equal(inv.status, 'part');
  assert.equal(inv.payments[0].receiptNumber, r.number);
  assert.equal((await call('GET', '/api/payments/pending', head)).json().pending.length, 0);
});

test('the parent sees the receipt, with a dot until they open it, and not other families’', async () => {
  const rc = (await call('GET', '/api/my/receipts', pA)).json().receipts;
  assert.equal(rc.length, 1);
  assert.equal(rc[0].seenByParent, false);
  await call('POST', '/api/my/receipts/seen', pA);
  assert.equal((await call('GET', '/api/my/receipts', pA)).json().receipts[0].seenByParent, true);
  assert.equal((await call('GET', '/api/my/receipts', pB)).json().receipts.length, 0);
});

test('editing the invoice later never changes a receipt already sent', async () => {
  const edit = await call('PUT', `/api/invoices/${adaezeInv.id}`, head, {
    ...invoiceBody({ items: items(160000) }),
    applyToBatch: false,
  });
  assert.equal(edit.statusCode, 200);
  const r = (await call('GET', '/api/my/receipts', pA)).json().receipts[0];
  assert.equal(r.total, 180000);
  assert.equal(r.items[0].amount, 150000);
  const inv = (await mine(pA)).find((i) => i.id === adaezeInv.id);
  assert.equal(inv.total, 190000);
  assert.equal(inv.revised, true);
  assert.equal(inv.seenByParent, false);
  assert.equal(inv.customised, true);
});

test('the total cannot go below what is already confirmed', async () => {
  const low = await call('PUT', `/api/invoices/${adaezeInv.id}`, head, {
    ...invoiceBody({ items: [{ name: 'Tuition', amount: 80000 }] }),
    applyToBatch: false,
  });
  assert.equal(low.statusCode, 400);
  assert.match(low.json().error, /cannot be lower than the ₦90,000/);
});

test('rejecting needs a reason, reaches the parent, and can be followed by a new payment', async () => {
  const url = `/api/my/invoices/${adaezeInv.id}/payments`;
  const id = (await call('POST', url, pA, payBody(50000, { reference: 'WRONG' }))).json().id;
  assert.equal((await call('POST', `/api/payments/${id}/reject`, head, { reason: '' })).statusCode, 400);
  texts.length = 0;
  assert.equal(
    (await call('POST', `/api/payments/${id}/reject`, head, { reason: 'Amount on the screenshot differs.' }))
      .statusCode,
    200,
  );
  assert.match(texts[0].text, /not accepted: Amount on the screenshot differs/);
  const inv = (await mine(pA)).find((i) => i.id === adaezeInv.id);
  const p = inv.payments.find((x) => x.id === id);
  assert.equal(p.status, 'rejected');
  assert.equal(p.rejectReason, 'Amount on the screenshot differs.');
  assert.equal(p.parentSeen, false);
  assert.equal(inv.pending, 0, 'a rejected payment frees the balance again');
  assert.equal(
    (await call('POST', `/api/payments/${id}/confirm`, head, { amount: 50000 })).statusCode,
    409,
    'cannot confirm a rejected payment',
  );
  assert.equal((await call('POST', `/api/payments/${id}/reject`, head, { reason: 'twice' })).statusCode, 409);
  await call('POST', '/api/my/invoices/seen', pA);
  assert.equal((await mine(pA)).find((i) => i.id === adaezeInv.id).payments.find((x) => x.id === id).parentSeen, true);
});

test('instalments reach "paid in full", then nothing more can be paid', async () => {
  const url = `/api/my/invoices/${adaezeInv.id}/payments`;
  const cur = (await mine(pA)).find((i) => i.id === adaezeInv.id);
  const rest = cur.balance; // 190000 - 90000
  const id = (await call('POST', url, pA, payBody(rest))).json().id;
  const res = await call('POST', `/api/payments/${id}/confirm`, head, { amount: rest });
  assert.equal(res.json().receipt.number, `RCP-${YEAR}-0002`);
  assert.equal(res.json().receipt.before, 90000);
  assert.equal(res.json().receipt.balance, 0);
  assert.match(texts.at(-1).text, /Paid in full/);
  const done = (await mine(pA)).find((i) => i.id === adaezeInv.id);
  assert.equal(done.status, 'paid');
  assert.equal((await call('POST', url, pA, payBody(1000))).statusCode, 400);
});

test('editing a whole class batch skips individually changed invoices and anyone who paid more', async () => {
  const all = (await call('GET', '/api/invoices', head))
    .json()
    .invoices.filter((i) => i.title === 'School fees' && i.batchId);
  const chinedu = all.find((i) => i.studentId === S.Chinedu);
  // Chinedu pays 175,000 (more than the new total will be)
  const pid = (await call('POST', `/api/my/invoices/${chinedu.id}/payments`, pB, payBody(175000))).json().id;
  await call('POST', `/api/payments/${pid}/confirm`, head, { amount: 175000 });
  const res = await call('PUT', `/api/invoices/${all.find((i) => i.studentId === S.Fatima).id}`, head, {
    ...invoiceBody({ items: items(140000) }),
    applyToBatch: true,
  });
  assert.equal(res.statusCode, 200);
  const after = (await call('GET', '/api/invoices', head))
    .json()
    .invoices.filter((i) => i.title === 'School fees' && i.batchId);
  const by = (sid) => after.find((i) => i.studentId === sid);
  assert.equal(by(S.Fatima).total, 170000);
  assert.equal(by(S.David).total, 180000, 'David was sent in a later batch, so a different batch is untouched');
  assert.equal(by(S.Adaeze).total, 190000, 'individually changed invoice left alone');
  assert.equal(by(S.Chinedu).total, 180000, 'paid more than the new total, so unchanged');
  assert.equal(res.json().skipped.length, 1);
});

test('numbers never repeat, and every receipt belongs to exactly one payment', async () => {
  const nums = (await db.query('SELECT number FROM invoices UNION ALL SELECT number FROM receipts')).rows.map(
    (r) => r.number,
  );
  assert.equal(new Set(nums).size, nums.length);
  const dupes = (await db.query('SELECT payment_id FROM receipts GROUP BY payment_id HAVING count(*) > 1')).rows;
  assert.equal(dupes.length, 0);
});
