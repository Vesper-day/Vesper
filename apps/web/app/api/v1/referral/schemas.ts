// Request source + response-shape types for the Referral API group (§9).
//
// Co-located per the chat-024 contract, shared by the two sibling routes
// (./track and ./code).
//
// CODE-SOURCE DECISION (referral/track): §9 says "Request body: none (URL-driven
// only)" and the endpoint is hit when a visitor lands on vesper.[tld]/r/{code}.
// The /r/[code] page (chat 095-V) forwards the path segment as the `?code=`
// query param, so the code is read from the query string — not the body, not a
// path param on this route. ReferralCodeSchema is the validation applied to it.
import { z } from 'zod';

// users.referral_code is a six-character base62 slug (§3.1). We validate shape
// (1..64 base62 chars) before the DB lookup; an out-of-shape value resolves to
// the same 404 as an unknown code (no separate 400 on the public endpoint).
export const ReferralCodeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9]+$/);

// §9 GET /api/v1/referral/code success body (200). Top-level, no envelope.
export interface ReferralCodeResponse {
  code: string;
  url: string;
  referralCount: number;
  creditsApplied: number;
  creditsPending: number;
}

// §9 GET /api/v1/referral/code 404 body for an ineligible (never-active) user.
export interface ReferralNotEligibleResponse {
  reason: 'not_eligible';
}
