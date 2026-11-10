-- Teachers choose their own password from an invitation link (like parents), and the head keeps a
-- saved fee schedule per class level and term.

ALTER TABLE staff ADD COLUMN subjects text[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX staff_email_lower ON staff (lower(email));

-- A link now belongs to a parent OR a staff member. created_at lets "resend" wait a few minutes.
ALTER TABLE password_tokens ALTER COLUMN guardian_id DROP NOT NULL;
ALTER TABLE password_tokens ADD COLUMN staff_id uuid REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE password_tokens ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE password_tokens ADD CONSTRAINT password_tokens_one_owner CHECK ((guardian_id IS NULL) <> (staff_id IS NULL));

CREATE TABLE fee_schedules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level      text NOT NULL CHECK (level ~ '^(JSS|SS) [1-3]$'),
  term       text NOT NULL CHECK (term IN ('First term', 'Second term', 'Third term')),
  title      text NOT NULL DEFAULT 'School fees',
  updated_by uuid REFERENCES staff(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, term)
);
CREATE TABLE fee_schedule_items (
  schedule_id uuid NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  name        text NOT NULL,
  amount      integer NOT NULL CHECK (amount > 0),  -- whole naira
  PRIMARY KEY (schedule_id, position)
);
