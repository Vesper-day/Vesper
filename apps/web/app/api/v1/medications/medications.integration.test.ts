// @vitest-environment node
//
// Tests for the Medications API group (GET/POST /medications, PATCH/DELETE
// /medications/[id]) — Chat 060.
//
// Two suites:
//   * "Medications validation (pure)" — ungated Zod-schema assertions that run under
//     plain `pnpm test` (no DB).
//   * "Medications API (integration)" — gated on VESPER_DB_TESTS; drives the exported
//     DB-layer functions directly against the chat-002 local-Supabase test DB (Docker,
//     direct connection 54322). Asserts real Postgres behaviour: the endDate CHECK,
//     the times[] round-trip, user-scoped 404, and the DB defaults — without standing
//     up Supabase Auth.
//
// This file imports ONLY @vesper/db + @vesper/shared + ./operations. To run the
// integration suite:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test -- medications.integration
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { ApiError } from '@vesper/shared';
import {
  listMedications,
  createMedication,
  updateMedication,
  deleteMedication,
  PostMedicationSchema,
  PatchMedicationSchema,
  GetMedicationsQuerySchema,
} from './operations';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Medications validation (pure)', () => {
  const valid = {
    name: 'Metformin',
    dose: '500mg',
    frequency: 'twice_daily' as const,
    times: ['08:00', '20:00'],
    startDate: '2026-07-01',
  };

  it('PostMedicationSchema requires name/dose/frequency/startDate and rejects extras', () => {
    expect(PostMedicationSchema.safeParse(valid).success).toBe(true);
    expect(PostMedicationSchema.safeParse({ ...valid, name: undefined }).success).toBe(false);
    expect(PostMedicationSchema.safeParse({ ...valid, dose: undefined }).success).toBe(false);
    expect(PostMedicationSchema.safeParse({ ...valid, frequency: undefined }).success).toBe(false);
    expect(PostMedicationSchema.safeParse({ ...valid, startDate: undefined }).success).toBe(false);
    expect(PostMedicationSchema.safeParse({ ...valid, nope: 1 }).success).toBe(false); // strict
  });

  it('PostMedicationSchema enforces the frequency enum', () => {
    for (const f of ['daily', 'twice_daily', 'weekly', 'custom']) {
      expect(PostMedicationSchema.safeParse({ ...valid, frequency: f }).success).toBe(true);
    }
    expect(PostMedicationSchema.safeParse({ ...valid, frequency: 'hourly' }).success).toBe(false);
  });

  it('PostMedicationSchema validates times as HH:MM[:SS] and rejects junk', () => {
    expect(PostMedicationSchema.safeParse({ ...valid, times: ['08:00:00'] }).success).toBe(true);
    expect(PostMedicationSchema.safeParse({ ...valid, times: [] }).success).toBe(true);
    expect(PostMedicationSchema.safeParse({ ...valid, times: undefined }).success).toBe(true);
    expect(PostMedicationSchema.safeParse({ ...valid, times: ['8:00'] }).success).toBe(false);
    expect(PostMedicationSchema.safeParse({ ...valid, times: ['24:00'] }).success).toBe(false);
    expect(PostMedicationSchema.safeParse({ ...valid, times: ['08:60'] }).success).toBe(false);
    expect(PostMedicationSchema.safeParse({ ...valid, times: ['noon'] }).success).toBe(false);
  });

  it('PostMedicationSchema rejects a non-date and endDate < startDate', () => {
    expect(PostMedicationSchema.safeParse({ ...valid, startDate: '2026-13-01' }).success).toBe(false);
    expect(PostMedicationSchema.safeParse({ ...valid, startDate: '2026-02-31' }).success).toBe(false);
    expect(
      PostMedicationSchema.safeParse({ ...valid, endDate: '2026-06-30' }).success,
    ).toBe(false); // before startDate 2026-07-01
    expect(
      PostMedicationSchema.safeParse({ ...valid, endDate: '2026-07-01' }).success,
    ).toBe(true); // equal is allowed
    expect(PostMedicationSchema.safeParse({ ...valid, endDate: null }).success).toBe(true);
  });

  it('PatchMedicationSchema requires at least one field and honours same-patch date ordering', () => {
    expect(PatchMedicationSchema.safeParse({}).success).toBe(false);
    expect(PatchMedicationSchema.safeParse({ dose: '1000mg' }).success).toBe(true);
    expect(PatchMedicationSchema.safeParse({ shiftOutOfQuietHours: true }).success).toBe(true);
    expect(PatchMedicationSchema.safeParse({ notes: null }).success).toBe(true);
    expect(
      PatchMedicationSchema.safeParse({ startDate: '2026-07-10', endDate: '2026-07-01' }).success,
    ).toBe(false);
    expect(
      PatchMedicationSchema.safeParse({ startDate: '2026-07-01', endDate: '2026-07-10' }).success,
    ).toBe(true);
  });

  it('GetMedicationsQuerySchema accepts empty and rejects unexpected params', () => {
    expect(GetMedicationsQuerySchema.safeParse({}).success).toBe(true);
    expect(GetMedicationsQuerySchema.safeParse({ status: 'active' }).success).toBe(false);
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Medications API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // medications carries an AFTER I/U/D audit trigger that writes security_audit_log,
    // whose user_id FK -> users is NON-deferrable. Letting `DELETE FROM auth.users`
    // CASCADE through medications fires that trigger for each cascaded row, inserting
    // an audit row that references the user being deleted in the SAME statement -> FK
    // violation. So delete the child medications FIRST (the trigger fires while the
    // user still exists -> OK), then delete the user; the accumulated security_audit_log
    // rows then cascade-delete cleanly (that table has no trigger). This child-first
    // ordering is REQUIRED for any hard delete of a user that owns audited rows
    // (medications / integrations) — see docs/CHAT_060_RESOLUTION_RECORD.md.
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM medications WHERE user_id = ${id}::uuid`);
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`meds-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  // 1 — POST creates a medication; NOT NULL cols set, defaults applied.
  it('POST creates a medication with NOT NULL columns supplied and DB defaults applied', async () => {
    const userId = await seedUser();
    const res = await createMedication(db, userId, {
      name: 'Metformin',
      dose: '500mg',
      frequency: 'twice_daily',
      times: ['08:00', '20:00'],
      startDate: '2026-07-01',
    });

    expect(res.name).toBe('Metformin');
    expect(res.dose).toBe('500mg');
    expect(res.frequency).toBe('twice_daily');
    expect(res.times).toEqual(['08:00:00', '20:00:00']); // time[] round-trips as HH:MM:SS
    expect(res.startDate).toBe('2026-07-01');
    expect(res.endDate).toBeNull();
    expect(res.notes).toBeNull();
    expect(res.shiftOutOfQuietHours).toBe(false); // default
  });

  // 2 — POST with omitted times defaults to [] (DB '{}').
  it('POST with omitted times stores an empty array', async () => {
    const userId = await seedUser();
    const res = await createMedication(db, userId, {
      name: 'Vitamin D',
      dose: '1000IU',
      frequency: 'daily',
      startDate: '2026-07-01',
    });
    expect(res.times).toEqual([]);
  });

  // 3 — GET returns only the caller's rows.
  it('GET lists only the session user rows', async () => {
    const userId = await seedUser();
    const otherId = await seedUser();
    await createMedication(db, userId, {
      name: 'Aspirin',
      dose: '81mg',
      frequency: 'daily',
      times: ['09:00'],
      startDate: '2026-07-01',
    });
    await createMedication(db, otherId, {
      name: 'Lisinopril',
      dose: '10mg',
      frequency: 'daily',
      times: ['09:00'],
      startDate: '2026-07-01',
    });

    const { medications: mine } = await listMedications(db, userId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.name).toBe('Aspirin');
  });

  // 4 — PATCH partial update changes only the provided field.
  it('PATCH partial update changes only the provided field', async () => {
    const userId = await seedUser();
    const created = await createMedication(db, userId, {
      name: 'Metformin',
      dose: '500mg',
      frequency: 'daily',
      times: ['08:00'],
      startDate: '2026-07-01',
    });

    const res = await updateMedication(db, userId, created.id, {
      dose: '1000mg',
      shiftOutOfQuietHours: true,
    });
    expect(res.dose).toBe('1000mg');
    expect(res.shiftOutOfQuietHours).toBe(true);
    expect(res.name).toBe('Metformin'); // untouched
    expect(res.frequency).toBe('daily'); // untouched
    expect(res.times).toEqual(['08:00:00']); // untouched
  });

  // 5 — POST endDate < startDate -> 400 (the DB CHECK is also mirrored in Zod).
  it('POST with endDate before startDate returns 400 INVALID_REQUEST', async () => {
    const userId = await seedUser();
    const err = (await createMedication(db, userId, {
      name: 'Bad',
      dose: '1mg',
      frequency: 'daily',
      startDate: '2026-07-10',
      endDate: '2026-07-01',
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.httpStatus).toBe(400);
  });

  // 6 — PATCH a medication owned by another user -> 404.
  it('PATCH a medication not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const created = await createMedication(db, ownerId, {
      name: 'Owned',
      dose: '1mg',
      frequency: 'daily',
      startDate: '2026-07-01',
    });

    const err = (await updateMedication(db, otherId, created.id, { dose: '2mg' }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 7 — DELETE another user's id -> 404.
  it('DELETE a medication not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const created = await createMedication(db, ownerId, {
      name: 'Owned',
      dose: '1mg',
      frequency: 'daily',
      startDate: '2026-07-01',
    });

    const err = (await deleteMedication(db, otherId, created.id).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 8 — DELETE removes the row; a second delete returns 404.
  it('DELETE removes the row; a second delete returns 404', async () => {
    const userId = await seedUser();
    const created = await createMedication(db, userId, {
      name: 'To-delete',
      dose: '1mg',
      frequency: 'daily',
      startDate: '2026-07-01',
    });

    await expect(deleteMedication(db, userId, created.id)).resolves.toBeUndefined();

    const remaining = (await db.execute(
      sql`SELECT id FROM medications WHERE id = ${created.id}::uuid`,
    )) as unknown as Array<{ id: string }>;
    expect(remaining).toHaveLength(0);

    const err = (await deleteMedication(db, userId, created.id).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(404);
  });
});
