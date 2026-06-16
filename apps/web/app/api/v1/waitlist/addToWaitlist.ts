// Waitlist insert core logic (§9, §16), extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config, so this pure helper lives in a sibling module. route.ts imports it;
// the integration test drives it directly against the chat-002 local-Supabase
// test DB.
//
// IMPORTANT — waitlist raw-SQL workaround:
// The `waitlist` ORM model (packages/db/src/schema/waitlist.ts) is STALE vs the
// applied migration 20260601000009: the stub declares
// (referral_code, referred_by, joined_at, converted_at) while the real table is
// (id, email, platform_preference, referral_source, converted_to_user_id,
// created_at). We do NOT hand-edit the stub (CHAT_111 §5 locked decision); the
// durable fix is the chat-006 drizzle-kit pull regenerating the model. Until then
// we INSERT via raw parameterized SQL against the migration-defined columns,
// mirroring the chat-024 energy (completion_log) precedent.
//
// `email` is UNIQUE (§16). A duplicate raises Postgres unique_violation (SQLSTATE
// 23505); we let the constraint raise and map it to a 409 CONFLICT per §9 rather
// than racing a pre-check SELECT.
import { ApiError, ErrorCode } from '@vesper/shared';
import { sql, type Database } from '@vesper/db';
import type { WaitlistRequest, WaitlistResponse } from './schemas';

const UNIQUE_VIOLATION = '23505';

export async function addToWaitlist(
  db: Database,
  input: WaitlistRequest,
): Promise<WaitlistResponse> {
  // waitlist ORM model (waitlist.ts) is stale vs migration — raw SQL until
  // chat-006 drizzle-kit pull regenerates it. referral_source is left to its
  // nullable default (not in the §9 request); id/created_at are DB-defaulted.
  let rows: Array<{ id: string; email: string; platform_preference: string }>;
  try {
    const result = await db.execute(sql`
      INSERT INTO waitlist (email, platform_preference)
      VALUES (${input.email}, ${input.platformPreference}::platform_preference_enum)
      RETURNING id, email, platform_preference
    `);
    rows = result as unknown as Array<{
      id: string;
      email: string;
      platform_preference: string;
    }>;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ApiError(
        ErrorCode.CONFLICT,
        'This email is already on the waitlist.',
      );
    }
    throw err;
  }

  const row = rows[0];
  if (!row) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to record waitlist signup.');
  }

  return {
    waitlisted: {
      id: row.id,
      email: row.email,
      platformPreference: input.platformPreference,
    },
  };
}

/** Detect a Postgres unique_violation (23505) on any error shape postgres-js throws. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
