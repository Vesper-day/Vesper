import type { Database } from '../client';

/**
 * Every query function exported from @vesper/db MUST be typed as
 * `UserScopedQuery` and MUST emit `eq(table.userId, userId)` against the
 * supplied `userId`.
 *
 * Rationale: the Drizzle client runs with the Supabase service-role connection,
 * which BYPASSES Row Level Security. The application layer is therefore the
 * per-user filter. Encoding `userId` as the required leading parameter makes it
 * a COMPILE error to define or call a query that forgets to scope by user.
 *
 * Inline queries constructed directly against the service-role client (outside
 * a `UserScopedQuery` passed through `withUser`) are forbidden.
 *
 * Shape: `(userId, ...rest) => (db) => Promise<R>` — userId is curried first so
 * the filter can never be omitted, and `db` is injected last by `withUser`.
 *
 * No concrete query functions live here yet (scaffold only); later chats add
 * them, each typed as `UserScopedQuery`.
 */
export type UserScopedQuery<Args extends unknown[], R> = (
  userId: string,
  ...rest: Args
) => (db: Database) => Promise<R>;
