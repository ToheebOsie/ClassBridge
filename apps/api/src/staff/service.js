/**
 * Teachers: the head adds them, they choose their own password from an emailed link,
 * and the head can remove or restore them. Removing ends their sessions at once.
 * `db` is a pg Pool or PGlite.
 */
export class StaffError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const isUnique = (err, name) => err?.code === '23505' && String(err.constraint || err.message).includes(name);
const shape = (r) => ({
  id: r.id,
  fullName: r.full_name,
  email: r.email,
  formClass: r.form_class,
  subjects: r.subjects,
  status: r.status, // invited (no password yet), active, removed
  createdAt: r.created_at,
});
const COLUMNS = 'id, full_name, email, form_class, subjects, status, created_at';

/** Only one active teacher may be the form teacher of a class. */
async function checkFormClass(db, formClass, exceptId) {
  if (!formClass) return;
  const { rows } = await db.query(
    "SELECT full_name FROM staff WHERE role = 'teacher' AND status <> 'removed' AND form_class = $1 AND ($2::uuid IS NULL OR id <> $2)",
    [formClass, exceptId ?? null],
  );
  if (rows[0]) throw new StaffError(`${rows[0].full_name} is already the form teacher of ${formClass}.`, 409);
}

export async function listTeachers(db) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM staff WHERE role = 'teacher' ORDER BY (status = 'removed'), full_name`,
  );
  return rows.map(shape);
}

export async function createTeacher(db, input) {
  await checkFormClass(db, input.formClass);
  try {
    const { rows } = await db.query(
      `INSERT INTO staff (email, full_name, role, form_class, subjects, status) VALUES ($1, $2, 'teacher', $3, $4, 'invited') RETURNING ${COLUMNS}`,
      [input.email, input.fullName, input.formClass || null, input.subjects],
    );
    return shape(rows[0]);
  } catch (err) {
    if (isUnique(err, 'email')) throw new StaffError('Someone with this email already has an account.', 409);
    throw err;
  }
}

export async function updateTeacher(db, id, input) {
  await checkFormClass(db, input.formClass, id);
  const { rows } = await db.query(
    `UPDATE staff SET full_name = $1, form_class = $2, subjects = $3 WHERE id = $4 AND role = 'teacher' RETURNING ${COLUMNS}`,
    [input.fullName, input.formClass || null, input.subjects, id],
  );
  if (!rows[0]) throw new StaffError('We could not find that teacher.', 404);
  return shape(rows[0]);
}

/** Remove a teacher (they cannot sign in; records stay) or restore them. Sessions are ended by the caller. */
export async function setTeacherRemoved(db, id, removed) {
  const { rows } = await db.query(
    "SELECT status, password_hash, form_class FROM staff WHERE id = $1 AND role = 'teacher'",
    [id],
  );
  const t = rows[0];
  if (!t) throw new StaffError('We could not find that teacher.', 404);
  if (removed) {
    await db.query("UPDATE staff SET status = 'removed', form_class = NULL WHERE id = $1", [id]);
  } else {
    await db.query('UPDATE staff SET status = $1 WHERE id = $2', [t.password_hash ? 'active' : 'invited', id]);
  }
  const out = await db.query(`SELECT ${COLUMNS} FROM staff WHERE id = $1`, [id]);
  return shape(out.rows[0]);
}
