// Auth-event core logic, extracted from route.ts (a route.ts may export only HTTP
// handlers + segment config). The integration test drives this directly against
// the chat-002 local-Supabase test DB.
//
// SCHEMA SOURCE — RAW SQL: the push_tokens ORM model (schema/integrations.ts) is
// STALE vs migration 20260601000007 (missing live_activity_token / last_used_at;
// token wrongly marked unique; device_id not NOT NULL; no UNIQUE(user_id,
// device_id)). We do NOT hand-edit the stub (CHAT_111 §5 locked decision) — the
// fix is the chat-006 drizzle-kit pull. Until then this DELETE runs as raw
// parameterized SQL against the migration columns, scoped by user_id.
import { sql, type Database } from '@vesper/db';

/**
 * Delete every push_tokens row for a user (called on sign-out / password change /
 * session expiry / hard-delete cascade). Returns the number of rows removed.
 */
export async function deletePushTokensForUser(
  db: Database,
  userId: string,
): Promise<number> {
  const result = (await db.execute(sql`
    DELETE FROM push_tokens
    WHERE user_id = ${userId}::uuid
    RETURNING id
  `)) as unknown as Array<{ id: string }>;
  return result.length;
}
