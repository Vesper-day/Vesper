import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDb(connectionString?: string) {
  const url = connectionString ?? process.env.SUPABASE_DB_URL!;
  const client = postgres(url, {
    prepare: false,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
