import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('health check', async () => {
  const app = buildApp();
  const res = await app.inject('/api/health');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, service: 'classbridge-api' });
});

test('roles endpoint lists permissions per role', async () => {
  const app = buildApp();
  const body = (await app.inject('/api/roles')).json();
  assert.ok(body.head.includes('payment.confirm'));
  assert.ok(!body.parent.includes('payment.confirm'));
  assert.deepEqual(body.student, ['cbt.sit', 'report.view-own']);
});
