// @vitest-environment node
//
// Tests for the Fitness lift-log API (GET/POST /fitness/lift-log, DELETE
// /fitness/lift-log/[id]) — Chat ADD-C.
//
// Two suites:
//   * "Lift-log validation (pure)" — ungated Zod-schema assertions that run under plain
//     `pnpm test` (no DB). Covers the parse/validation path: a missing exercise_name or
//     set_number is rejected, and set_number <= 0 / reps < 0 / weight < 0 are rejected.
//   * "Lift-log API (integration)" — gated on VESPER_DB_TESTS; drives the exported
//     DB-layer functions directly against the chat-002 local-Supabase test DB. Asserts
//     real Postgres behaviour: own-row isolation, the local-day read-back boundary
//     (start_of_local_day), the workout_template_id FK, 404 on a not-owned delete, and
//     the three DB-enforced CHECK constraints (set_number > 0; reps >= 0; weight >= 0) —
//     without standing up Supabase Auth.
//
// To run the integration suite:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test fitness
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { ApiError } from '@vesper/shared';
import {
  PostLiftLogSchema,
  TailoredWorkoutRequestSchema,
} from '@vesper/shared/fitness';
import {
  listTodayLiftLog,
  createLiftLogEntry,
  deleteLiftLogEntry,
} from './operations';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Lift-log validation (pure)', () => {
  it('PostLiftLogSchema requires exerciseName + setNumber and rejects extras', () => {
    expect(PostLiftLogSchema.safeParse({ exerciseName: 'Squat', setNumber: 1 }).success).toBe(
      true,
    );
    expect(PostLiftLogSchema.safeParse({ setNumber: 1 }).success).toBe(false); // missing name
    expect(PostLiftLogSchema.safeParse({ exerciseName: 'Squat' }).success).toBe(false); // missing set
    expect(PostLiftLogSchema.safeParse({ exerciseName: '', setNumber: 1 }).success).toBe(false);
    expect(
      PostLiftLogSchema.safeParse({ exerciseName: 'Squat', setNumber: 1, nope: 1 }).success,
    ).toBe(false); // strict
  });

  it('PostLiftLogSchema rejects set_number <= 0, reps < 0, weight < 0', () => {
    expect(PostLiftLogSchema.safeParse({ exerciseName: 'Squat', setNumber: 0 }).success).toBe(
      false,
    );
    expect(PostLiftLogSchema.safeParse({ exerciseName: 'Squat', setNumber: -1 }).success).toBe(
      false,
    );
    expect(
      PostLiftLogSchema.safeParse({ exerciseName: 'Squat', setNumber: 1, reps: -1 }).success,
    ).toBe(false);
    expect(
      PostLiftLogSchema.safeParse({ exerciseName: 'Squat', setNumber: 1, weight: -1 }).success,
    ).toBe(false);
  });

  it('PostLiftLogSchema accepts the optional fields with the right shapes', () => {
    expect(
      PostLiftLogSchema.safeParse({
        exerciseName: 'Bench press',
        setNumber: 3,
        workoutTemplateId: '11111111-1111-1111-1111-111111111111',
        reps: 8,
        weight: 60.5,
        weightUnit: 'kg',
        loggedAt: '2026-08-24T12:00:00.000Z',
      }).success,
    ).toBe(true);
    // reps / weight / weightUnit / workoutTemplateId may be null (bodyweight / ad-hoc).
    expect(
      PostLiftLogSchema.safeParse({
        exerciseName: 'Push-up',
        setNumber: 1,
        reps: 12,
        weight: null,
        weightUnit: null,
        workoutTemplateId: null,
      }).success,
    ).toBe(true);
    // weightUnit is constrained to kg | lb.
    expect(
      PostLiftLogSchema.safeParse({ exerciseName: 'Squat', setNumber: 1, weightUnit: 'stone' })
        .success,
    ).toBe(false);
    // setNumber must be an integer.
    expect(
      PostLiftLogSchema.safeParse({ exerciseName: 'Squat', setNumber: 1.5 }).success,
    ).toBe(false);
  });

  it('TailoredWorkoutRequestSchema bounds energyScore to 1-10 and allows null/omitted', () => {
    expect(TailoredWorkoutRequestSchema.safeParse({}).success).toBe(true);
    expect(TailoredWorkoutRequestSchema.safeParse({ energyScore: 7 }).success).toBe(true);
    expect(TailoredWorkoutRequestSchema.safeParse({ energyScore: null }).success).toBe(true);
    expect(TailoredWorkoutRequestSchema.safeParse({ energyScore: 0 }).success).toBe(false);
    expect(TailoredWorkoutRequestSchema.safeParse({ energyScore: 11 }).success).toBe(false);
    expect(TailoredWorkoutRequestSchema.safeParse({ nope: 1 }).success).toBe(false); // strict
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Lift-log API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // lift_log_entries carries only a BEFORE UPDATE set_updated_at trigger (no audit
    // trigger), so a straight user delete cascades cleanly. Delete the child rows first
    // anyway for parity with the food-log precedent.
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM lift_log_entries WHERE user_id = ${id}::uuid`);
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`lift-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  // 1 — POST creates a set; user_id from the arg, exercise_name + set_number supplied,
  // optionals null.
  it('POST creates a set with the required columns supplied and optionals null', async () => {
    const userId = await seedUser();
    const res = await createLiftLogEntry(db, userId, {
      exerciseName: 'Deadlift',
      setNumber: 1,
    });

    expect(res.exerciseName).toBe('Deadlift');
    expect(res.setNumber).toBe(1);
    expect(res.workoutTemplateId).toBeNull();
    expect(res.reps).toBeNull();
    expect(res.weight).toBeNull();
    expect(res.weightUnit).toBeNull();
    expect(typeof res.loggedAt).toBe('string');
    expect(res.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  // 2 — POST stores reps / weight / weightUnit and reads weight back as a number.
  it('POST stores reps + weight + unit and returns weight as a number', async () => {
    const userId = await seedUser();
    const res = await createLiftLogEntry(db, userId, {
      exerciseName: 'Bench press',
      setNumber: 2,
      reps: 8,
      weight: 60.5,
      weightUnit: 'kg',
    });
    expect(res.reps).toBe(8);
    expect(res.weight).toBe(60.5);
    expect(res.weightUnit).toBe('kg');
  });

  // 3 — POST with a missing exerciseName -> 400 (the NOT-NULL-no-default column).
  it('POST with a missing exerciseName returns 400 INVALID_REQUEST', async () => {
    const userId = await seedUser();
    const err = (await createLiftLogEntry(db, userId, { setNumber: 1 }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.httpStatus).toBe(400);
  });

  // 4 — listTodayLiftLog returns only the caller's rows (own-row isolation).
  it('GET (today) lists only the session user rows', async () => {
    const userId = await seedUser();
    const otherId = await seedUser();
    await createLiftLogEntry(db, userId, { exerciseName: 'Mine', setNumber: 1 });
    await createLiftLogEntry(db, otherId, { exerciseName: 'Theirs', setNumber: 1 });

    const { entries } = await listTodayLiftLog(db, userId, 'UTC');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.exerciseName).toBe('Mine');
  });

  // 5 — the local-day boundary excludes a set logged before today (start_of_local_day).
  it('GET (today) excludes a set logged before the local day boundary', async () => {
    const userId = await seedUser();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await createLiftLogEntry(db, userId, {
      exerciseName: 'Old',
      setNumber: 1,
      loggedAt: twoDaysAgo,
    });
    await createLiftLogEntry(db, userId, { exerciseName: 'Fresh', setNumber: 1 });

    const { entries } = await listTodayLiftLog(db, userId, 'UTC');
    expect(entries.map((e) => e.exerciseName)).toEqual(['Fresh']);
  });

  // 6 — workout_template_id FK: a corpus id is stored and read back.
  it('POST stores a workout_template_id from the corpus when provided', async () => {
    const userId = await seedUser();
    const rows = (await db.execute(
      sql`SELECT id FROM workout_templates LIMIT 1`,
    )) as unknown as Array<{ id: string }>;
    // The seed migration populates workout_templates; if it is empty, skip the FK write.
    if (rows.length === 0) return;
    const workoutId = rows[0]!.id;

    const res = await createLiftLogEntry(db, userId, {
      exerciseName: 'From corpus',
      setNumber: 1,
      workoutTemplateId: workoutId,
    });
    expect(res.workoutTemplateId).toBe(workoutId);
  });

  // 7 — DELETE another user's entry -> 404 (own-row).
  it('DELETE an entry not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const created = await createLiftLogEntry(db, ownerId, {
      exerciseName: 'Owned',
      setNumber: 1,
    });

    const err = (await deleteLiftLogEntry(db, otherId, created.id).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 8 — DELETE removes the row; a second delete returns 404.
  it('DELETE removes the row; a second delete returns 404', async () => {
    const userId = await seedUser();
    const created = await createLiftLogEntry(db, userId, {
      exerciseName: 'To-delete',
      setNumber: 1,
    });

    await expect(deleteLiftLogEntry(db, userId, created.id)).resolves.toBeUndefined();

    const remaining = (await db.execute(
      sql`SELECT id FROM lift_log_entries WHERE id = ${created.id}::uuid`,
    )) as unknown as Array<{ id: string }>;
    expect(remaining).toHaveLength(0);

    const err = (await deleteLiftLogEntry(db, userId, created.id).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(404);
  });

  // 9 — DB CHECK: set_number <= 0 is rejected by the table constraint (raw insert
  // bypasses the boundary Zod to prove the DB enforces it).
  it('DB rejects set_number <= 0 (CHECK constraint)', async () => {
    const userId = await seedUser();
    await expect(
      db.execute(
        sql`INSERT INTO lift_log_entries (user_id, exercise_name, set_number)
            VALUES (${userId}::uuid, 'Squat', 0)`,
      ),
    ).rejects.toThrow();
  });

  // 10 — DB CHECK: reps < 0 is rejected by the table constraint.
  it('DB rejects reps < 0 (CHECK constraint)', async () => {
    const userId = await seedUser();
    await expect(
      db.execute(
        sql`INSERT INTO lift_log_entries (user_id, exercise_name, set_number, reps)
            VALUES (${userId}::uuid, 'Squat', 1, -1)`,
      ),
    ).rejects.toThrow();
  });

  // 11 — DB CHECK: weight < 0 is rejected by the table constraint.
  it('DB rejects weight < 0 (CHECK constraint)', async () => {
    const userId = await seedUser();
    await expect(
      db.execute(
        sql`INSERT INTO lift_log_entries (user_id, exercise_name, set_number, weight)
            VALUES (${userId}::uuid, 'Squat', 1, -1)`,
      ),
    ).rejects.toThrow();
  });
});
