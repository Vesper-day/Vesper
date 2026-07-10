// resolveChannelUser (Chat 065 seam, wired to the real column by Chat 066).
//
// The 065 receiver resolves an incoming Google push (which carries only an
// X-Goog-Channel-ID) back to a Vesper user. 065 left this as a null-returning seam
// because no channel_id→user_id store existed. Chat 066's migration 24 adds
// integrations.channel_id (indexed by idx_integrations_channel_id), so this now does
// the real lookup.
//
// RAW parameterized SQL — the integrations Drizzle model is stale, so channel_id is
// read by column name, not via the ORM. The db is injectable for offline unit tests
// (mirrors the registerWatch pattern); it defaults to the canonical factory at runtime.
//
// FAIL-SOFT (unchanged from 065): no matching row → null. The route maps null to
// syncOutcome:'error' + a 200 ack so Google does not retry-storm an unresolvable
// (deregistered / not-yet-registered) channel.
import { createDrizzleClient, sql, type Database } from '@vesper/db';

const PROVIDER = 'google_calendar';

interface ChannelUserRow {
  user_id: string;
}

/**
 * Resolve the user that owns the given push channel, or null if no google_calendar
 * integration currently holds that channel_id.
 */
export async function resolveChannelUser(
  channelId: string,
  db: Database = createDrizzleClient(),
): Promise<string | null> {
  const rows = (await db.execute(sql`
    SELECT user_id
    FROM integrations
    WHERE channel_id = ${channelId} AND provider = ${PROVIDER}
    LIMIT 1
  `)) as unknown as ChannelUserRow[];

  return rows[0]?.user_id ?? null;
}
