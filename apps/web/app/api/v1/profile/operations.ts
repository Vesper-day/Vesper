// Profile DB-layer core logic (§9), extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config; the pure functions getProfile / updateProfile are invalid Route
// exports, so they live in this plain sibling module. route.ts imports them; the
// integration tests drive them directly against the chat-002 local-Supabase test
// DB without standing up Supabase Auth.
//
// PUT invariant: base_profile_version is incremented IN updateProfile whenever
// `baseProfile` is present on the body (notificationPreferences lives inside
// baseProfile, so toggling it bumps the version too — CHAT_111 placement
// decision 5, intended). A modulesEnabled-only update does NOT bump the version;
// that is the dedicated PATCH path's job.
import { ApiError, ErrorCode } from '@vesper/shared';
import {
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
import type {
  ProfileResponse,
  UpdateProfileRequest,
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
  // chat-090b: biometric_lock_enabled is a top-level users scalar that is NOT in
  // the pull-generated Drizzle `users` table type (the column exists in the
  // applied migration 20260601000002_users.sql but the TS schema is stale). We
  // therefore write it with a scoped raw UPDATE rather than hand-editing the
  // pulled schema. NOT NULL DEFAULT false ⇒ an absent value is a true no-op.
  const hasBiometricField = body.biometricLockEnabled !== undefined;

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

      if (hasBiometricField) {
        // Scoped to the authed user (WHERE id = uid) under the same withUser RLS
        // context as the typed writes above. Does NOT bump base_profile_version
        // (it is not a base_profile field).
        await tx.execute(
          sql`UPDATE users SET biometric_lock_enabled = ${body.biometricLockEnabled}, updated_at = now() WHERE id = ${uid}`,
        );
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
