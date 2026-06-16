// Referral-code read core logic (§9), extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config, so this pure helper lives in a sibling module. route.ts imports it;
// the integration test drives it directly against the chat-002 local-Supabase
// test DB (both the not_eligible and the seeded-active 200 paths).
//
// ELIGIBILITY (§9): 404 { reason: 'not_eligible' } if the user has never reached
// subscription_status='active'. users.referral_code is the durable signal —
// generated only at the first trial→active conversion (chat 095) and never
// cleared (§3.1) — so referral_code IS NULL ⟺ never-active ⟺ not eligible. The
// users read is scoped through withUser (UserScopedQuery contract).
//
// COUNTS (§9 + F3): referralCount = referral_credits rows where
// recipient_user_id = me; creditsApplied / creditsPending are the status='applied'
// / 'pending' subsets; voided is excluded from all three. F3 (migration
// 20260601000020) added referral_credits.beneficiary_role, so the counts are
// further scoped to beneficiary_role='referrer' — a referee-role credit the user
// also holds must NOT inflate their "referrals driven" count. The
// referral_credits ORM model is STALE vs migration ...0009/...0020 (CHAT_111 §5),
// so the count runs as raw parameterized SQL with an explicit user_id (the
// read-side analog of withUser), pending the chat-006 drizzle-kit pull.
import {
  withUser,
  users,
  eq,
  sql,
  type Database,
  type UserScopedQuery,
} from '@vesper/db';
import type { ReferralCodeResponse } from '../schemas';

export type ReferralCodeResult =
  | { eligible: true; data: ReferralCodeResponse }
  | { eligible: false };

const readReferralCode: UserScopedQuery<[], string | null | undefined> =
  (userId) => async (db) => {
    const rows = await db
      .select({ referralCode: users.referralCode })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0]?.referralCode;
  };

export async function getReferralCode(
  db: Database,
  userId: string,
): Promise<ReferralCodeResult> {
  const referralCode = await withUser(db, userId, readReferralCode);
  // null (on trial / never-active) OR no users row → not eligible.
  if (!referralCode) {
    return { eligible: false };
  }

  // referral_credits ORM model is stale vs migration — raw SQL until chat-006
  // drizzle-kit pull. Scoped to recipient_user_id = me AND beneficiary_role =
  // 'referrer' (F3); voided excluded from every count.
  const countRows = (await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE status <> 'voided')::int AS total,
      count(*) FILTER (WHERE status = 'applied')::int AS applied,
      count(*) FILTER (WHERE status = 'pending')::int AS pending
    FROM referral_credits
    WHERE recipient_user_id = ${userId}::uuid
      AND beneficiary_role = 'referrer'
  `)) as unknown as Array<{ total: number; applied: number; pending: number }>;

  const counts = countRows[0] ?? { total: 0, applied: 0, pending: 0 };

  // env-derived base URL — never a hardcoded domain (§9/§3.1; ENVIRONMENT_SETUP).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return {
    eligible: true,
    data: {
      code: referralCode,
      url: `${baseUrl}/r/${referralCode}`,
      referralCount: counts.total,
      creditsApplied: counts.applied,
      creditsPending: counts.pending,
    },
  };
}
