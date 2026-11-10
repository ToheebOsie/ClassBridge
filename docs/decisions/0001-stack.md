# 0001 Stack

**Date:** 2026-11-03 · **Status:** accepted

**Decision.** Web app first, mobile later, one API for all clients.

- Frontend: React with Redux Toolkit (and RTK Query for server data), built with Vite.
- Backend: Node.js with Fastify, API-first (REST/JSON).
- Database: PostgreSQL.
- Mobile later: React Native (Expo), reusing shared code. A Capacitor wrapper of the web app is an option for a quick first release.
- Monorepo (npm workspaces): `apps/web`, `apps/api`, `packages/shared`.

**Why.** One language across web, API and mobile. Shared rules (IDs, money, permissions, validation) are written once. A plain React app suits a signed-in product (no need for server-side rendering), and a separate API serves the future mobile apps without change.

**Changed from earlier PRD draft.** The PRD first suggested Next.js. A Vite React app calling a separate API is simpler for this product.

**Gave up.** Next.js conveniences such as built-in routing and server rendering.
