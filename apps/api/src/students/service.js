/**
 * Student onboarding. See docs/data-dictionary.md ("Student ID") and docs/decisions/0005.
 *
 * One call does it all, in one transaction: checks for duplicates, issues the Student ID,
 * creates (or finds) the parent or guardian, links them, and makes the student's PIN.
 */
import { makeStudentId, normalizePhone } from '@classbridge/shared';
import { withTransaction } from '../db/tx.js';
import { generatePin, hashSecret } from '../auth/passwords.js';

export class OnboardError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

const isUniqueViolation = (err, name) =>
  err?.code === '23505' && (!name || String(err.constraint || err.message).includes(name));

/**
 * @param {{ query: Function }} db
 * @param {import('zod').infer<typeof import('@classbridge/shared').studentOnboardSchema>} input
 * @returns {Promise<{ student: object, pin: string, guardian: { id: string, existing: boolean, needsInvitation: boolean } }>}
 */
export async function onboardStudent(db, input) {
  const phone = normalizePhone(input.guardian.phone);
  const pin = generatePin();
  const pinHash = await hashSecret(pin);

  // Two people onboarding at the same moment could pick the same sequence number.
  // The database refuses the second, and we simply try again with the next number.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const done = await withTransaction(db, async (tx) => {
        const q = async (sql, params) => (await tx.query(sql, params)).rows;

        // The same child must never be enrolled twice, even if they graduated or left years ago.
        const dup = await q(
          'SELECT id, status FROM students WHERE admission_no = $1 OR (lower(full_name) = lower($2) AND date_of_birth = $3)',
          [input.admissionNo, input.fullName, input.dateOfBirth],
        );
        if (dup.length) {
          const old = dup[0];
          throw new OnboardError(
            `This student is already enrolled with ID ${old.id}${old.status === 'active' ? '' : ` (${old.status}, in the archive)`}. A student is never given a second ID.`,
          );
        }

        const taken = (await q('SELECT id FROM students')).map((r) => r.id);
        const id = makeStudentId(input.enrolYear, input.enrolClass, input.fullName, taken);
        await q(
          'INSERT INTO students (id, admission_no, full_name, date_of_birth, enrol_year, enrol_class, current_class, pin_hash) VALUES ($1, $2, $3, $4, $5, $6, $6, $7)',
          [id, input.admissionNo, input.fullName, input.dateOfBirth, input.enrolYear, input.enrolClass, pinHash],
        );

        // One account per phone number: a parent with several children sees them all.
        let g = (await q('SELECT id, password_hash FROM guardians WHERE phone = $1', [phone]))[0];
        const existing = !!g;
        if (!g)
          g = (
            await q('INSERT INTO guardians (full_name, phone, email) VALUES ($1, $2, $3) RETURNING id, password_hash', [
              input.guardian.fullName,
              phone,
              input.guardian.email || null,
            ])
          )[0];
        else if (input.guardian.email)
          await q('UPDATE guardians SET email = COALESCE(email, $1) WHERE id = $2', [input.guardian.email, g.id]);
        await q('INSERT INTO student_guardians (student_id, guardian_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
          id,
          g.id,
        ]);

        return { id, guardianId: g.id, existing, needsInvitation: !g.password_hash };
      });

      return {
        student: {
          id: done.id,
          fullName: input.fullName,
          admissionNo: input.admissionNo,
          enrolYear: input.enrolYear,
          enrolClass: input.enrolClass,
        },
        pin,
        guardian: { id: done.guardianId, existing: done.existing, needsInvitation: done.needsInvitation },
      };
    } catch (err) {
      if (isUniqueViolation(err, 'students_pkey')) continue;
      if (isUniqueViolation(err, 'admission_no') || isUniqueViolation(err, 'full_name'))
        throw new OnboardError('This student is already enrolled. A student is never given a second ID.');
      throw err;
    }
  }
  throw new OnboardError('Could not issue a free Student ID. Please try again.', 503);
}

/** Students for the head's list, newest first. Archived students are included and marked. */
export async function listStudents(db, { status } = {}) {
  const { rows } = await db.query(
    'SELECT id, full_name, admission_no, enrol_year, enrol_class, current_class, status FROM students WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC, id',
    [status ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    admissionNo: r.admission_no,
    enrolYear: r.enrol_year,
    enrolClass: r.enrol_class,
    currentClass: r.current_class,
    status: r.status,
  }));
}
