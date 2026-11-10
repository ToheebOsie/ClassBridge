/** Parents and guardians as the head sees them: who has chosen a password, who is still waiting. */

/**
 * Each guardian with their children and an invitation status:
 *  active  = has chosen a password
 *  invited = no password yet, and an invitation link is still open
 *  expired = no password yet, and no open link: needs a new invitation
 */
export async function listGuardians(db, now = new Date()) {
  const { rows } = await db.query(
    `SELECT g.id, g.full_name, g.phone, g.email, g.password_hash IS NOT NULL AS has_password,
            EXISTS (SELECT 1 FROM password_tokens t WHERE t.guardian_id = g.id AND t.purpose = 'invite' AND t.used_at IS NULL AND t.expires_at > $1) AS open_invite,
            (SELECT max(created_at) FROM password_tokens t WHERE t.guardian_id = g.id AND t.purpose = 'invite') AS last_invited
       FROM guardians g ORDER BY g.full_name`,
    [now],
  );
  const kids = (
    await db.query(
      `SELECT sg.guardian_id, s.id, s.full_name, s.current_class, s.status
         FROM student_guardians sg JOIN students s ON s.id = sg.student_id ORDER BY s.full_name`,
    )
  ).rows;
  return rows.map((g) => ({
    id: g.id,
    fullName: g.full_name,
    phone: g.phone,
    email: g.email,
    status: g.has_password ? 'active' : g.open_invite ? 'invited' : 'expired',
    lastInvited: g.last_invited,
    children: kids
      .filter((k) => k.guardian_id === g.id)
      .map((k) => ({ id: k.id, fullName: k.full_name, className: k.current_class, status: k.status })),
  }));
}
