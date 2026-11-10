import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  invoiceTotal,
  balance,
  payableRoom,
  invoiceStatus,
  canSetTotal,
  formatNaira,
  can,
  ROLES,
  invoiceInputSchema,
} from '../src/index.js';

const inv = (payments) => ({
  items: [
    { name: 'Tuition', amount: 150000 },
    { name: 'Books', amount: 25000 },
    { name: 'PTA', amount: 5000 },
  ],
  payments,
});

test('totals, balance and status', () => {
  assert.equal(invoiceTotal(inv([])), 180000);
  assert.equal(invoiceStatus(inv([])), 'unpaid');
  const part = inv([
    { amount: 100000, status: 'confirmed' },
    { amount: 50000, status: 'pending' },
    { amount: 9000, status: 'rejected' },
  ]);
  assert.equal(balance(part), 80000);
  assert.equal(payableRoom(part), 30000);
  assert.equal(invoiceStatus(part), 'part');
  assert.equal(invoiceStatus(inv([{ amount: 180000, status: 'confirmed' }])), 'paid');
});

test('total may not fall below confirmed payments', () => {
  const part = inv([{ amount: 100000, status: 'confirmed' }]);
  assert.equal(canSetTotal(part, 99999), false);
  assert.equal(canSetTotal(part, 100000), true);
});

test('naira formatting', () => {
  assert.equal(formatNaira(150000), '₦150,000');
});

test('permissions', () => {
  assert.deepEqual(ROLES, ['teacher', 'parent', 'student', 'head']);
  assert.equal(can('head', 'payment.confirm'), true);
  assert.equal(can('parent', 'payment.confirm'), false);
  assert.equal(can('student', 'invoice.view-own'), false);
});

test('invoice schema rejects empty or non-integer items', () => {
  const base = { term: 'First term', session: '2026/2027', dueDate: '2026-11-15' };
  assert.equal(invoiceInputSchema.safeParse({ ...base, items: [] }).success, false);
  assert.equal(invoiceInputSchema.safeParse({ ...base, items: [{ name: 'Tuition', amount: 10.5 }] }).success, false);
  const ok = invoiceInputSchema.safeParse({ ...base, items: [{ name: 'Tuition', amount: 150000 }] });
  assert.equal(ok.success, true);
  assert.equal(ok.data.title, 'School fees');
});
