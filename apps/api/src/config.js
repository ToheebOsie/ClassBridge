/** Settings read from environment variables. See docs/setup.md. */
export const config = {
  port: Number(process.env.PORT) || 3000,
  /** Server address without a database name, e.g. postgres://user:pass@localhost:5432 */
  dbBase: process.env.DATABASE_URL_BASE || 'postgres://classbridge:classbridge@localhost:5432',
  /** The registry database lists every school and where its own database is. */
  registryDb: process.env.REGISTRY_DB || 'classbridge_registry',
  /** Where uploaded files (payment screenshots) are kept until we move to cloud storage. */
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
};
