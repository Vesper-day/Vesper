// @vitest-environment node
//
// Integration tests for the Profile API group, driven against the chat-002
// local-Supabase test DB (Docker, direct connection 54322). They exercise the
// exported DB-layer functions directly (getProfile / updateProfile / toggleModule)
// so they assert real Postgres behaviour — version bumps, atomic jsonb_set — without
// standing up Supabase Auth (that path is covered by the curl smoke).
//
// Gated on VESPER_DB_TESTS so the default `pnpm test` / CI run (no local Supabase)
// stays green. To run:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  createDrizzleClient,
  users,
  userProfiles,
  ModulesEnabledSchema,
  sql,
  eq,
  type Database,
  type BaseProfile,
} from '@vesper/db';
import { getProfile, updateProfile } from './route';
import { toggleModule } from './modules/[moduleId]/route';
import { ModuleIdSchema, MODULE_KEYS } from './schemas';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

function sampleBaseProfile(): BaseProfile {
  return {
    recurringCommitments: [],
    locationBoundEvents: [],
    goals: [],
    wakeTarget: '07:00',
    bedtimeTarget: '23:00',
    location: { lat: 37.7749, lng: -122.4194 },
    notificationPreferences: { morningKnockEnabled: true, alarmEnabled: false },
  };
}

describeDb('Profile API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // Deleting the auth.users row cascades to public.users → user_profiles →
    // completion_log (FK ON DELETE CASCADE chain).
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  // Seed via auth.users: the on_auth_user_created trigger auto-creates the
  // public.users row (archetype='mixed') AND the user_profiles row (base_profile
  // {}, version 1, modules_enabled {}). We then update both rows to the desired
  // test state. Pass modulesEnabled:'{}' (the default) to leave the seeded empty
  // jsonb in place for the create-missing branch test.
  async function seedUser(opts?: {
    modulesEnabled?: Record<string, unknown>;
    seedEmptyModules?: boolean;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`test-${id}@example.com`})`,
    );
    createdUserIds.push(id);

    await db.update(users).set({ archetype: 'remote' }).where(eq(users.id, id));

    const modules = opts?.seedEmptyModules
      ? {}
      : (opts?.modulesEnabled ?? ModulesEnabledSchema.parse({}));
    await db
      .update(userProfiles)
      .set({
        baseProfile: sampleBaseProfile(),
        baseProfileVersion: 1,
        modulesEnabled: modules as never,
      })
      .where(eq(userProfiles.userId, id));
    return id;
  }

  it('GET returns the merged user + profile', async () => {
    const id = await seedUser();
    const res = await getProfile(db, id);

    expect(res.user.id).toBe(id);
    expect(res.user.email).toBe(`test-${id}@example.com`);
    expect(res.user.archetype).toBe('remote');
    expect(res.profile.baseProfileVersion).toBe(1);
    expect(res.profile.baseProfile.wakeTarget).toBe('07:00');
    expect(res.profile.modulesEnabled.sleep.enabled).toBe(false);
  });

  it('PUT does NOT bump version on a modulesEnabled-only update', async () => {
    const id = await seedUser();
    const enabled = ModulesEnabledSchema.parse({});
    enabled.work.enabled = true;

    const res = await updateProfile(db, id, { modulesEnabled: enabled });

    expect(res.profile.baseProfileVersion).toBe(1);
    expect(res.profile.modulesEnabled.work.enabled).toBe(true);
  });

  it('PUT bumps version when baseProfile is present', async () => {
    const id = await seedUser();
    const bp = sampleBaseProfile();
    bp.wakeTarget = '06:30';

    const res = await updateProfile(db, id, { baseProfile: bp });

    expect(res.profile.baseProfileVersion).toBe(2);
    expect(res.profile.baseProfile.wakeTarget).toBe('06:30');
  });

  it('PUT bumps version when only notificationPreferences (inside baseProfile) changes', async () => {
    const id = await seedUser();
    const bp = sampleBaseProfile();
    bp.notificationPreferences = { morningKnockEnabled: false, alarmEnabled: true };

    const res = await updateProfile(db, id, { baseProfile: bp });

    expect(res.profile.baseProfileVersion).toBe(2);
    expect(res.profile.baseProfile.notificationPreferences.alarmEnabled).toBe(true);
  });

  it('PUT updates users-table fields without bumping version', async () => {
    const id = await seedUser();
    const res = await updateProfile(db, id, {
      archetype: 'founder',
      timezone: 'America/New_York',
      honorific: 'sir',
    });
    expect(res.user.archetype).toBe('founder');
    expect(res.user.timezone).toBe('America/New_York');
    expect(res.user.honorific).toBe('sir');
    expect(res.profile.baseProfileVersion).toBe(1);
  });

  it('PATCH-toggle flips exactly one module, bumps version, leaves others intact', async () => {
    const id = await seedUser();
    const res = await toggleModule(db, id, 'sleep', true);

    expect(res.moduleId).toBe('sleep');
    expect(res.enabled).toBe(true);
    expect(res.baseProfileVersion).toBe(2);

    const after = await getProfile(db, id);
    expect(after.profile.modulesEnabled.sleep.enabled).toBe(true);
    // Other modules untouched (atomicity / no clobber).
    expect(after.profile.modulesEnabled.fitness.enabled).toBe(false);
    expect(after.profile.modulesEnabled.work.enabled).toBe(false);
    expect(after.profile.baseProfileVersion).toBe(2);
  });

  it('PATCH-toggle creates the module object when it is missing (jsonb_set create branch)', async () => {
    // Seed with an empty modules_enabled jsonb so the path parent does not exist.
    const id = await seedUser({ seedEmptyModules: true });
    const res = await toggleModule(db, id, 'finance', true);

    expect(res.enabled).toBe(true);
    const after = await getProfile(db, id);
    expect(after.profile.modulesEnabled.finance.enabled).toBe(true);
  });

  it('PATCH-toggle 404s when there is no user_profiles row', async () => {
    const id = await seedUser();
    // Remove the auto-created profile row to exercise the defensive 404.
    await db.delete(userProfiles).where(eq(userProfiles.userId, id));

    await expect(toggleModule(db, id, 'work', true)).rejects.toThrow(
      /User profile not found/,
    );
  });
});

// Pure validation (no DB): the [moduleId] route param accepts exactly the real
// ModulesEnabledSchema keys and rejects anything else (→ 400 in the handler).
describe('ModuleIdSchema', () => {
  it('accepts every real module key', () => {
    for (const key of MODULE_KEYS) {
      expect(ModuleIdSchema.safeParse(key).success).toBe(true);
    }
  });

  it('rejects an unknown module key', () => {
    expect(ModuleIdSchema.safeParse('bogus').success).toBe(false);
    expect(ModuleIdSchema.safeParse('hydration').success).toBe(false);
  });
});
