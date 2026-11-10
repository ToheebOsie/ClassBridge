import pg from 'pg';
import { config } from '../config.js';

const pools = new Map();

/**
 * One connection pool per database. Every school has its own database, so the
 * code asks for the pool of the school making the request, never a shared one.
 * @param {string} dbName
 * @returns {import('pg').Pool}
 */
export function poolFor(dbName) {
  if (!pools.has(dbName)) pools.set(dbName, new pg.Pool({ connectionString: `${config.dbBase}/${dbName}`, max: 10 }));
  return pools.get(dbName);
}

export async function closeAll() {
  await Promise.all([...pools.values()].map((p) => p.end()));
  pools.clear();
}
