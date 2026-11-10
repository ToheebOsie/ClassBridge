/**
 * Student ID rules. See docs/data-dictionary.md ("Student ID").
 *
 * Format: <year enrolled>-<class code>-<initials>-<sequence>
 * Example: 2025-J1A-AO-01
 *
 * The ID is issued once, at onboarding, and never changes. It stays with the
 * student after graduation (their records move to the archive, the ID does not).
 */

/**
 * Turn a class name such as "JSS 1A" or "SS 3B" into its short code ("J1A", "S3B").
 * @param {string} className
 * @returns {string}
 */
export function classCode(className) {
  const match = /^\s*(JSS|SS)\s*([1-3])\s*([A-Za-z]*)\s*$/i.exec(className);
  if (!match) throw new Error(`Unrecognised class name: "${className}"`);
  const level = match[1].toUpperCase() === 'JSS' ? 'J' : 'S';
  return `${level}${match[2]}${match[3].toUpperCase()}`;
}

/**
 * First letter of the first name and of the last name, in capitals.
 * A single name gives one letter.
 * @param {string} fullName
 * @returns {string}
 */
export function initialsOf(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new Error('A name is required to make a student ID');
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * Build a new student ID that is not already in `taken`.
 * The sequence number (01, 02, ...) separates students who share a year,
 * class and initials, so two IDs can never collide.
 * @param {number} year Year the student enrolled.
 * @param {string} className Class at enrolment, such as "JSS 1A".
 * @param {string} fullName
 * @param {string[]} taken Every ID already issued, including archived students.
 * @returns {string}
 */
export function makeStudentId(year, className, fullName, taken) {
  const base = `${year}-${classCode(className)}-${initialsOf(fullName)}`;
  for (let n = 1; n < 1000; n += 1) {
    const id = `${base}-${String(n).padStart(2, '0')}`;
    if (!taken.includes(id)) return id;
  }
  throw new Error(`No free sequence number left for ${base}`);
}

/** Classes offered when enrolling (arms A and B). A school will be able to configure its own later. */
export const CLASSES = ['JSS', 'SS'].flatMap((level) =>
  [1, 2, 3].flatMap((n) => ['A', 'B'].map((arm) => `${level} ${n}${arm}`)),
);

/** Class levels. Fees are the same for every arm of a level, so fee schedules are saved per level. */
export const LEVELS = ['JSS', 'SS'].flatMap((level) => [1, 2, 3].map((n) => `${level} ${n}`));

/** "JSS 1A" -> "JSS 1". @param {string} className */
export const levelOf = (className) => String(className).replace(/[A-Z]$/, '');
