// Module-toggle core logic (§9), extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config; the pure toggleModule function is an invalid Route export, so it lives
// in this plain sibling module. route.ts imports it; the integration tests drive
// it directly against the chat-002 local-Supabase test DB.
//
//  - The write is ATOMIC: a single UPDATE with jsonb_set, never a JS
//    read-then-write (which would be a lost-update race under concurrent toggles).
//  - INVARIANT (site 2 of 2): base_profile_version is incremented on every
//    successful toggle (module config feeds the plan-gen cache key).
import { ApiError, ErrorCode } from '@vesper/shared';
import {
  withUser,
  userProfiles,
  sql,
  eq,
  type Database,
  type UserScopedQuery,
  type ModulesEnabled,
} from '@vesper/db';
import type { ModuleId, ModuleToggleResponse } from '../../schemas';

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
