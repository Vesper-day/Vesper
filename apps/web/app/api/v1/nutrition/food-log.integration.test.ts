// @vitest-environment node
//
// Tests for the Nutrition food-log API (GET/POST /nutrition/food-log, DELETE
// /nutrition/food-log/[id]) — Chat ADD-B.
//
// Two suites:
//   * "Food-log validation (pure)" — ungated Zod-schema assertions that run under plain
//     `pnpm test` (no DB).
//   * "Food-log API (integration)" — gated on VESPER_DB_TESTS; drives the exported
//     DB-layer functions directly against the chat-002 local-Supabase test DB. Asserts
//     real Postgres behaviour: own-row isolation, the local-day read-back boundary
//     (start_of_local_day), the recipe_template_id FK, and 404 on a not-owned delete —
//     without standing up Supabase Auth.
//
// To run the integration suite:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test food-log
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { ApiError } from '@vesper/shared';
import {
  PostFoodLogSchema,
  FoodSearchQuerySchema,
  RecipeModifyRequestSchema,
} from '@vesper/shared/nutrition';
import {
  listTodayFoodLog,
  createFoodLogEntry,
  deleteFoodLogEntry,
} from './operations';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Food-log validation (pure)', () => {
  it('PostFoodLogSchema requires itemName and rejects extras', () => {
    expect(PostFoodLogSchema.safeParse({ itemName: 'Oats' }).success).toBe(true);
    expect(PostFoodLogSchema.safeParse({}).success).toBe(false); // missing itemName
    expect(PostFoodLogSchema.safeParse({ itemName: '' }).success).toBe(false); // blank
    expect(PostFoodLogSchema.safeParse({ itemName: 'Oats', nope: 1 }).success).toBe(false); // strict
  });

  it('PostFoodLogSchema accepts the optional fields with the right shapes', () => {
    expect(
      PostFoodLogSchema.safeParse({
        itemName: 'Chili',
        recipeTemplateId: '11111111-1111-1111-1111-111111111111',
        quantityNote: '1 bowl',
        loggedAt: '2026-08-24T12:00:00.000Z',
      }).success,
    ).toBe(true);
    // recipeTemplateId must be a uuid when present.
    expect(
      PostFoodLogSchema.safeParse({ itemName: 'Chili', recipeTemplateId: 'not-a-uuid' }).success,
    ).toBe(false);
    // loggedAt must be an ISO datetime when present.
    expect(
      PostFoodLogSchema.safeParse({ itemName: 'Chili', loggedAt: '2026-08-24' }).success,
    ).toBe(false);
    // recipeTemplateId / quantityNote may be null (free-text entry).
    expect(
      PostFoodLogSchema.safeParse({ itemName: 'Chili', recipeTemplateId: null, quantityNote: null })
        .success,
    ).toBe(true);
  });

  it('FoodSearchQuerySchema requires a non-empty q and bounds the limit', () => {
    expect(FoodSearchQuerySchema.safeParse({ q: 'chi' }).success).toBe(true);
    expect(FoodSearchQuerySchema.safeParse({ q: 'chi', limit: '10' }).success).toBe(true); // coerced
    expect(FoodSearchQuerySchema.safeParse({ q: '' }).success).toBe(false);
    expect(FoodSearchQuerySchema.safeParse({ q: 'chi', limit: '0' }).success).toBe(false);
    expect(FoodSearchQuerySchema.safeParse({ q: 'chi', nope: 1 }).success).toBe(false); // strict
  });

  it('RecipeModifyRequestSchema requires recipeName + request', () => {
    expect(
      RecipeModifyRequestSchema.safeParse({ recipeName: 'Bolognese', request: 'veg' }).success,
    ).toBe(true);
    expect(RecipeModifyRequestSchema.safeParse({ recipeName: 'Bolognese' }).success).toBe(false);
    expect(RecipeModifyRequestSchema.safeParse({ request: 'veg' }).success).toBe(false);
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Food-log API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // food_log_entries carries only a BEFORE UPDATE set_updated_at trigger (no audit
    // trigger), so a straight user delete cascades cleanly. Delete the child rows first
    // anyway for parity with the medications precedent.
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM food_log_entries WHERE user_id = ${id}::uuid`);
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`food-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  // 1 — POST creates an entry; user_id from the arg, item_name supplied, optionals null.
  it('POST creates an entry with item_name supplied and optionals defaulting to null', async () => {
    const userId = await seedUser();
    const res = await createFoodLogEntry(db, userId, { itemName: 'Porridge' });

    expect(res.itemName).toBe('Porridge');
    expect(res.recipeTemplateId).toBeNull();
    expect(res.quantityNote).toBeNull();
    expect(typeof res.loggedAt).toBe('string');
    expect(res.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  // 2 — POST with a missing item_name -> 400 (the NOT-NULL-no-default column).
  it('POST with a missing itemName returns 400 INVALID_REQUEST', async () => {
    const userId = await seedUser();
    const err = (await createFoodLogEntry(db, userId, { quantityNote: '1 bowl' }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.httpStatus).toBe(400);
  });

  // 3 — listTodayFoodLog returns only the caller's rows (own-row isolation).
  it('GET (today) lists only the session user rows', async () => {
    const userId = await seedUser();
    const otherId = await seedUser();
    await createFoodLogEntry(db, userId, { itemName: 'Mine' });
    await createFoodLogEntry(db, otherId, { itemName: 'Theirs' });

    const { entries } = await listTodayFoodLog(db, userId, 'UTC');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.itemName).toBe('Mine');
  });

  // 4 — the local-day boundary excludes an entry logged before today (start_of_local_day).
  it('GET (today) excludes an entry logged before the local day boundary', async () => {
    const userId = await seedUser();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await createFoodLogEntry(db, userId, { itemName: 'Old', loggedAt: twoDaysAgo });
    await createFoodLogEntry(db, userId, { itemName: 'Fresh' });

    const { entries } = await listTodayFoodLog(db, userId, 'UTC');
    expect(entries.map((e) => e.itemName)).toEqual(['Fresh']);
  });

  // 5 — recipe_template_id FK: a corpus id is stored and read back.
  it('POST stores a recipe_template_id from the corpus when provided', async () => {
    const userId = await seedUser();
    const rows = (await db.execute(
      sql`SELECT id FROM recipe_templates LIMIT 1`,
    )) as unknown as Array<{ id: string }>;
    // The seed migration populates recipe_templates; if it is empty, skip the FK write.
    if (rows.length === 0) return;
    const recipeId = rows[0]!.id;

    const res = await createFoodLogEntry(db, userId, {
      itemName: 'From corpus',
      recipeTemplateId: recipeId,
    });
    expect(res.recipeTemplateId).toBe(recipeId);
  });

  // 6 — DELETE another user's entry -> 404 (own-row).
  it('DELETE an entry not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const created = await createFoodLogEntry(db, ownerId, { itemName: 'Owned' });

    const err = (await deleteFoodLogEntry(db, otherId, created.id).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 7 — DELETE removes the row; a second delete returns 404.
  it('DELETE removes the row; a second delete returns 404', async () => {
    const userId = await seedUser();
    const created = await createFoodLogEntry(db, userId, { itemName: 'To-delete' });

    await expect(deleteFoodLogEntry(db, userId, created.id)).resolves.toBeUndefined();

    const remaining = (await db.execute(
      sql`SELECT id FROM food_log_entries WHERE id = ${created.id}::uuid`,
    )) as unknown as Array<{ id: string }>;
    expect(remaining).toHaveLength(0);

    const err = (await deleteFoodLogEntry(db, userId, created.id).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(404);
  });
});
