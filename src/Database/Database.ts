import knex from "knex";

function intFromEnv(name: string, fallback: number): number {
  const value = process.env[name] ? parseInt(process.env[name]!, 10) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Upper bound for a single statement. The feed query normally takes ~7 s; anything far beyond that
 * is a bad query plan, which must fail fast instead of holding a pool connection for hours.
 */
export const STATEMENT_TIMEOUT_MS = intFromEnv("DB_STATEMENT_TIMEOUT_MS", 60_000);

export const Knex = knex({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    application_name: "gtfs-rt",
    keepAlive: true,
    // Server-side limits: cancel runaway statements and abandoned transactions.
    statement_timeout: STATEMENT_TIMEOUT_MS,
    idle_in_transaction_session_timeout: STATEMENT_TIMEOUT_MS,
    // Client-side safety net for when the server or network stops answering.
    query_timeout: STATEMENT_TIMEOUT_MS + 10_000,
    connectionTimeoutMillis: 10_000
  },
  acquireConnectionTimeout: 10_000,
  pool: {
    min: 0,
    max: intFromEnv("DB_POOL_MAX", 5)
  }
})
