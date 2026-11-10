# Changelog

Add a line for every meaningful change, newest first.

## 0.3.0 – Teachers, parent invitations, fee schedules (2026-11-05)

- Teachers: the head adds a teacher; they choose their own password from an emailed link. Remove and restore (open sessions end at once), edit, one form teacher per class. Migration 004.
- Resend invitation for teachers and parents: the older link stops working, and a second send within 10 minutes is refused.
- Parents page: who has a password, who is waiting, resend.
- Saved fee schedules per class level and term; the invoice editor fills them in, warns across levels, and can save new ones. Sent invoices never change when a schedule changes.
- The invitation link page now also serves teachers and sends them to the teacher sign-in. 15 new API tests, 8 new web tests, and a browser end-to-end. Decision 0008.

## 0.2.0 – Invoices, payments and receipts (2026-11-04)

- API: invoices for one student or whole classes (one invoice per student, duplicates skipped, per-class batches, batch edit that skips individually changed invoices), parent payments with a required screenshot, two-step receipt (preview writes nothing, confirm is safe to repeat and creates an unchangeable receipt), rejection with a reason, WhatsApp messages (logged until connected). 47 API tests.
- Storage for screenshots behind a small interface, local disk for now (docs/decisions/0007).
- The school is found from the web address as well as the `x-school` header, so pictures load in the browser.
- Web: head Invoices page (editor, class review step, list, edit) and Payments page (screenshot, review receipt, send, not accepted); parent Invoices (payment form with screenshot checks on the device) and Fee receipts. Tests for each flow, and a browser end-to-end from invoice to receipt.

## 0.1.0 – Foundation (2026-11-03)

- Monorepo with web, API and shared packages (npm workspaces).
- Shared rules with tests: student ID format, money, invoice totals and status, permissions table, Zod validation schemas.
- API skeleton (Fastify): health check and roles endpoint. Database migrations for the registry and for each school's own database.
- Web app skeleton: React, Redux Toolkit, Tailwind design tokens, core components, component gallery.
- Documentation, ESLint, Prettier, test setup, Docker Postgres for development.
- Sign-in for all four roles in the API, with tests: parents choose their own password from a one-time invitation link (stored hashed), staff email and password, head also a security code, students Student ID and PIN. Sessions, failed-attempt limits, password reset by email, role protection.
- Decision: confirming a payment is two steps (review the receipt, then send); confirmation is idempotent (docs/decisions/0006).
- Web: sign-in page for each role, choose-a-password page, role home with its own sidebar, head's Students and IDs page (onboarding form, student list). Student onboarding in the API (ID, PIN, parent linking, invitation) with tests, including duplicate and simultaneous-onboarding cases. Browser end-to-end check against the real API.
