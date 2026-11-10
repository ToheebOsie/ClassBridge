-- Sign-in. See docs/decisions/0005-parent-sign-in.md.
-- Parents choose their own password through an invitation link; the school never knows it.
-- Passwords, PINs and codes are stored ONLY as salted hashes (never readable text).

ALTER TABLE guardians
  ADD COLUMN email text,
  ADD COLUMN password_hash text,
  ADD COLUMN password_set_at timestamptz;

ALTER TABLE staff ADD COLUMN security_code_hash text;   -- the head's extra code
ALTER TABLE students ADD COLUMN pin_hash text;

-- Signed-in sessions. Only a hash of the token is stored.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  role       text NOT NULL CHECK (role IN ('teacher', 'parent', 'student', 'head')),
  subject_id text NOT NULL,                  -- staff id, guardian id or student ID
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_subject ON sessions (role, subject_id);

-- One-time links that let a parent choose a password: the first-time invitation
-- (sent once by WhatsApp and email) and "forgot my password" (sent by email).
-- Single use, limited life, hash only.
CREATE TABLE password_tokens (
  token_hash  text PRIMARY KEY,
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('invite', 'reset')),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
