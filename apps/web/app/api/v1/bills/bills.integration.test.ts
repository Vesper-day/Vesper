// @vitest-environment node
//
// Tests for the Bills API group (GET/POST /bills, PATCH/DELETE /bills/[id]) — the
// Chat 061 Finance/Bills module.
//
// Two suites:
//   * "Bills validation (pure)" — ungated; pure Zod-schema assertions that run under
//     plain `pnpm test` (no DB).
//   * "Bills API (integration)" — gated on VESPER_DB_TESTS; drives the exported
//     DB-layer functions (listBills/createBill/updateBill/deleteBill) directly
//     against the chat-002 local-Supabase test DB (Docker, direct connection 54322)
//     so they assert real Postgres behaviour (the numeric(10,2) + due_day CHECK 1..31,
//     nullable-default columns, own-row 404) without standing up Supabase Auth.
//
// bills is INTENTIONALLY EXCLUDED from audit coverage (TECHNICAL_SPEC §19: audit is
// scoped to medications + integrations only). There is NO audit_bills_changes
// trigger, so — unlike medications — teardown has no cascade-order hazard. We still
// delete seeded bills before the seeded user (via the auth.users cascade) to keep
// teardown clean.
//
// This file imports ONLY @vesper/db + @vesper/shared + ./operations — no
// rate-limiting / Upstash — so the ungated suite runs without any env. To run the
// integration suite:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test -- bills.integration
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { ApiError } from '@vesper/shared';
import {
  listBills,
  createBill,
  updateBill,
  deleteBill,
  PostBillSchema,
  PatchBillSchema,
  GetBillsQuerySchema,
} from './operations';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Bills validation (pure)', () => {
  it('PostBillSchema requires name + frequency and rejects extras', () => {
    expect(PostBillSchema.safeParse({ name: 'Rent', frequency: 'monthly' }).success).toBe(true);
    expect(PostBillSchema.safeParse({ frequency: 'monthly' }).success).toBe(false); // no name
    expect(PostBillSchema.safeParse({ name: 'Rent' }).success).toBe(false); // no frequency
    expect(
      PostBillSchema.safeParse({ name: 'Rent', frequency: 'monthly', nope: 1 }).success,
    ).toBe(false); // strict
  });

  it('PostBillSchema accepts the four bill_frequency_enum values, rejects junk', () => {
    for (const f of ['monthly', 'quarterly', 'annually', 'one_time']) {
      expect(PostBillSchema.safeParse({ name: 'B', frequency: f }).success).toBe(true);
    }
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'weekly' }).success).toBe(false);
  });

  it('PostBillSchema enforces amount >= 0, <= 2dp, and allows null', () => {
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', amount: 42.5 }).success).toBe(true);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', amount: 0 }).success).toBe(true);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', amount: null }).success).toBe(true);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', amount: -1 }).success).toBe(false);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', amount: 1.234 }).success).toBe(false);
  });

  it('PostBillSchema enforces dueDayOfMonth integer 1..31 or null', () => {
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', dueDayOfMonth: 1 }).success).toBe(true);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', dueDayOfMonth: 31 }).success).toBe(true);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', dueDayOfMonth: null }).success).toBe(true);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', dueDayOfMonth: 0 }).success).toBe(false);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', dueDayOfMonth: 32 }).success).toBe(false);
    expect(PostBillSchema.safeParse({ name: 'B', frequency: 'monthly', dueDayOfMonth: 1.5 }).success).toBe(false);
  });

  it('PatchBillSchema requires at least one field and allows null clears', () => {
    expect(PatchBillSchema.safeParse({}).success).toBe(false); // empty -> refine fails
    expect(PatchBillSchema.safeParse({ name: 'New name' }).success).toBe(true);
    expect(PatchBillSchema.safeParse({ amount: null }).success).toBe(true); // clears
    expect(PatchBillSchema.safeParse({ dueDayOfMonth: null }).success).toBe(true);
    expect(PatchBillSchema.safeParse({ category: null }).success).toBe(true);
    expect(PatchBillSchema.safeParse({ dueDayOfMonth: 40 }).success).toBe(false);
  });

  it('GetBillsQuerySchema is strict-empty (rejects unexpected params)', () => {
    expect(GetBillsQuerySchema.safeParse({}).success).toBe(true);
    expect(GetBillsQuerySchema.safeParse({ status: 'x' }).success).toBe(false);
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Bills API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // No audit_bills_changes trigger on bills, so there is no cascade-order hazard;
    // deleting auth.users cascades public.users -> bills. Explicitly clear any
    // seeded bills first anyway, to keep teardown deterministic.
    for (const id of createdUserIds) {
      await db.execute(sql`DELETE FROM bills WHERE user_id = ${id}::uuid`);
    }
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`bills-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  // 1 — POST creates a bill; NOT NULL cols supplied, nullable cols default to null.
  it('POST creates a bill with name + frequency and nullable columns defaulting to null', async () => {
    const userId = await seedUser();
    const res = await createBill(db, userId, { name: 'Rent', frequency: 'monthly' });

    expect(res.name).toBe('Rent');
    expect(res.frequency).toBe('monthly');
    expect(res.amount).toBeNull();
    expect(res.dueDayOfMonth).toBeNull();
    expect(res.category).toBeNull();
    expect(res.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  // 2 — POST persists all optional fields when provided (amount round-trips as number).
  it('POST persists amount / dueDayOfMonth / category when provided', async () => {
    const userId = await seedUser();
    const res = await createBill(db, userId, {
      name: 'Internet',
      frequency: 'monthly',
      amount: 59.99,
      dueDayOfMonth: 15,
      category: 'Utilities',
    });
    expect(res.amount).toBe(59.99);
    expect(res.dueDayOfMonth).toBe(15);
    expect(res.category).toBe('Utilities');
  });

  // 3 — GET returns only the caller's rows, ordered by due_day ASC NULLS LAST, name ASC.
  it('GET returns own rows only, ordered by due day then name', async () => {
    const userId = await seedUser();
    const otherId = await seedUser();
    await createBill(db, userId, { name: 'Phone', frequency: 'monthly', dueDayOfMonth: 20 });
    await createBill(db, userId, { name: 'Rent', frequency: 'monthly', dueDayOfMonth: 1 });
    await createBill(db, userId, { name: 'No-day', frequency: 'one_time' });
    await createBill(db, otherId, { name: 'Not mine', frequency: 'monthly', dueDayOfMonth: 5 });

    const { bills } = await listBills(db, userId);
    expect(bills.map((b) => b.name)).toEqual(['Rent', 'Phone', 'No-day']);
    expect(bills.every((b) => b.name !== 'Not mine')).toBe(true);
  });

  // 4 — due_day_of_month out of 1..31 -> 400 (schema guard, before the DB CHECK).
  it('POST with dueDayOfMonth out of 1..31 returns 400 INVALID_REQUEST', async () => {
    const userId = await seedUser();
    const err = (await createBill(db, userId, {
      name: 'Bad',
      frequency: 'monthly',
      dueDayOfMonth: 40,
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.httpStatus).toBe(400);
  });

  // 5 — PATCH partial update changes only the provided field; null clears a column.
  it('PATCH partial update changes only provided fields; null clears', async () => {
    const userId = await seedUser();
    const created = await createBill(db, userId, {
      name: 'Gym',
      frequency: 'monthly',
      amount: 30,
      dueDayOfMonth: 3,
      category: 'Health',
    });

    const renamed = await updateBill(db, userId, created.id, { name: 'Gym membership' });
    expect(renamed.name).toBe('Gym membership');
    expect(renamed.amount).toBe(30); // untouched
    expect(renamed.dueDayOfMonth).toBe(3); // untouched
    expect(renamed.category).toBe('Health'); // untouched

    const cleared = await updateBill(db, userId, created.id, { amount: null, category: null });
    expect(cleared.amount).toBeNull();
    expect(cleared.category).toBeNull();
    expect(cleared.name).toBe('Gym membership'); // untouched
  });

  // 6 — PATCH a bill owned by another user -> 404.
  it('PATCH a bill not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const bill = await createBill(db, ownerId, { name: 'Owned', frequency: 'monthly' });

    const err = (await updateBill(db, otherId, bill.id, { name: 'hijack' }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 7 — DELETE a bill owned by another user -> 404.
  it('DELETE a bill not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const bill = await createBill(db, ownerId, { name: 'Owned', frequency: 'monthly' });

    const err = (await deleteBill(db, otherId, bill.id).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 8 — DELETE removes the row; a second delete returns 404.
  it('DELETE removes the row; a second delete returns 404', async () => {
    const userId = await seedUser();
    const bill = await createBill(db, userId, { name: 'To delete', frequency: 'one_time' });

    await expect(deleteBill(db, userId, bill.id)).resolves.toBeUndefined();

    const remaining = (await db.execute(
      sql`SELECT id FROM bills WHERE id = ${bill.id}::uuid`,
    )) as unknown as Array<{ id: string }>;
    expect(remaining).toHaveLength(0);

    const err = (await deleteBill(db, userId, bill.id).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(404);
  });
});
