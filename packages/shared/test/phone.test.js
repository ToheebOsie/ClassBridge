import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, parentLoginSchema, headLoginSchema } from '../src/index.js';

test('phone numbers written differently normalise to the same value', () => {
  for (const v of ['0803 555 0142', '+234 803 555 0142', '2348035550142', '803-555-0142', '(0803)5550142']) {
    assert.equal(normalizePhone(v), '08035550142', v);
  }
});

test('login schemas', () => {
  assert.equal(parentLoginSchema.safeParse({ phone: '08035550142', password: 'x' }).success, true);
  assert.equal(parentLoginSchema.safeParse({ phone: '08035550142' }).success, false);
  assert.equal(headLoginSchema.safeParse({ email: 'a@b.ng', password: 'x' }).success, false);
});
