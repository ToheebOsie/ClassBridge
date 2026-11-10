# Architecture

## Pieces

- **apps/web:** the web app (React, Redux Toolkit, Tailwind). Talks to the API only.
- **apps/api:** the Node.js API. All business rules are enforced here.
- **packages/shared:** plain JavaScript used by every app: student ID rules, money, invoice maths, the permissions table and the Zod schemas.
- **Mobile (later):** React Native (Expo). It will reuse `packages/shared`, the Redux slices and the API client. Only the screens are rewritten.

## One database per school

A **registry** database lists every school and the name of its own database. Each school's data (students, staff, invoices...) lives only in that school's database. A request first finds the school (from the sign-in), then uses that school's connection pool (`apps/api/src/db/pool.js`). Migrations in `apps/api/migrations/school` run against every school's database (`npm run db:migrate`).

## Roles and permissions

Four roles: teacher, parent, student, head. Each has its own sign-in page and sidebar. The table of allowed actions is in `packages/shared/src/permissions.js`. The **API checks it on every request**. The apps use the same table only to decide what to show, never as the actual protection.

## Where code goes

- A new rule used by more than one app -> `packages/shared`, with a test.
- A new API feature -> one file in `apps/api/src/routes`, registered in `app.js`, with a test in `apps/api/test`. Validate input with a Zod schema from `packages/shared`.
- A new table or column -> a new numbered SQL file in `apps/api/migrations/school` (never edit an old one), and update `docs/data-dictionary.md`.
- A new screen -> `apps/web/src/pages`, built from `apps/web/src/components`.
- Server data in the web app (invoices, students) will use RTK Query. Redux slices hold only interface state (signed-in role, current exam, colour).

## Money, dates and IDs

- Money is whole naira as integers. Use `formatNaira` to display.
- A student's ID is made once by `makeStudentId` and never changes, even after graduation.
- Dates are stored as dates (`YYYY-MM-DD`), times as UTC timestamps.

## Sign-in

Each role has its own sign-in endpoint (`/api/auth/:role/login`) and, later, its own page in the apps. The code is in `apps/api/src/auth` (hashing, limiter, service) and `apps/api/src/routes/auth.js`. To protect any other route use `{ preHandler: app.requireRole('head') }`. The web app uses an HttpOnly cookie; mobile uses `Authorization: Bearer`. Details and reasons: `docs/decisions/0005-parent-sign-in.md`. The API finds the school from the `x-school` header (looked up in the registry).

## Student onboarding

`POST /api/students` (head only) does everything in one database transaction (`apps/api/src/students/service.js`): refuses duplicates (same admission number, or same name and date of birth, including archived students), issues the Student ID, creates or finds the parent by phone number (one account per number), links them, and creates the student's PIN (shown once to the head, stored hashed). The parent is then sent one invitation (WhatsApp and email) if they have no password and no open invitation. If two students are onboarded at the same moment and pick the same ID, the database refuses the second and it retries with the next number.

## Web pages

`/` school front page · `/:role/sign-in` one sign-in page per role · `/:role` that role's home with its sidebar · `/set-password?token=` parent chooses a password · `/gallery` design reference. Server calls go through one RTK Query file, `apps/web/src/store/api.js`.

## Invoices, payments and receipts

Routes are in `apps/api/src/routes/invoices.js` (list at the top of the file); the rules are in `apps/api/src/invoices/service.js`.

- One invoice per student, term, session and title. A class invoice creates one invoice per student, in one batch.
- Numbers (`INV-<year>-NNNN`, `RCP-<year>-NNNN`) come from the `counters` table with an atomic upsert, so they never repeat.
- A parent may pay only up to the balance minus payments still waiting, and must attach a screenshot. Only confirmed payments count towards "paid".
- The head confirms in two steps. `preview` writes nothing. `confirm` locks the payment, creates the receipt in one transaction and is safe to repeat. The receipt keeps its own copy of the items and total, so later invoice edits never change it.
- The invoice total cannot be edited below what is already confirmed.
- Screenshots: see decision 0007. WhatsApp failures never fail the action.
- Web: `pages/InvoicesPage.jsx`, `PaymentsPage.jsx`, `ParentInvoices.jsx`; the printed look is `components/Papers.jsx`.

## Teachers, parents' invitations and fee schedules

Routes: `apps/api/src/routes/people.js` (staff, guardians) and `routes/fees.js`. Rules: `staff/service.js`, `guardians/service.js`, `fees/service.js`. Decision: 0008.

- A link (`password_tokens`) belongs to a parent or a teacher. Choosing a password with it works once; a newer invitation cancels the older link.
- Resend is refused for 10 minutes after the last send (`created_at`).
- Removing a teacher sets `status = 'removed'` and deletes their sessions; `resolveSession` also refuses removed staff.
- Fee schedules are copied into an invoice by the web editor. The API never links an invoice to a schedule.
- Web: `pages/TeachersPage.jsx`, `ParentsPage.jsx`, `FeeSchedulesPage.jsx`; the editor logic is in `InvoicesPage.jsx`.

## Not built yet

WhatsApp and email sending (messages are only logged for now), cloud storage for screenshots, PDF generation. Each will get a decision note and a section here when it is added.
