/**
 * Applies SQL migrations.
 *  - migrations/registry  -> the registry database (the list of schools)
 *  - migrations/school    -> EVERY school's own database
 * Each file runs once, in name order, and is recorded in schema_migrations.
 * Run with: npm run db:migrate   (see docs/setup.md)
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { config } from '../config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

async function ensureDatabase(name) {
  const admin = new pg.Client({ connectionString: `${config.dbBase}/postgres` });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${name.replace(/"/g, '')}"`);
  await admin.end();
}

/** Run every pending migration file from `dir` against database `dbName`. */
export async function migrate(dbName, dir) {
  await ensureDatabase(dbName);
  const client = new pg.Client({ connectionString: `${config.dbBase}/${dbName}` });
  await client.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = (await readdir(path.join(root, dir))).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(root, dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  applied ${dbName}: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${dbName}/${file} failed: ${err.message}`);
      }
    }
    return client.query('SELECT 1').then(() => files.length);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('Registry database');
  await migrate(config.registryDb, 'registry');
  const registry = new pg.Client({ connectionString: `${config.dbBase}/${config.registryDb}` });
  await registry.connect();
  const schools = (await registry.query('SELECT slug, db_name FROM schools ORDER BY slug')).rows;
  await registry.end();
  for (const school of schools) {
    console.log(`School ${school.slug}`);
    await migrate(school.db_name, 'school');
  }
  console.log('Done.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
