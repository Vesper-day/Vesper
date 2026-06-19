// Request Zod for POST /api/v1/internal/auth-event (PHASE_4_BUILD_PLAN L1130).
//
// Co-located. The eventType set is the four auth transitions the build plan lists;
// all of them result in the same action (clear the user's push_tokens). The set is
// kept here (rather than imported from onAuthStateChange.ts) so the route's input
// validation is self-contained, but it MUST stay in sync with AuthEventType there.
import { z } from 'zod';

export const AuthEventTypeSchema = z.enum([
  'sign-out',
  'password change',
  'session expired',
  'hard-delete cascade',
]);

export const AuthEventRequestSchema = z
  .object({
    userId: z.string().uuid(),
    eventType: AuthEventTypeSchema,
  })
  .strict();

export type AuthEventRequest = z.infer<typeof AuthEventRequestSchema>;
