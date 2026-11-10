# 0008 Teacher accounts, resending invitations, and saved fee schedules

**Date:** 2026-11-05 · **Status:** accepted

## Teachers

- Only the head adds teachers (name, email, optional form class, subjects). **No password is set by the school.** The teacher gets one email with a link to choose their own password, the same way parents do (decision 0005). Until they do, the account shows "Invitation sent" and cannot sign in.
- The sign-in is the email address (stored in lower case; one account per email).
- One active teacher per form class. Removing a teacher frees their class.
- **Remove** blocks sign-in and ends open sessions at once. Their records stay. **Restore** brings them back, with the password they chose.
- A teacher who forgot their password asks the head for a new link. Only teacher accounts can be sent links; the head's account cannot be reached through these routes.

## Resending invitations (teachers and parents)

- A new invitation **cancels the older link**, so only the latest one works.
- A second send within **10 minutes** is refused and sends nothing. This stops a double click costing two WhatsApp messages and email sends.
- The Parents page shows who has a password, who is waiting, and whose link expired, and the head can resend from there.

## Saved fee schedules

- One schedule per **class level** (JSS 1, SS 3...) and **term**. Fees are the same for every arm of a level.
- A schedule is a **starting point**. Using it copies the items into the invoice; nothing stays linked, so changing a schedule never changes an invoice already sent.
- In the invoice editor, the saved fees fill in automatically while no amounts have been typed, and a button applies them any time. If the classes chosen span several levels, the editor warns instead of guessing, because the levels may differ.
- The head can also save the fees they just typed as the schedule for that level and term.
- Session (for example 2026/2027) is not part of a schedule, because the head reviews fees each year.

## Gave up

Per-arm schedules (JSS 1A different from 1B) and fee items that differ by student (scholarships, siblings). The head can still change an individual invoice after sending.
