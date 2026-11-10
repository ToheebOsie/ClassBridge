/**
 * Who may do what. The API enforces these rules on every request; the web and
 * mobile apps use the same table only to decide what to show.
 * See docs/architecture.md ("Roles and permissions").
 */

export const ROLES = /** @type {const} */ (['teacher', 'parent', 'student', 'head']);

/** @typedef {typeof ROLES[number]} Role */

/** Every action is a "thing.verb" string so the table below stays readable. */
const TABLE = {
  'assessment.score': ['teacher'],
  'cbt.run': ['teacher'],
  'cbt.sit': ['student'],
  'report.view-own': ['parent', 'student'],
  'report.approve': ['head'],
  'promotion.recommend': ['head'],
  'promotion.approve': ['head'],
  'teachers.manage': ['head'],
  'students.onboard': ['head'],
  'parents.invite': ['head'],
  'fees.schedule': ['head'],
  'invoice.manage': ['head'],
  'invoice.view-own': ['parent'],
  'payment.submit': ['parent'],
  'payment.confirm': ['head'],
  'receipt.view-own': ['parent'],
  'exam-paper.download': ['teacher'],
};

/**
 * @param {Role} role
 * @param {keyof typeof TABLE} action
 * @returns {boolean}
 */
export function can(role, action) {
  return (TABLE[action] || []).includes(role);
}

/** @returns {string[]} Every action a role may perform. @param {Role} role */
export const actionsFor = (role) => Object.keys(TABLE).filter((a) => can(role, /** @type {any} */ (a)));
