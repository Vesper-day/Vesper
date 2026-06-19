// Push-token DB-layer core logic (§9 "Push Tokens", §3 table 13), shared by the
// POST (upsert) and DELETE route handlers. A route.ts may export only HTTP
// handlers + segment config, so the pure functions + Zod live in siblings.
//
// SCHEMA SOURCE — RAW SQL (not the ORM model):
// The Drizzle `pushTokens` model (packages/db/src/schema/integrations.ts) is STALE
// vs the applied migration 20260601000007:
//   - missing `live_activity_token` and `last_used_at`;
//   - has an extra `updated_at` the table does not;
//   - marks `token` UNIQUE and `platform` text-with-default, but the table's real
//     uniqueness is UNIQUE(user_id, device_id) and platform is push_platform_enum
//     NOT NULL with no default; `device_id` is NOT NULL in the table but nullable
//     in the model.
// We do NOT hand-edit the stub (CHAT_111 §5 locked decision) — the fix is the
// chat-006 drizzle-kit pull. Until then both operations run as raw parameterized
// SQL against the migration columns, scoped by user_id. Mirrors the
// waitlist/completion_log raw-SQL precedent.
import { sql, type Database } from '@vesper/db';
import type { PushTokenRequest, PushTokenResponse } from './schemas';

export interface UpsertPushTokenResult {
  data: PushTokenResponse;
  created: boolean; // true ⇒ 201 (insert); false ⇒ 200 (update)
}

/**
 * UPSERT a push token, keyed on (user_id, device_id) (§3 table 13 UNIQUE). Every
 * NOT-NULL-no-default column gets an explicit value: user_id (session), platform /
 * token / device_id (body). live_activity_token is nullable. On conflict we
 * refresh token / platform / live_activity_token and bump last_used_at.
 *
 * Insert-vs-update is detected with the `xmax = 0` idiom: on a fresh INSERT xmax is
 * 0; on the ON CONFLICT update path xmax is the locking txid (non-zero). This
 * drives the 201-vs-200 status without a second round-trip.
 */
export async function upsertPushToken(
  db: Database,
  userId: string,
  input: PushTokenRequest,
): Promise<UpsertPushTokenResult> {
  const liveActivityToken = input.liveActivityToken ?? null;

  const rows = (await db.execute(sql`
    INSERT INTO push_tokens (user_id, platform, token, live_activity_token, device_id, last_used_at)
    VALUES (
      ${userId}::uuid,
      ${input.platform}::push_platform_enum,
      ${input.token},
      ${liveActivityToken},
      ${input.deviceId},
      now()
    )
    ON CONFLICT (user_id, device_id) DO UPDATE SET
      platform            = EXCLUDED.platform,
      token               = EXCLUDED.token,
      live_activity_token = EXCLUDED.live_activity_token,
      last_used_at        = now()
    RETURNING (xmax = 0) AS created
  `)) as unknown as Array<{ created: boolean }>;

  const created = rows[0]?.created ?? false;

  return {
    created,
    data: {
      pushToken: {
        deviceId: input.deviceId,
        platform: input.platform,
      },
    },
  };
}

/**
 * Delete the push token for (user_id, device_id). Idempotent: a missing row is not
 * an error — the route returns 204 regardless (§9). Returns whether a row existed.
 */
export async function deletePushToken(
  db: Database,
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const rows = (await db.execute(sql`
    DELETE FROM push_tokens
    WHERE user_id = ${userId}::uuid AND device_id = ${deviceId}
    RETURNING id
  `)) as unknown as Array<{ id: string }>;
  return rows.length > 0;
}
