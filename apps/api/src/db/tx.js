/**
 * Run `fn(tx)` inside one database transaction: everything inside it is saved together,
 * or nothing is. Works with a pg Pool (production) and PGlite (tests).
 */
export async function withTransaction(db, fn) {
  if (typeof db.transaction === 'function') return db.transaction((tx) => fn(tx));
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
