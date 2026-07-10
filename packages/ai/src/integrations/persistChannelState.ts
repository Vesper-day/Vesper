// persistChannelState (Chat 066) — the ONE place channel state is written back to the
// integrations row. registerWatch RETURNS { id, resourceId, expiration } and persists
// nothing (065's deliberate gap); this is the single persistence path for that return,
// used by:
//   - the daily-cron gcal-channel-renewal worker (renews an expiring channel), AND
//   - the (deferred) 034-W / Cutover call site that first registers a channel.
// Keeping it in one worker-safe helper means the two producers cannot drift on how the
// three snake_case columns are written.
//
// RAW parameterized SQL against the real migration columns — the integrations Drizzle
// model is stale (chat-063/064 precedent), so channel state is written by column name,
// not through the ORM.
import { createDrizzleClient, sql, type Database } from '@vesper/db';

const PROVIDER = 'google_calendar';

/** The channel handle to persist — matches registerWatch's WatchChannel return shape. */
export interface ChannelState {
  /** events.watch channel id → integrations.channel_id. */
  id: string;
  /** events.watch resource id → integrations.resource_id. */
  resourceId: string;
  /** ms-epoch expiration string (or null) → integrations.channel_expiration (timestamptz). */
  expiration: string | null;
}

export interface PersistChannelStateOptions {
  /** Injected Drizzle client (tests / caller). Defaults to the canonical factory. */
  db?: Database;
}

/**
 * Write a channel's { id, resourceId, expiration } to the user's google_calendar
 * integration row. Maps id→channel_id, resourceId→resource_id, and the ms-epoch
 * expiration→channel_expiration (as a timestamptz; null clears it). Scoped to the
 * UNIQUE (user_id, provider) row.
 */
export async function persistChannelState(
  userId: string,
  channel: ChannelState,
  options?: PersistChannelStateOptions,
): Promise<void> {
  const db = options?.db ?? createDrizzleClient();

  // Google returns expiration as a ms-epoch string; store it as timestamptz. NULL when
  // Google omitted it (a channel with no server-declared expiry).
  const expirationIso =
    channel.expiration === null
      ? null
      : new Date(Number(channel.expiration)).toISOString();

  await db.execute(sql`
    UPDATE integrations SET
      channel_id = ${channel.id},
      resource_id = ${channel.resourceId},
      channel_expiration = ${expirationIso}::timestamptz,
      updated_at = now()
    WHERE user_id = ${userId}::uuid AND provider = ${PROVIDER}
  `);
}
