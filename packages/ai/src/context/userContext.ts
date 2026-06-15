// Layer-2 user context builder (Chat 021).
//
// Reads the user's row + profile via the chat-007 Drizzle client, validates the
// JSONB payloads against the post-111 Zod contracts (BaseProfileSchema /
// ModulesEnabledSchema, owned by @vesper/db — never edited here), and returns a
// JSON-serializable object that planContext.ts places in the CACHED Layer 2.
//
// Shapes are post-111 (docs/CHAT_111_RESOLUTION_RECORD.md is authoritative):
//   - wakeTarget / bedtimeTarget / location / notificationPreferences are
//     REQUIRED, top-level BaseProfile fields (no `preferences` sub-object).
//   - modulesEnabled.sleep is { enabled } only.
//   - timezone / archetype / locationLat / locationLng are USERS-row columns.
//
// The top-level `location` field mirrors users.location_lat / location_lng
// (numeric, NULLABLE — web manual-coordinate fallback, 111 §2). It is therefore
// `{ lat, lng } | null`. The strict, always-present coordinate pair also lives
// inside the parsed baseProfile.location.

import { eq } from 'drizzle-orm';
import {
  createDrizzleClient,
  withUser,
  users,
  userProfiles,
  BaseProfileSchema,
  ModulesEnabledSchema,
  type Database,
  type BaseProfile,
  type ModulesEnabled,
  type UserScopedQuery,
} from '@vesper/db';

export interface UserContext {
  userId: string;
  archetype: string;
  timezone: string;
  /** Mirror of users.location_lat / location_lng (nullable web fallback, 111 §2). */
  location: { lat: number; lng: number } | null;
  baseProfile: BaseProfile;
  modulesEnabled: ModulesEnabled;
}

type UserProfileRow = {
  archetype: string;
  timezone: string;
  locationLat: string | null;
  locationLng: string | null;
  baseProfile: BaseProfile;
  modulesEnabled: ModulesEnabled;
};

// UserScopedQuery: userId is curried first so the per-user filter can never be
// omitted (ARCHITECTURE_DECISIONS Decision: every @vesper/db query is user-scoped
// and routed through withUser; the service-role client bypasses RLS).
const userProfileQuery: UserScopedQuery<[], UserProfileRow | undefined> =
  (userId) => async (db) => {
    const rows = await db
      .select({
        archetype: users.archetype,
        timezone: users.timezone,
        locationLat: users.locationLat,
        locationLng: users.locationLng,
        baseProfile: userProfiles.baseProfile,
        modulesEnabled: userProfiles.modulesEnabled,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0];
  };

/** numeric -> number, guarding the null/NaN cases (postgres-js returns numeric as string). */
function toLocation(
  lat: string | null,
  lng: string | null,
): { lat: number; lng: number } | null {
  if (lat === null || lng === null) return null;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return null;
  return { lat: latNum, lng: lngNum };
}

/**
 * Build the Layer-2 user context for a plan generation call.
 *
 * @param db Optional Drizzle client (injected in tests). Defaults to the canonical
 *           connection-selecting factory for production/route use.
 * @throws if no user/profile row exists, or if the stored JSONB fails the post-111
 *         Zod contract (post-onboarding rows must satisfy it; see 111 §5).
 */
export async function buildUserContext(
  userId: string,
  db?: Database,
): Promise<UserContext> {
  const client = db ?? createDrizzleClient();
  const row = await withUser(client, userId, userProfileQuery);

  if (!row) {
    throw new Error(`buildUserContext: no user/profile row for user ${userId}`);
  }

  const baseProfile = BaseProfileSchema.safeParse(row.baseProfile);
  if (!baseProfile.success) {
    throw new Error(
      `buildUserContext: base_profile failed BaseProfileSchema for user ${userId}: ${baseProfile.error.message}`,
    );
  }

  const modulesEnabled = ModulesEnabledSchema.safeParse(row.modulesEnabled);
  if (!modulesEnabled.success) {
    throw new Error(
      `buildUserContext: modules_enabled failed ModulesEnabledSchema for user ${userId}: ${modulesEnabled.error.message}`,
    );
  }

  return {
    userId,
    archetype: row.archetype,
    timezone: row.timezone,
    location: toLocation(row.locationLat, row.locationLng),
    baseProfile: baseProfile.data,
    modulesEnabled: modulesEnabled.data,
  };
}
