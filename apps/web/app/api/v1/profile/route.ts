// GET / PUT /api/v1/profile (§9).
//
// GET  → merged { user, profile } read, scoped through withUser.
// PUT  → partial update of users + user_profiles.
//
// Core logic lives in the sibling ./operations module as pure functions
// (getProfile / updateProfile) that take an explicit Drizzle client + userId, so
// the integration tests can drive them against the chat-002 local-Supabase test
// DB without standing up Supabase Auth. They cannot be exported from this route.ts
// (Next.js App Router rejects non-handler exports at build time). The HTTP
// handlers below are thin createRoute wrappers that supply the authenticated
// user id.
import {
  createRoute,
  ApiError,
  ErrorCode,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import {
  UpdateProfileRequestSchema,
  type ProfileResponse,
} from './schemas';
import { getProfile, updateProfile } from './operations';

export const GET = createRoute<ProfileResponse>(async ({ user }) =>
  getProfile(createDrizzleClient(), user.id),
);

export const PUT = createRoute<ProfileResponse>(async ({ request, user }) => {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = UpdateProfileRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      'Invalid profile update payload.',
    );
  }
  return updateProfile(createDrizzleClient(), user.id, parsed.data);
});
