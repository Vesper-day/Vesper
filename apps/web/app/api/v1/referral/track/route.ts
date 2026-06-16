// POST /api/v1/referral/track (§9) — UNAUTHENTICATED referral attribution.
//
// Hit when a visitor lands on vesper.[tld]/r/{code}; the /r/[code] page forwards
// the slug as `?code=` (see ../schemas.ts CODE-SOURCE DECISION). Validates the
// code against users.referral_code, then either sets the vesper_ref cookie and
// 302-redirects to the marketing landing page (valid) or 404s with no cookie
// (unresolved) — both branches built by referralTrackResponse.
//
// Rate limiting lives in apps/web/middleware.ts (limiter `referral-track`,
// 200/1h per anonymous IP hash), NOT here. createRoute is unusable: this is
// unauthenticated and returns 302/404, not a 200 body. Core logic lives in
// ./trackReferral (a route.ts file may export only HTTP handlers + segment config).
import * as Sentry from '@sentry/nextjs';
import { createDrizzleClient } from '@vesper/db';
import { resolveReferralCode, referralTrackResponse } from './trackReferral';

export async function POST(request: Request): Promise<Response> {
  try {
    const code = new URL(request.url).searchParams.get('code');
    const result = await resolveReferralCode(createDrizzleClient(), code);
    return referralTrackResponse(result);
  } catch (err) {
    Sentry.captureException(err, {
      extra: { method: request.method, path: '/api/v1/referral/track' },
    });
    // On an unexpected failure, behave like an unresolved code: 404, no cookie.
    return new Response(null, { status: 404 });
  }
}
