# ClassBridge

A school platform for Nigerian secondary schools: assessments and CBT, report sheets, promotion, student IDs, invoices and receipts, with a separate sign-in and sidebar for each role (teacher, parent, student, head).

Start here:
- **Run it:** [docs/setup.md](docs/setup.md)
- **How it fits together:** [docs/architecture.md](docs/architecture.md)
- **Why we chose what we chose:** [docs/decisions](docs/decisions)
- **What each table and field means:** [docs/data-dictionary.md](docs/data-dictionary.md)
- **How the interface looks and is built:** [docs/ui/design-system.md](docs/ui/design-system.md)
- **How we write code:** [docs/working-agreements.md](docs/working-agreements.md)
- **What changed:** [CHANGELOG.md](CHANGELOG.md)

```
apps/web         React + Redux Toolkit + Tailwind (Vite)
apps/api         Node.js (Fastify) API
packages/shared  Rules shared by web, API and the future mobile app
docs/            All documentation
```

The product requirements (the "why") live in the ClassBridge PRD and roadmap document. This repository documents the "how".
