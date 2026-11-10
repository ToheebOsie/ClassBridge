import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classCode, initialsOf, makeStudentId } from '../src/index.js';

test('class codes', () => {
  assert.equal(classCode('JSS 1A'), 'J1A');
  assert.equal(classCode('SS 3b'), 'S3B');
  assert.throws(() => classCode('Primary 4'));
});

test('initials use first and last name', () => {
  assert.equal(initialsOf('Adaeze Okafor'), 'AO');
  assert.equal(initialsOf('  tobiloba   olu  adeyemi '), 'TA');
  assert.equal(initialsOf('Madonna'), 'M');
});

test('student ID format and collision handling', () => {
  assert.equal(makeStudentId(2025, 'JSS 1A', 'Adaeze Okafor', []), '2025-J1A-AO-01');
  const taken = ['2025-J1A-AO-01', '2025-J1A-AO-02'];
  assert.equal(makeStudentId(2025, 'JSS 1A', 'Aisha Oni', taken), '2025-J1A-AO-03');
  assert.equal(makeStudentId(2025, 'JSS 1B', 'Aisha Oni', taken), '2025-J1B-AO-01');
});
