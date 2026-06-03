import type { Database } from './client';
import type { UserScopedQuery } from './queries';

/**
 * Runs a {@link UserScopedQuery} with its `userId` threaded as the required
 * leading argument, then injects the Drizzle client.
 *
 * Safety is enforced at COMPILE TIME by the `UserScopedQuery` signature: a query
 * whose first parameter is not `userId: string` cannot be passed here. We do
 * NOT inspect the generated SQL string at runtime — parameterized queries make
 * such inspection prone to false negatives, and it would add per-call overhead.
 *
 * Usage (in an API route):
 *   const db = createDrizzleClient();
 *   const result = await withUser(db, user.id, someQuery, ...args);
 */
export async function withUser<Args extends unknown[], R>(
  db: Database,
  userId: string,
  query: UserScopedQuery<Args, R>,
  ...args: Args
): Promise<R> {
  return query(userId, ...args)(db);
}
