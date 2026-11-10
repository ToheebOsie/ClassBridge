-- Invoices, payments and receipts: what the app needs beyond the core tables.
-- See docs/decisions/0006-two-step-receipt.md.

-- Numbers (INV-2026-0002, RCP-2026-0007): one counter per prefix and year, increased atomically.
CREATE TABLE counters (name text PRIMARY KEY, value integer NOT NULL);

ALTER TABLE invoices
  ADD COLUMN created_by uuid REFERENCES staff(id),
  ADD COLUMN seen_by_parent boolean NOT NULL DEFAULT false;  -- false = new or revised: shows a dot

ALTER TABLE payments
  ADD COLUMN submitted_by uuid REFERENCES guardians(id),
  ADD COLUMN decided_by uuid REFERENCES staff(id),
  ADD COLUMN decided_at timestamptz,
  ADD COLUMN parent_ack boolean NOT NULL DEFAULT true;       -- false = a rejection the parent has not seen

-- A receipt is a snapshot of what was sent. Editing the invoice later never changes it.
ALTER TABLE receipts
  ADD COLUMN payment_id uuid UNIQUE,                          -- one receipt per payment, ever
  ADD COLUMN items jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN total integer NOT NULL DEFAULT 0,
  ADD COLUMN term text,
  ADD COLUMN session text,
  ADD COLUMN method text,
  ADD COLUMN reference text,
  ADD COLUMN paid_on date,
  ADD COLUMN created_by uuid REFERENCES staff(id),
  ADD COLUMN seen_by_parent boolean NOT NULL DEFAULT false;

CREATE INDEX invoices_student ON invoices (student_id);
CREATE INDEX payments_invoice ON payments (invoice_id);
CREATE INDEX payments_status ON payments (status);
