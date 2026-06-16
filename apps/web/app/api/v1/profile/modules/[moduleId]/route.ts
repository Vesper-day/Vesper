// PATCH /api/v1/profile/modules/[moduleId] (§9).
//
// Toggles a single module's `enabled` flag.
//  - [moduleId] is validated against the REAL ModulesEnabledSchema keys; an
//    unknown key → 400. No user_profiles row → 404 (defensive).
//  - The write is ATOMIC: a single UPDATE with jsonb_set, never a JS
//    read-then-write (which would be a lost-update race under concurrent toggles).
//  - INVARIANT (site 2 of 2): base_profile_version is incremented in the handler
//    on every successful toggle (module config feeds the plan-gen cache key).
//
// Core logic is exported (toggleModule) for the integration tests to drive
// against the chat-002 local-Supabase test DB.
import { createRoute, ApiError, ErrorCode } from '@vesper/shared';
import {
  createDrizzleClient,
  withUser,
  userProfiles,
  sql,
  eq,
  type Database,
  type UserScopedQuery,
  type ModulesEnabled,
} from '@vesper/db';
import {
  ModuleIdSchema,
  ModuleToggleRequestSchema,
  type ModuleId,
  type ModuleToggleResponse,
} from '../../schemas';

interface ToggleRow {
  baseProfileVersion: number;
  modulesEnabled: ModulesEnabled;
}

export async function toggleModule(
  db: Database,
  userId: string,
  moduleId: ModuleId,
  enabled: boolean,
): Promise<ModuleToggleResponse> {
  // moduleId is already validated against the fixed ModulesEnabledSchema key set,
  // so embedding it in the jsonb path literals below is safe (no injection
  // surface). `enabled` is bound as a parameter.
  const modulePath = `{${moduleId}}`;
  const enabledPath = `{${moduleId},enabled}`;

  // Atomic jsonb_set. The CASE guarantees the module object exists before we set
  // its nested `enabled` key (jsonb_set cannot create an intermediate parent),
  // and preserves any other fields already on that module object (e.g.
  // fitness.goal, nutrition.dietTags).
  const nextModules = sql`jsonb_set(
    CASE WHEN ${userProfiles.modulesEnabled} ? ${moduleId}
         THEN ${userProfiles.modulesEnabled}
         ELSE jsonb_set(${userProfiles.modulesEnabled}, ${modulePath}::text[], '{}'::jsonb, true)
    END,
    ${enabledPath}::text[],
    to_jsonb(${enabled}::boolean),
    true
  )`;

  const updateQuery: UserScopedQuery<[], ToggleRow[]> = (uid) => async (database) =>
    database
      .update(userProfiles)
      .set({
        modulesEnabled: nextModules,
        baseProfileVersion: sql`${userProfiles.baseProfileVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(userProfiles.userId, uid))
      .returning({
        baseProfileVersion: userProfiles.baseProfileVersion,
        modulesEnabled: userProfiles.modulesEnabled,
      });

  const rows = await withUser(db, userId, updateQuery);
  const row = rows[0];
  if (!row) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'User profile not found');
  }

  const persisted = row.modulesEnabled[moduleId]?.enabled ?? enabled;
  return {
    moduleId,
    enabled: persisted,
    baseProfileVersion: row.baseProfileVersion,
  };
}

export const PATCH = createRoute<ModuleToggleResponse>(
  async ({ request, user, params }) => {
    const moduleIdParsed = ModuleIdSchema.safeParse(params.moduleId);
    if (!moduleIdParsed.success) {
      throw new ApiError(ErrorCode.INVALID_REQUEST, 'Unknown module id.');
    }
    const raw: unknown = await request.json().catch(() => null);
    const bodyParsed = ModuleToggleRequestSchema.safeParse(raw);
    if (!bodyParsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { enabled: boolean }.',
      );
    }
    return toggleModule(
      createDrizzleClient(),
      user.id,
      moduleIdParsed.data,
      bodyParsed.data.enabled,
    );
  },
);
