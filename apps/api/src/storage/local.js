/**
 * File storage for payment screenshots. This version keeps files on the server's disk.
 * Every storage (local now, cloud later) has the same two methods, so swapping it is a one-file change:
 *   put(key, buffer) and get(key) -> Buffer | null.
 * See docs/decisions/0007-screenshot-storage.md.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createLocalStorage(rootDir) {
  const resolve = (key) => {
    const full = path.resolve(rootDir, key);
    if (!full.startsWith(path.resolve(rootDir) + path.sep)) throw new Error('Bad storage key');
    return full;
  };
  return {
    async put(key, buffer) {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, buffer);
    },
    async get(key) {
      try {
        return await readFile(resolve(key));
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },
  };
}

/** In-memory storage for tests. */
export function createMemoryStorage() {
  const files = new Map();
  return {
    async put(key, buffer) {
      files.set(key, buffer);
    },
    async get(key) {
      return files.get(key) ?? null;
    },
    files,
  };
}
