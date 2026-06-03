import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Canonical Drizzle client factory for Vesper.
 *
 * Driver: postgres-js, always constructed with `{ prepare: false }`.
 *
 * `prepare: false` is MANDATORY. The serverless connection variable
 * (SUPABASE_DB_URL) points at the Supavisor transaction-mode pooler, which does
 * NOT support prepared statements. Leaving prepare enabled makes most Drizzle
 * queries fail at runtime in serverless contexts (Vercel routes, Workers) with
 * cryptic errors, while passing locally against a direct connection. Setting it
 * unconditionally is harmless on a direct connection, so we never branch on it.
 *
 * Connection selection (when no explicit connectionString is passed):
 *   - serverless/edge (process.env.RUNTIME set) OR NODE_ENV === 'production'
 *       -> SUPABASE_DB_URL      (Supavisor transaction-mode pooler)
 *   - otherwise (local dev / scripts / tests)
 *       -> SUPABASE_DIRECT_URL  (direct Postgres connection)
 *
 * See CLIENT_PATTERN.md for the full rationale.
 */
export function createDrizzleClient(connectionString?: string) {
  const url = connectionString ?? selectConnectionString();
  const client = postgres(url, {
    prepare: false,
  });
  return drizzle(client, { schema });
}

function selectConnectionString(): string {
  const useServerless =
    process.env.RUNTIME !== undefined || process.env.NODE_ENV === 'production';

  const varName = useServerless ? 'SUPABASE_DB_URL' : 'SUPABASE_DIRECT_URL';
  const url = process.env[varName];

  if (!url) {
    throw new Error(
      `createDrizzleClient: ${varName} is not set. ` +
        (useServerless
          ? 'Serverless/production contexts require SUPABASE_DB_URL (Supavisor transaction-mode pooler).'
          : 'Local/dev contexts require SUPABASE_DIRECT_URL (direct Postgres connection).'),
    );
  }
  return url;
}

/** Inferred type of the canonical Drizzle client (schema-bound). */
export type Database = ReturnType<typeof createDrizzleClient>;

/**
 * @deprecated Use {@link createDrizzleClient} instead. Retained as a
 * non-breaking alias for any pre-existing importer.
 */
export const createDb = createDrizzleClient;

/** @deprecated Use {@link Database} instead. */
export type Db = Database;

export { schema };
