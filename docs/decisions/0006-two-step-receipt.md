# 0006 Confirming a payment is two steps: review, then send

**Date:** 2026-11-03 · **Status:** accepted

**Decision.** When the head confirms a parent's payment, the receipt is sent automatically, but never from a single click.

1. **Review receipt:** the head enters the amount actually received. The app shows the exact receipt that will be sent (number, amounts, balance after). Nothing is created or sent yet.
2. **Send receipt to parent:** only this creates the receipt and notifies the parent (WhatsApp).
   "Go back and change" returns to step 1 with the typed amount kept. Leaving the page closes the review.

**Rules for the API.**

- Creating the receipt and marking the payment confirmed happen in one database transaction.
- Confirming is **idempotent**: a payment that is already confirmed cannot create a second receipt, even if the request is repeated (double click, retry).
- The amount is checked again on send (it must be at least 1 and no more than the balance), because the balance may have changed since the review.
- A sent receipt cannot be edited. A mistake is corrected with a new, clearly linked correction, never by changing the sent one.

**Why.** A confirmation reaches a parent and is a financial record. One mis-click should not be able to send it.
