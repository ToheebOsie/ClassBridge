/**
 * Invoice and payment rules. See docs/data-dictionary.md ("Invoice").
 *
 * @typedef {{ name: string, amount: number }} InvoiceItem
 * @typedef {'pending' | 'confirmed' | 'rejected'} PaymentStatus
 * @typedef {{ amount: number, status: PaymentStatus }} Payment
 * @typedef {{ items: InvoiceItem[], payments: Payment[] }} Invoice
 */
import { sumAmounts } from './money.js';

/** @param {Invoice} invoice */
export const invoiceTotal = (invoice) => sumAmounts(invoice.items);

/** Money the school has confirmed receiving. @param {Invoice} invoice */
export const confirmedTotal = (invoice) => sumAmounts(invoice.payments.filter((p) => p.status === 'confirmed'));

/** Money the parent has reported that the school has not yet confirmed. @param {Invoice} invoice */
export const pendingTotal = (invoice) => sumAmounts(invoice.payments.filter((p) => p.status === 'pending'));

/** What is still owed (confirmed payments only). @param {Invoice} invoice */
export const balance = (invoice) => invoiceTotal(invoice) - confirmedTotal(invoice);

/**
 * How much more a parent may report paying: the balance minus payments already waiting.
 * @param {Invoice} invoice
 */
export const payableRoom = (invoice) => balance(invoice) - pendingTotal(invoice);

/**
 * @param {Invoice} invoice
 * @returns {'paid' | 'part' | 'unpaid'}
 */
export function invoiceStatus(invoice) {
  if (balance(invoice) <= 0) return 'paid';
  return confirmedTotal(invoice) > 0 ? 'part' : 'unpaid';
}

/**
 * Can the head change the invoice total to `newTotal`? It may not fall below
 * what has already been confirmed as paid.
 * @param {Invoice} invoice
 * @param {number} newTotal
 */
export const canSetTotal = (invoice, newTotal) => newTotal >= confirmedTotal(invoice);
