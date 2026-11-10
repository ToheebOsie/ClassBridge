import { ROLES, actionsFor } from '@classbridge/shared';

/** GET /api/roles : the permission table, so the apps can show only what each role may do. */
export default async function metaRoutes(app) {
  app.get('/api/roles', async () => Object.fromEntries(ROLES.map((role) => [role, actionsFor(role)])));
}
