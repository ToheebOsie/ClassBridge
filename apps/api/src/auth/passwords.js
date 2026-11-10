/**
 * Password hashing and generation. Nothing in the database is ever readable.
 * Uses scrypt from Node's built-in crypto (no extra dependency).
 */
import { randomBytes, randomInt, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 16384,
  R = 8,
  P = 1,
  KEYLEN = 32;

/**
 * @param {string} plain
 * @returns {Promise<string>} "scrypt$N$r$p$salt$hash"
 */
export async function hashSecret(plain) {
  const salt = randomBytes(16);
  const key = /** @type {Buffer} */ (await scryptAsync(plain, salt, KEYLEN, { N, r: R, p: P }));
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * @param {string} plain
 * @param {string | null | undefined} stored
 * @returns {Promise<boolean>}
 */
export async function verifySecret(plain, stored) {
  if (!stored) return false;
  const [kind, n, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = /** @type {Buffer} */ (
    await scryptAsync(plain, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p })
  );
  return timingSafeEqual(key, expected);
}

/** Used when no account exists, so the response takes as long as a real check. */
export const DUMMY_HASH = await hashSecret('not-a-real-password');

/** A 4-digit PIN for students. @returns {string} */
export const generatePin = () => String(randomInt(0, 10000)).padStart(4, '0');

/** Random token for sessions and reset links. @returns {string} */
export const newToken = () => randomBytes(32).toString('base64url');

/** Tokens are stored hashed too. @param {string} token */
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
