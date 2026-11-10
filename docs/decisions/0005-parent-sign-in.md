# 0005 Parent sign-in: phone number and a password the parent chooses

**Date:** 2026-11-03 (updated 2026-11-04) · **Status:** accepted

**Decision.**

- A parent signs in with their **phone number** and a **password they choose themselves**.
- When the school onboards the family, the system sends **one invitation** by WhatsApp and by email (to the details the parent gave). It contains a link where the parent chooses a password. The school never sees or sets the password, and no password is ever sent.
- The invitation link stays valid for **30 days** and works once. The password never expires.
- A forgotten password is reset with a **link sent by email** (free, valid 60 minutes). A parent with no email asks the head, who can resend an invitation.
- Parents can change their password at any time; they are never forced to.
- One account per phone number. It shows every child linked to that guardian.

**Why.** Sending a code at every sign-in makes WhatsApp and SMS costs grow with every login. A permanent password costs one message per family. Letting the parent choose it (instead of the system generating and sending it) means a password never travels through WhatsApp or email and nobody at the school ever knows it.

**Storage.** Passwords are stored as **salted scrypt hashes**, never readable. A database leak would then not expose passwords, which people reuse elsewhere, and this is far easier to defend under the Nigeria Data Protection Act (a lawyer should review). Because a hash cannot be read back, "resend my password" is replaced by the reset link.

**Safeguards.**

- Failed attempts: 5 per account then a 15 minute lock, plus a separate, much larger limit per network address (many families share one mobile-network address).
- The same message for wrong password and unknown number, and the same work is done either way, so nobody can discover which numbers are registered.
- Sign-in cookie is HttpOnly and SameSite=Strict. Tokens are stored hashed. The mobile apps use a bearer token instead of the cookie.
- Phone numbers are normalised, so `0803 555 0142`, `+234 803 555 0142` and `2348035550142` are the same account.

**Other roles** (see `apps/api/src/auth/service.js`)

- Teacher: staff email and a password they choose from an emailed invitation link (decision 0008). A removed teacher cannot sign in and their open sessions stop working immediately.
- Head: email, password and a security code. Sessions last 12 hours.
- Student: Student ID and a 4-digit PIN.
- Session length: parent and student 30 days, teacher 7 days, head 12 hours.

**Gave up.** The convenience of "resend my password". A parent who loses both the invitation and access to their email needs the head's help.
