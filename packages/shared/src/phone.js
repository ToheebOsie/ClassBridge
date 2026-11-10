/**
 * Nigerian phone numbers are written many ways (0803 555 0142, +234 803 555 0142,
 * 2348035550142). Sign-in and the guardian list must treat them as the same number.
 */

/**
 * Normalise to the local 11-digit form, e.g. "08035550142". Returns the cleaned
 * digits unchanged when the number is not a Nigerian mobile format.
 * @param {string} input
 * @returns {string}
 */
export function normalizePhone(input) {
  const digits = String(input).replace(/[^\d]/g, '');
  if (/^234\d{10}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^0\d{10}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `0${digits}`;
  return digits;
}
