// Referral-track core logic (§9), extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config, so the pure resolver + the response builder live in this sibling
// module. The integration test drives them directly: resolveReferralCode against
// the chat-002 local-Supabase test DB, and referralTrackResponse with no DB at
// all (so the exact cookie attributes are asserted offline).
//
// The `users` ORM model is current (NOT stale) — referral_code is a real column
// on it (§3.1) — so the lookup uses Drizzle, scoped by an explicit
// eq(users.referralCode, code). No raw SQL is needed here.
import { eq, users, type Database } from '@vesper/db';
import { ReferralCodeSchema } from '../schemas';

/** vesper_ref attribution cookie — value `<code>`, 30-day max-age (§9). */
export const REFERRAL_COOKIE_NAME = 'vesper_ref';
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 2592000

export type TrackResult =
  | { resolved: true; code: string }
  | { resolved: false };

/**
 * Resolve a referral code against users.referral_code (§9). Returns the resolved
 * code on a hit, or { resolved: false } on a shape-invalid or unknown code (both
 * collapse to the same 404 + no-cookie outcome on the public endpoint).
 */
export async function resolveReferralCode(
  db: Database,
  rawCode: string | null,
): Promise<TrackResult> {
  if (rawCode === null) return { resolved: false };
  const parsed = ReferralCodeSchema.safeParse(rawCode);
  if (!parsed.success) return { resolved: false };

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, parsed.data))
    .limit(1);

  return rows[0] ? { resolved: true, code: parsed.data } : { resolved: false };
}

/**
 * Build the §9 HTTP response for a track result.
 *
 * Valid code → 302 redirect to the marketing landing page (NEXT_PUBLIC_APP_URL,
 * env-derived — never a hardcoded domain) + Set-Cookie:
 *   vesper_ref=<code>; Max-Age=2592000; Path=/; SameSite=Lax; Secure
 * HttpOnly is intentionally OMITTED (=false) so the client can read it for UTM
 * enrichment (§9).
 *
 * Unresolved code → 404 with NO cookie set (§9).
 */
export function referralTrackResponse(result: TrackResult): Response {
  if (!result.resolved) {
    return new Response(null, { status: 404 });
  }

  const landingUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const cookie =
    `${REFERRAL_COOKIE_NAME}=${result.code}` +
    `; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}` +
    `; Path=/` +
    `; SameSite=Lax` +
    `; Secure`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: landingUrl,
      'Set-Cookie': cookie,
    },
  });
}
