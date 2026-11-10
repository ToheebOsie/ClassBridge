-- The registry: one row per school and the name of that school's own database.
CREATE TABLE schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,         -- used in the school's web address
  name        text NOT NULL,
  db_name     text NOT NULL UNIQUE,         -- the separate database holding this school's data
  accent      text NOT NULL DEFAULT '#2740a0', -- school colour used across the app
  created_at  timestamptz NOT NULL DEFAULT now()
);
