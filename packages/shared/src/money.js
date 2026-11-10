/**
 * Money helpers. All amounts are whole naira stored as integers, never decimals,
 * so totals and balances can never drift by a fraction.
 */

/**
 * Format a whole-naira amount for display, e.g. 150000 -> "₦150,000".
 * @param {number} amount
 * @returns {string}
 */
export function formatNaira(amount) {
  const rounded = Math.round(Number(amount) || 0);
  return `₦${rounded.toLocaleString('en-NG')}`;
}

/**
 * Add up the `amount` field of a list of items.
 * @param {{ amount: number }[]} items
 * @returns {number}
 */
export function sumAmounts(items) {
  return items.reduce((total, item) => total + (Number(item.amount) || 0), 0);
}
