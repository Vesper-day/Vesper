// Request Zod + response-shape types for the Subscription API group (§9).
//
// Co-located per the chat-024/028 contract (route.ts exports only HTTP handlers +
// segment config; pure logic + Zod live in siblings). Response shapes are the §9
// camelCase runtime shapes — NOT the §3 snake_case columns.
import { z } from 'zod';

// --- GET /api/v1/subscription (§9) ------------------------------------------
//
// §9 body: { subscription: { status, provider, currentPeriodEnd, cancelAtPeriodEnd } }.
// currentPeriodEnd is an ISO-8601 string or null (NULL on a never-billed trial).
export interface SubscriptionResponse {
  subscription: {
    status: string;
    provider: string;
    currentPeriodEnd: string | null; // ISO 8601
    cancelAtPeriodEnd: boolean;
  };
}

// --- POST /api/v1/subscription/checkout | /portal (§9) ----------------------
//
// Both return { url } — the Stripe-hosted page the client redirects to.
export interface StripeUrlResponse {
  url: string;
}

// --- POST /api/v1/subscription/apple-verify (§9, chat 086) ------------------
//
// 501 stub this chat; the full StoreKit 2 verify lands chat 086 and reuses this
// schema. §9 request body is exactly { jwsTransaction }.
export const AppleVerifyRequestSchema = z
  .object({
    jwsTransaction: z.string().min(1),
  })
  .strict();

export type AppleVerifyRequest = z.infer<typeof AppleVerifyRequestSchema>;
