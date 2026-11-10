-- Core tables inside ONE school's database. See docs/data-dictionary.md.

CREATE TABLE staff (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL UNIQUE,
  full_name    text NOT NULL,
  role         text NOT NULL CHECK (role IN ('teacher', 'head')),
  form_class   text,                         -- class this teacher is form teacher of, if any
  status       text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'removed')),
  password_hash text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id           text PRIMARY KEY,             -- the Student ID, e.g. 2025-J1A-AO-01. Never changes.
  admission_no text NOT NULL UNIQUE,
  full_name    text NOT NULL,
  date_of_birth date NOT NULL,
  enrol_year   integer NOT NULL,
  enrol_class  text NOT NULL,
  current_class text,                        -- null once graduated
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'left')),
  graduated_on date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (full_name, date_of_birth)          -- stops the same child being enrolled twice
);

CREATE TABLE guardians (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  phone        text NOT NULL UNIQUE,         -- used for WhatsApp and sign-in
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_guardians (
  student_id   text NOT NULL REFERENCES students(id),
  guardian_id  uuid NOT NULL REFERENCES guardians(id),
  PRIMARY KEY (student_id, guardian_id)
);

-- Invoices and payments
CREATE TABLE invoice_batches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label        text NOT NULL,                -- e.g. "JSS 2A · School fees · First term 2026/2027"
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number       text NOT NULL UNIQUE,         -- INV-2026-0002
  student_id   text NOT NULL REFERENCES students(id),
  batch_id     uuid REFERENCES invoice_batches(id),
  title        text NOT NULL DEFAULT 'School fees',
  term         text NOT NULL,
  session      text NOT NULL,
  due_date     date NOT NULL,
  note         text NOT NULL DEFAULT '',
  revised      boolean NOT NULL DEFAULT false,
  customised   boolean NOT NULL DEFAULT false, -- changed on its own after a class batch
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term, session, title)    -- one invoice per student, term and title
);

CREATE TABLE invoice_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position     integer NOT NULL,
  name         text NOT NULL,
  amount       integer NOT NULL CHECK (amount > 0)  -- whole naira
);

CREATE TABLE payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id),
  amount       integer NOT NULL CHECK (amount > 0),
  paid_on      date NOT NULL,
  method       text NOT NULL,
  reference    text NOT NULL DEFAULT '',
  note         text NOT NULL DEFAULT '',
  screenshot_key text NOT NULL,              -- where the uploaded image is stored
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  reject_reason text,
  receipt_id   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE receipts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number       text NOT NULL UNIQUE,         -- RCP-2026-0007
  invoice_id   uuid REFERENCES invoices(id),
  student_id   text NOT NULL REFERENCES students(id),
  paid         integer NOT NULL CHECK (paid > 0),
  balance_before integer NOT NULL,
  balance_after  integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ADD CONSTRAINT payments_receipt_fk FOREIGN KEY (receipt_id) REFERENCES receipts(id);
