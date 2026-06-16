// GET / PUT /api/v1/profile (§9).
//
// GET  → merged { user, profile } read, scoped through withUser.
// PUT  → partial update of users + user_profiles. INVARIANT: base_profile_version
//        is incremented IN THE HANDLER whenever `baseProfile` is present on the
//        body (notificationPreferences lives inside baseProfile, so toggling it
//        bumps the version too — CHAT_111 placement decision 5, intended). A
//        modulesEnabled-only PUT does NOT bump the version; that is the dedicated
//        PATCH path's job.
//
// Core logic is exported as pure functions (getProfile / updateProfile) that take
// an explicit Drizzle client + userId, so the integration tests can drive them
// against the chat-002 local-Supabase test DB without standing up Supabase Auth.
// The HTTP handlers below are thin createRoute wrappers that supply the
// authenticated user id.
import {
  createRoute,
  ApiError,
  ErrorCode,
} from '@vesper/shared';
import {
  createDrizzleClient,
  withUser,
  users,
  userProfiles,
  sql,
  eq,
  type Database,
  type UserScopedQuery,
  type BaseProfile,
  type ModulesEnabled,
} from '@vesper/db';
import {
  UpdateProfileRequestSchema,
  type ProfileResponse,
  type UpdateProfileRequest,
} from './schemas';

interface UserRow {
  id: string;
  email: string;
  archetype: ProfileResponse['user']['archetype'];
  timezone: string;
  honorific: ProfileResponse['user']['honorific'];
  subscriptionStatus: ProfileResponse['user']['subscriptionStatus'];
  tier: ProfileResponse['user']['tier'];
  onboardingCompletedAt: Date | null;
}

interface ProfileRow {
  baseProfile: BaseProfile;
  baseProfileVersion: number;
  modulesEnabled: ModulesEnabled;
}

/**
 * User-scoped read of the users row + user_profiles row. Both selects emit
 * `eq(table.<userId col>, userId)`, satisfying the withUser/UserScopedQuery
 * compile-time scoping contract.
 */
const readProfileQuery: UserScopedQuery<
  [],
  { userRow: UserRow | undefined; profileRow: ProfileRow | undefined }
> = (userId) => async (db) => {
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      archetype: users.archetype,
      timezone: users.timezone,
      honorific: users.honorific,
      subscriptionStatus: users.subscriptionStatus,
      tier: users.tier,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const profileRows = await db
    .select({
      baseProfile: userProfiles.baseProfile,
      baseProfileVersion: userProfiles.baseProfileVersion,
      modulesEnabled: userProfiles.modulesEnabled,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return { userRow: userRows[0], profileRow: profileRows[0] };
};

function toProfileResponse(userRow: UserRow, profileRow: ProfileRow): ProfileResponse {
  return {
    user: {
      id: userRow.id,
      email: userRow.email,
      archetype: userRow.archetype,
      timezone: userRow.timezone,
      honorific: userRow.honorific,
      subscriptionStatus: userRow.subscriptionStatus,
      tier: userRow.tier,
      onboardingCompletedAt: userRow.onboardingCompletedAt
        ? userRow.onboardingCompletedAt.toISOString()
        : null,
    },
    profile: {
      baseProfile: profileRow.baseProfile,
      baseProfileVersion: profileRow.baseProfileVersion,
      modulesEnabled: profileRow.modulesEnabled,
    },
  };
}

export async function getProfile(
  db: Database,
  userId: string,
): Promise<ProfileResponse> {
  const { userRow, profileRow } = await withUser(db, userId, readProfileQuery);
  if (!userRow) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'User record not found');
  }
  if (!profileRow) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'User profile not found');
  }
  return toProfileResponse(userRow, profileRow);
}

export async function updateProfile(
  db: Database,
  userId: string,
  body: UpdateProfileRequest,
): Promise<ProfileResponse> {
  const hasUserFields =
    body.archetype !== undefined ||
    body.timezone !== undefined ||
    body.honorific !== undefined;
  const hasProfileFields =
    body.baseProfile !== undefined || body.modulesEnabled !== undefined;

  const updateQuery: UserScopedQuery<
    [],
    { userRow: UserRow | undefined; profileRow: ProfileRow | undefined }
  > = (uid) => async (database) =>
    database.transaction(async (tx) => {
      if (hasUserFields) {
        await tx
          .update(users)
          .set({
            ...(body.archetype !== undefined ? { archetype: body.archetype } : {}),
            ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
            ...(body.honorific !== undefined ? { honorific: body.honorific } : {}),
            updatedAt: sql`now()`,
          })
          .where(eq(users.id, uid));
      }

      if (hasProfileFields) {
        await tx
          .update(userProfiles)
          .set({
            // INVARIANT (site 1 of 2): baseProfile present → bump version here,
            // in the handler, on the same write.
            ...(body.baseProfile !== undefined
              ? {
                  baseProfile: body.baseProfile,
                  baseProfileVersion: sql`${userProfiles.baseProfileVersion} + 1`,
                }
              : {}),
            ...(body.modulesEnabled !== undefined
              ? { modulesEnabled: body.modulesEnabled }
              : {}),
            updatedAt: sql`now()`,
          })
          .where(eq(userProfiles.userId, uid));
      }

      const userRows = await tx
        .select({
          id: users.id,
          email: users.email,
          archetype: users.archetype,
          timezone: users.timezone,
          honorific: users.honorific,
          subscriptionStatus: users.subscriptionStatus,
          tier: users.tier,
          onboardingCompletedAt: users.onboardingCompletedAt,
        })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      const profileRows = await tx
        .select({
          baseProfile: userProfiles.baseProfile,
          baseProfileVersion: userProfiles.baseProfileVersion,
          modulesEnabled: userProfiles.modulesEnabled,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, uid))
        .limit(1);

      return { userRow: userRows[0], profileRow: profileRows[0] };
    });

  const { userRow, profileRow } = await withUser(db, userId, updateQuery);
  if (!userRow) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'User record not found');
  }
  if (!profileRow) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'User profile not found');
  }
  return toProfileResponse(userRow, profileRow);
}

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
