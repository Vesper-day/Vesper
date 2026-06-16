// Request Zod + response-shape types for POST /api/v1/waitlist (§9).
//
// Co-located per the chat-024 contract. The §9 request body is exactly
// { email, platformPreference }; platformPreference maps to the
// platform_preference_enum (ios | android) column (§16). referral_source is
// nullable and NOT part of the request (§16) — it is never written here.
import { z } from 'zod';

// platform_preference_enum values (§16) — ios | android.
export const PlatformPreferenceSchema = z.enum(['ios', 'android']);

export const WaitlistRequestSchema = z
  .object({
    email: z.string().email(),
    platformPreference: PlatformPreferenceSchema,
  })
  .strict();

export type WaitlistRequest = z.infer<typeof WaitlistRequestSchema>;

// §9 success body (201). Top-level, no envelope (response.ts convention).
export interface WaitlistResponse {
  waitlisted: {
    id: string;
    email: string;
    platformPreference: z.infer<typeof PlatformPreferenceSchema>;
  };
}
