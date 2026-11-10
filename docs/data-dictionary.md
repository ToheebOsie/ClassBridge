# Data dictionary

Tables inside **one school's database**. The SQL is in `apps/api/migrations/school/001_core.sql`. The registry database has one table, `schools`.

## Student ID

Format `<year enrolled>-<class code>-<initials>-<sequence>`, for example `2025-J1A-AO-01`. Created by `makeStudentId` in `packages/shared/src/ids.js`. Issued once at onboarding and never changed. It is the primary key of `students` and is used in every table that refers to a student. Graduated students keep it; their records are archived, not deleted.

| Table               | Meaning                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staff`             | Teachers and the head. `status`: invited, active, removed. A removed member cannot sign in. `form_class` is the class they are form teacher of.                                                     |
| `students`          | One row per student ever enrolled. `status`: active, graduated, left. `current_class` is empty after graduation. `(full_name, date_of_birth)` is unique so the same child cannot be enrolled twice. |
| `guardians`         | Parents or guardians, identified by phone number (used for WhatsApp and sign-in).                                                                                                                   |
| `student_guardians` | Which guardian can see which student. A parent sees only their own children.                                                                                                                        |
| `invoice_batches`   | A group of invoices sent to a class together, so the head can filter and edit them as a set.                                                                                                        |
| `invoices`          | One invoice for one student, with a term, session and title. A student can have only one invoice per term, session and title. `customised` means it was changed on its own after a class batch.     |
| `invoice_items`     | The fee lines of an invoice. `amount` is whole naira and must be above zero.                                                                                                                        |
| `payments`          | A payment a parent reports, with a screenshot. `status`: pending, confirmed, rejected. Only confirmed payments count towards the balance.                                                           |
| `sessions`          | A signed-in session. Only a hash of the token is stored. `subject_id` is the staff id, guardian id or Student ID. Expired and deleted sessions no longer work.                                      |
| `password_tokens`   | One-time links that let a parent choose a password: `invite` (valid 30 days) and `reset` (60 minutes). Hash only; `used_at` is set when used.                                                       |
| `receipts`          | Created automatically when the head confirms a payment. Records the amount paid and the balance before and after.                                                                                   |

Invoice status is worked out, not stored: unpaid, part paid, or paid in full (`invoiceStatus` in `packages/shared/src/invoices.js`).

## Sign-in fields

Passwords, student PINs and the head's security code are stored only as salted hashes (`guardians.password_hash`, `students.pin_hash`, `staff.password_hash`, `staff.security_code_hash`). A guardian with no `password_hash` has not yet chosen a password.

## Invoices, payments and receipts

- `counters(name, value)`: last number used for `INV` and `RCP` per year name. Updated atomically.
- `invoices`: one per student, term, session and title. `batch_id` links a class batch. `customised` = changed on its own, so a batch edit skips it. `revised`, `seen_by_parent` drive the parent's "new or revised" dot. `created_by` is the staff member.
- `invoice_items(invoice_id, position, name, amount)`: whole naira.
- `payments`: `status` pending, confirmed or rejected. `screenshot_key` points into storage. `parent_ack` is false until the parent has seen a rejection. `submitted_by` is the guardian; `decided_by` and `decided_at` the staff member.
- `receipts`: `payment_id` is unique (one receipt per payment). `items` (jsonb) and `total` are a snapshot taken when sent and never change. `seen_by_parent` drives the receipts dot.

## Teachers and fee schedules

- `staff.subjects` (text[]), `staff.form_class`. `status`: invited (no password yet), active, removed. Email is unique case-insensitively (`staff_email_lower`).
- `password_tokens` now has `staff_id` as well as `guardian_id` (exactly one is set) and `created_at`.
- `fee_schedules(level, term, title, updated_by, updated_at)`: unique per level and term. `level` looks like `JSS 1`.
- `fee_schedule_items(schedule_id, position, name, amount)`: whole naira.
