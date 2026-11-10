/** GET /api/health : lets hosting and monitoring check the service is running. */
export default async function healthRoutes(app) {
  app.get('/api/health', async () => ({ ok: true, service: 'classbridge-api' }));
}
