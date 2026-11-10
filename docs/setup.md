# Setup

You need Node.js 20 or newer and Docker (for Postgres).

```bash
npm install            # installs everything for web, api and shared
npm run db:up          # starts Postgres in Docker
npm run db:migrate     # creates the registry database and every school's database
npm run dev:api        # API on http://localhost:3000
npm run dev:web        # web app on http://localhost:5173 (calls the API through /api)
```

## Everyday commands

| Command          | What it does                                     |
| ---------------- | ------------------------------------------------ |
| `npm test`       | Runs all tests (shared rules, API, web)          |
| `npm run lint`   | Checks the code for mistakes                     |
| `npm run format` | Tidies code formatting                           |
| `npm run check`  | Lint + tests + build. Run before sharing changes |

## Settings (environment variables)

| Name                | Default                                             | Meaning                                  |
| ------------------- | --------------------------------------------------- | ---------------------------------------- |
| `PORT`              | 3000                                                | API port                                 |
| `DATABASE_URL_BASE` | `postgres://classbridge:classbridge@localhost:5432` | Postgres server, without a database name |
| `REGISTRY_DB`       | `classbridge_registry`                              | Database that lists the schools          |

## Adding a school (development)

Insert a row into `schools` in the registry database (`slug`, `name`, `db_name`), then run `npm run db:migrate`. The school's own database is created and set up automatically.
