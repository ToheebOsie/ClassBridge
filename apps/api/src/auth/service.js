/**
 * Sign-in logic for all four roles. It talks to a database object with a
 * `query(sql, params)` method (a pg Pool in production, PGlite in tests).
 * See docs/decisions/0005-parent-sign-in.md.
 */
import { normalizePhone } from '@classbridge/shared';
import { DUMMY_HASH, hashSecret, hashToken, newToken, verifySecret } from './passwords.js';

/** How long a signed-in session lasts. Staff sessions are shorter: they can change school records. */
const SESSION_HOURS = { parent: 24 * 30, student: 24 * 30, teacher: 24 * 7, head: 12 };
/** Reset links are short-lived. Invitations last longer so the school does not pay to resend them. */
const TOKEN_MINUTES = { reset: 60, invite: 30 * 24 * 60 };

export const MESSAGES = {
  badCredentials: 'Those details do not match. Check them and try again.',
  removed: 'This account has been deactivated. Please contact the school office.',
};

export function createAuthService({ db, limiter, mailer, whatsapp, now = () => new Date() }) {
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];

  /** Find the account for a role. Returns { id, name, hash, status, extra? } or undefined. */
  const accounts = {
    async parent(c) {
      const r = await one('SELECT id, full_name, password_hash FROM guardians WHERE phone = $1', [
        normalizePhone(c.phone),
      ]);
      return r && { id: r.id, name: r.full_name, hash: r.password_hash, status: 'active' };
    },
    async teacher(c) {
      const r = await one(
        "SELECT id, full_name, password_hash, status FROM staff WHERE lower(email) = lower($1) AND role = 'teacher'",
        [c.email],
      );
      return r && { id: r.id, name: r.full_name, hash: r.password_hash, status: r.status };
    },
    async head(c) {
      const r = await one(
        "SELECT id, full_name, password_hash, security_code_hash, status FROM staff WHERE lower(email) = lower($1) AND role = 'head'",
        [c.email],
      );
      return (
        r && { id: r.id, name: r.full_name, hash: r.password_hash, status: r.status, codeHash: r.security_code_hash }
      );
    },
    async student(c) {
      const r = await one('SELECT id, full_name, pin_hash, status FROM students WHERE id = $1', [c.studentId]);
      return (
        r && { id: r.id, name: r.full_name, hash: r.pin_hash, status: r.status === 'active' ? 'active' : 'removed' }
      );
    },
  };
  /** Which field of the credentials is the secret, and what identifies the account. */
  const shape = {
    parent: { secret: (c) => c.password, who: (c) => normalizePhone(c.phone) },
    teacher: { secret: (c) => c.password, who: (c) => c.email.toLowerCase() },
    head: { secret: (c) => c.password, who: (c) => c.email.toLowerCase() },
    student: { secret: (c) => c.pin, who: (c) => c.studentId },
  };

  /**
   * Make a single-use link token for a guardian (`{ guardianId }`) or a teacher (`{ staffId }`).
   * Only its hash is stored. A new invitation cancels any older open one, so only the latest link works.
   */
  async function issueToken(owner, purpose) {
    const token = newToken();
    const col = owner.staffId ? 'staff_id' : 'guardian_id';
    const id = owner.staffId ?? owner.guardianId;
    if (purpose === 'invite')
      await db.query(
        `UPDATE password_tokens SET used_at = $1 WHERE ${col} = $2 AND purpose = 'invite' AND used_at IS NULL`,
        [now(), id],
      );
    await db.query(
      `INSERT INTO password_tokens (token_hash, ${col}, purpose, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [hashToken(token), id, purpose, new Date(now().getTime() + TOKEN_MINUTES[purpose] * 60_000), now()],
    );
    return token;
  }

  /** Resending is allowed again only after this many minutes, so a double click does not cost two messages. */
  const RESEND_WAIT_MINUTES = 10;
  async function sentRecently(owner) {
    const col = owner.staffId ? 'staff_id' : 'guardian_id';
    const r = await one(
      `SELECT 1 AS x FROM password_tokens WHERE ${col} = $1 AND purpose = 'invite' AND created_at > $2`,
      [owner.staffId ?? owner.guardianId, new Date(now().getTime() - RESEND_WAIT_MINUTES * 60_000)],
    );
    return Boolean(r);
  }
  const tooSoon = {
    ok: false,
    sent: false,
    tooSoon: true,
    message: `An invitation was sent a few minutes ago. Please wait ${RESEND_WAIT_MINUTES} minutes before sending another.`,
  };

  async function createSession(role, subjectId) {
    const token = newToken();
    const expires = new Date(now().getTime() + SESSION_HOURS[role] * 3600_000);
    await db.query('INSERT INTO sessions (token_hash, role, subject_id, expires_at) VALUES ($1, $2, $3, $4)', [
      hashToken(token),
      role,
      subjectId,
      expires,
    ]);
    return { token, expires };
  }

  return {
    /**
     * @param {'parent'|'teacher'|'head'|'student'} role
     * @param {object} creds validated with the role's schema from @classbridge/shared
     * @param {string} [ip]
     * @returns {Promise<{ ok: true, token: string, expires: Date, user: { id: string, name: string, role: string } } | { ok: false, message: string, retryAfterSeconds?: number }>}
     */
    async login(role, creds, ip = 'unknown') {
      // Two limits: strict per account (5 tries), generous per address (many families share one
      // mobile-network or school address, so it must not lock everybody out).
      const acctKey = `${role}:${shape[role].who(creds)}`;
      const checks = [limiter.account.check(acctKey), limiter.ip.check(ip)];
      const blocked = checks.find((c) => !c.allowed);
      if (blocked)
        return {
          ok: false,
          message: `Too many attempts. Try again in ${Math.ceil(blocked.retryAfterSeconds / 60)} minutes.`,
          retryAfterSeconds: blocked.retryAfterSeconds,
        };
      const acct = await accounts[role](creds);
      // Always do the same amount of work, so timing does not reveal whether an account exists.
      const secretOk = await verifySecret(shape[role].secret(creds), acct?.hash ?? DUMMY_HASH);
      const codeOk = role === 'head' ? await verifySecret(creds.securityCode, acct?.codeHash ?? DUMMY_HASH) : true;
      if (!acct || !secretOk || !codeOk || !acct.hash) {
        limiter.account.fail(acctKey);
        limiter.ip.fail(ip);
        return { ok: false, message: MESSAGES.badCredentials };
      }
      if (acct.status === 'removed') return { ok: false, message: MESSAGES.removed };
      if (acct.status !== 'active') return { ok: false, message: MESSAGES.badCredentials };
      limiter.account.reset(acctKey);
      const { token, expires } = await createSession(role, acct.id);
      return { ok: true, token, expires, user: { id: acct.id, name: acct.name, role } };
    },

    /** Find the person behind a session token, or null. Removed staff and students lose access at once. */
    async resolveSession(token) {
      if (!token) return null;
      const s = await one('SELECT role, subject_id FROM sessions WHERE token_hash = $1 AND expires_at > $2', [
        hashToken(token),
        now(),
      ]);
      if (!s) return null;
      const table = {
        teacher: ['staff', 'full_name'],
        head: ['staff', 'full_name'],
        parent: ['guardians', 'full_name'],
        student: ['students', 'full_name'],
      }[s.role];
      const u = await one(
        `SELECT id, ${table[1]} AS name${table[0] === 'guardians' ? '' : ', status'} FROM ${table[0]} WHERE id = $1`,
        [s.subject_id],
      );
      if (!u || u.status === 'removed' || u.status === 'left') return null;
      return { id: u.id, name: u.name, role: s.role };
    },

    async logout(token) {
      if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    },

    /** End every session of a person, e.g. when the head removes a teacher. */
    async endAllSessions(role, subjectId) {
      await db.query('DELETE FROM sessions WHERE role = $1 AND subject_id = $2', [role, subjectId]);
    },

    /**
     * Invite a parent: send ONE message, by WhatsApp and by email, with a link where they
     * choose their own password. The school never sees or sets the password.
     * @param {string} guardianId
     * @param {(token: string) => string} linkFor builds the full link from the token
     * @param {{ force?: boolean }} [options] force = the head asked to resend
     */
    async inviteGuardian(guardianId, linkFor, { force = false } = {}) {
      const g = await one('SELECT id, full_name, phone, email, password_hash FROM guardians WHERE id = $1', [
        guardianId,
      ]);
      if (!g) return { ok: false, sent: false, message: 'Guardian not found.' };
      if (g.password_hash && !force) return { ok: true, sent: false };
      // A second child of the same parent must not cost a second message while the first invitation is still open.
      if (force && (await sentRecently({ guardianId }))) return tooSoon;
      if (!force) {
        const open = await one(
          "SELECT 1 AS x FROM password_tokens WHERE guardian_id = $1 AND purpose = 'invite' AND used_at IS NULL AND expires_at > $2",
          [guardianId, now()],
        );
        if (open) return { ok: true, sent: false };
      }
      const link = linkFor(await issueToken({ guardianId: g.id }, 'invite'));
      const text = `Hello ${g.full_name}, your school has set up ClassBridge for you. Open this link to choose your password: ${link} (Your sign-in is your phone number.)`;
      if (whatsapp) await whatsapp.send({ to: g.phone, text });
      if (g.email && mailer)
        await mailer.send({ to: g.email, subject: 'Welcome to ClassBridge: choose your password', text });
      return { ok: true, sent: true };
    },

    /**
     * Invite a teacher by email: a link where they choose their own password. Used for the first
     * invitation and, later, when a teacher forgot their password and asks the head.
     * Only teacher accounts get links; the head's account is never reachable this way.
     * @param {string} staffId
     * @param {(token: string) => string} linkFor
     */
    async inviteStaff(staffId, linkFor) {
      const t = await one("SELECT id, full_name, email, status FROM staff WHERE id = $1 AND role = 'teacher'", [
        staffId,
      ]);
      if (!t) return { ok: false, sent: false, message: 'We could not find that teacher.' };
      if (t.status === 'removed') return { ok: false, sent: false, message: MESSAGES.removed };
      if (await sentRecently({ staffId })) return tooSoon;
      const link = linkFor(await issueToken({ staffId: t.id }, 'invite'));
      if (mailer)
        await mailer.send({
          to: t.email,
          subject: 'Your ClassBridge account: choose your password',
          text: `Hello ${t.full_name}, the school has set up your ClassBridge account. Open this link to choose your password: ${link} (Your sign-in is this email address.)`,
        });
      return { ok: true, sent: true };
    },

    /** Parent changes their own password. Other sessions stay signed in. */
    async changePassword(guardianId, current, next) {
      const g = await one('SELECT password_hash FROM guardians WHERE id = $1', [guardianId]);
      if (!g || !(await verifySecret(current, g.password_hash)))
        return { ok: false, message: 'Your current password is not right.' };
      await db.query('UPDATE guardians SET password_hash = $1, password_set_at = $2 WHERE id = $3', [
        await hashSecret(next),
        now(),
        guardianId,
      ]);
      return { ok: true };
    },

    /** Email a "forgot my password" link. Always answers the same, so nobody can find out which numbers are registered. */
    async requestReset(phone, linkFor) {
      const g = await one('SELECT id, full_name, email FROM guardians WHERE phone = $1', [normalizePhone(phone)]);
      if (g?.email) {
        const link = linkFor(await issueToken({ guardianId: g.id }, 'reset'));
        await mailer.send({
          to: g.email,
          subject: 'Choose a new ClassBridge password',
          text: `Hello ${g.full_name}, open this link within ${TOKEN_MINUTES.reset} minutes to choose a new password: ${link}`,
        });
      }
      return { ok: true };
    },

    /**
     * Use an invitation or reset link (once) to choose a password. Signs the parent out everywhere.
     * @param {string} token
     * @param {string} newPassword
     */
    async setPasswordWithToken(token, newPassword) {
      const r = await one(
        'SELECT guardian_id, staff_id FROM password_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2',
        [hashToken(token), now()],
      );
      if (!r) return { ok: false, message: 'This link has expired or was already used. Ask for a new one.' };
      if (r.staff_id) {
        const t = await one('SELECT status FROM staff WHERE id = $1', [r.staff_id]);
        if (!t || t.status === 'removed') return { ok: false, message: MESSAGES.removed };
        await db.query('UPDATE password_tokens SET used_at = $1 WHERE token_hash = $2', [now(), hashToken(token)]);
        await db.query("UPDATE staff SET password_hash = $1, status = 'active' WHERE id = $2", [
          await hashSecret(newPassword),
          r.staff_id,
        ]);
        await db.query("DELETE FROM sessions WHERE role = 'teacher' AND subject_id = $1", [r.staff_id]);
        return { ok: true, role: 'teacher' };
      }
      await db.query('UPDATE password_tokens SET used_at = $1 WHERE token_hash = $2', [now(), hashToken(token)]);
      await db.query('UPDATE guardians SET password_hash = $1, password_set_at = $2 WHERE id = $3', [
        await hashSecret(newPassword),
        now(),
        r.guardian_id,
      ]);
      await db.query("DELETE FROM sessions WHERE role = 'parent' AND subject_id = $1", [r.guardian_id]);
      return { ok: true, role: 'parent' };
    },
  };
}
