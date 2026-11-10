/**
 * Which school is this? Each school uses its own address (unity.classbridge.ng),
 * so the school is the first part of the address. In development set VITE_SCHOOL.
 * @returns {string}
 */
export function schoolSlug() {
  const fromEnv = import.meta.env?.VITE_SCHOOL;
  if (fromEnv) return fromEnv;
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  const first = host.split('.')[0];
  return host.includes('.') && first !== 'www' ? first : 'unity';
}
