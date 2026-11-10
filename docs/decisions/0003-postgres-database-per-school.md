# 0003 Postgres, one database per school

**Date:** 2026-11-03 · **Status:** accepted

**Decision.** PostgreSQL from the start, with a separate database for each school and a registry database that lists them. No SQLite.

**Why.**

- Exams: many students submit at once, and SQLite allows only one writer at a time.
- Hosted for many schools: Postgres has proper backups, point-in-time recovery and connection handling.
- Forever archive: graduates' records are kept permanently, so integrity and recovery matter.
- Developing on one database and deploying on another causes bugs that appear only in production. Postgres runs locally in Docker.

**Cost.** Migrations must be applied to every school's database. `npm run db:migrate` does this. Revisit if the number of schools grows very large.
