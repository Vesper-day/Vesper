// @vitest-environment node
//
// Tests for the Weekly Priorities API group (GET + PUT /api/v1/weekly-priorities).
//
// Two suites:
//   * "Weekly priorities validation (pure)" — ungated Zod assertions (no DB).
//   * "Weekly Priorities API (integration)" — gated on VESPER_DB_TESTS; drives
//     getWeeklyPriorities / putWeeklyPriorities directly against the chat-002
//     local-Supabase test DB (Docker, direct connection 54322) so it asserts real
//     Postgres behaviour: the upsert on (user_id, week_start_date), the
//     base_profile_version bump in the same transaction, and the snake_case (jsonb
//     storage) <-> camelCase (API) round-trip.
//
// To run the integration suite:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test -- weekly-priorities.integration
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  createDrizzleClient,
  weeklyPriorities,
  userProfiles,
  sql,
  eq,
  and,
  type Database,
} from '@vesper/db';
import { ApiError } from '@vesper/shared';
import { getWeeklyPriorities, putWeeklyPriorities, mondayOf } from './operations';
import { PutWeeklyPrioritiesSchema } from './schemas';

// 2026-06-01 is a Monday — a valid week_start_date anchor.
const WEEK = '2026-06-01';

function items(n: number): Array<{ text: string; source: 'user' | 'ai_suggested' }> {
  return Array.from({ length: n }, (_, i) => ({
    text: `Priority ${i + 1}`,
    source: i % 2 === 0 ? ('user' as const) : ('ai_suggested' as const),
  }));
}

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Weekly priorities validation (pure)', () => {
  it('accepts 3, 4, or 5 items; rejects 2 or 6 (array length 3..5)', () => {
    expect(
      PutWeeklyPrioritiesSchema.safeParse({ weekStartDate: WEEK, priorities: items(3) }).success,
    ).toBe(true);
    expect(
      PutWeeklyPrioritiesSchema.safeParse({ weekStartDate: WEEK, priorities: items(4) }).success,
    ).toBe(true);
    expect(
      PutWeeklyPrioritiesSchema.safeParse({ weekStartDate: WEEK, priorities: items(5) }).success,
    ).toBe(true);
    expect(
      PutWeeklyPrioritiesSchema.safeParse({ weekStartDate: WEEK, priorities: items(2) }).success,
    ).toBe(false);
    expect(
      PutWeeklyPrioritiesSchema.safeParse({ weekStartDate: WEEK, priorities: items(6) }).success,
    ).toBe(false);
  });

  it('rejects a bad source, an empty text, a bad date, and extra keys', () => {
    expect(
      PutWeeklyPrioritiesSchema.safeParse({
        weekStartDate: WEEK,
        priorities: [
          { text: 'a', source: 'user' },
          { text: 'b', source: 'user' },
          { text: 'c', source: 'nope' },
        ],
      }).success,
    ).toBe(false);
    expect(
      PutWeeklyPrioritiesSchema.safeParse({
        weekStartDate: WEEK,
        priorities: [
          { text: '', source: 'user' },
          { text: 'b', source: 'user' },
          { text: 'c', source: 'user' },
        ],
      }).success,
    ).toBe(false);
    expect(
      PutWeeklyPrioritiesSchema.safeParse({ weekStartDate: 'June 1', priorities: items(3) }).success,
    ).toBe(false);
    // PUT items must NOT carry completedAt (strict).
    expect(
      PutWeeklyPrioritiesSchema.safeParse({
        weekStartDate: WEEK,
        priorities: [
          { text: 'a', source: 'user', completedAt: null },
          { text: 'b', source: 'user' },
          { text: 'c', source: 'user' },
        ],
      }).success,
    ).toBe(false);
  });

  it('mondayOf returns the Monday of the containing week (UTC)', () => {
    expect(mondayOf(new Date('2026-06-03T12:00:00Z'))).toBe('2026-06-01'); // Wed -> Mon
    expect(mondayOf(new Date('2026-06-01T00:00:00Z'))).toBe('2026-06-01'); // Mon -> itself
    expect(mondayOf(new Date('2026-06-07T23:59:00Z'))).toBe('2026-06-01'); // Sun -> Mon
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Weekly Priorities API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // Deleting auth.users cascades to public.users -> user_profiles + weekly_priorities.
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  // The on_auth_user_created trigger auto-creates public.users AND user_profiles
  // (base_profile_version 1), so a single auth.users insert is enough seed.
  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`wp-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  async function readVersion(userId: string): Promise<number> {
    const rows = await db
      .select({ v: userProfiles.baseProfileVersion })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    return rows[0]!.v;
  }

  it('GET on an empty week returns id null + empty priorities', async () => {
    const userId = await seedUser();
    const res = await getWeeklyPriorities(db, userId, WEEK);
    expect(res.weekPriorities.id).toBeNull();
    expect(res.weekPriorities.weekStartDate).toBe(WEEK);
    expect(res.weekPriorities.priorities).toEqual([]);
  });

  it('PUT (3 items) creates a row (created=true) and bumps base_profile_version', async () => {
    const userId = await seedUser();
    expect(await readVersion(userId)).toBe(1);

    const { response, created } = await putWeeklyPriorities(db, userId, {
      weekStartDate: WEEK,
      priorities: items(3),
    });

    expect(created).toBe(true);
    expect(response.weekPriorities.id).not.toBeNull();
    expect(response.weekPriorities.weekStartDate).toBe(WEEK);
    expect(response.weekPriorities.priorities).toHaveLength(3);
    // camelCase at the API boundary, completedAt defaulted null.
    expect(response.weekPriorities.priorities[0]).toEqual({
      text: 'Priority 1',
      source: 'user',
      completedAt: null,
    });
    expect(await readVersion(userId)).toBe(2);
  });

  it('PUT accepts 4 and 5 items', async () => {
    const userId = await seedUser();
    const four = await putWeeklyPriorities(db, userId, { weekStartDate: WEEK, priorities: items(4) });
    expect(four.response.weekPriorities.priorities).toHaveLength(4);
    const five = await putWeeklyPriorities(db, userId, { weekStartDate: WEEK, priorities: items(5) });
    expect(five.response.weekPriorities.priorities).toHaveLength(5);
  });

  it('PUT with 2 items and with 6 items both return 400', async () => {
    const userId = await seedUser();
    for (const n of [2, 6]) {
      const err = (await putWeeklyPriorities(db, userId, {
        weekStartDate: WEEK,
        priorities: items(n),
      }).catch((e: unknown) => e)) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('INVALID_REQUEST');
      expect(err.httpStatus).toBe(400);
    }
  });

  it('PUT replaces atomically (created=false), bumps version again, and round-trips casing', async () => {
    const userId = await seedUser();
    await putWeeklyPriorities(db, userId, { weekStartDate: WEEK, priorities: items(3) });
    expect(await readVersion(userId)).toBe(2);

    const replaced = await putWeeklyPriorities(db, userId, {
      weekStartDate: WEEK,
      priorities: [
        { text: 'Only one set now', source: 'ai_suggested' },
        { text: 'Two', source: 'user' },
        { text: 'Three', source: 'user' },
      ],
    });
    expect(replaced.created).toBe(false); // existing row replaced, not inserted
    expect(replaced.response.weekPriorities.priorities[0]!.text).toBe('Only one set now');
    expect(await readVersion(userId)).toBe(3);

    // Exactly one row for (user, week) — replace, not append.
    const all = await db
      .select({ id: weeklyPriorities.id, priorities: weeklyPriorities.priorities })
      .from(weeklyPriorities)
      .where(
        and(eq(weeklyPriorities.userId, userId), eq(weeklyPriorities.weekStartDate, WEEK)),
      );
    expect(all).toHaveLength(1);

    // STORAGE is snake_case: the jsonb holds completed_at, not completedAt.
    const storedFirst = (all[0]!.priorities as Array<Record<string, unknown>>)[0]!;
    expect(storedFirst).toHaveProperty('completed_at', null);
    expect(storedFirst).not.toHaveProperty('completedAt');

    // API is camelCase: getWeeklyPriorities maps completed_at -> completedAt.
    const got = await getWeeklyPriorities(db, userId, WEEK);
    expect(got.weekPriorities.priorities[0]).toEqual({
      text: 'Only one set now',
      source: 'ai_suggested',
      completedAt: null,
    });
  });
});
