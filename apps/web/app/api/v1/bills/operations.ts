// Bills DB-layer core logic (Chat 061 — the Finance/Bills module), shared by:
//   GET    /api/v1/bills        -> listBills
//   POST   /api/v1/bills        -> createBill
//   PATCH  /api/v1/bills/[id]   -> updateBill
//   DELETE /api/v1/bills/[id]   -> deleteBill
//
// Mirrors tasks/operations.ts + medications/operations.ts: the pure functions +
// colocated Zod schemas live in this plain sibling module (a Next.js App Router
// route.ts may export only HTTP-method handlers + segment config). The route
// handlers import them; the integration tests drive them directly against the
// chat-002 local-Supabase test DB without standing up Supabase Auth.
//
// SCHEMA SOURCE — RAW SQL (not the ORM model):
// The Drizzle `bills` model in packages/db/src/schema/modules.ts has DRIFTED from
// the live migration-0006 DDL: it carries an `autopay` column that does NOT exist
// on the DB, marks amount/due_day_of_month NOT NULL (both are nullable live), and
// OMITS the real `frequency` (bill_frequency_enum NOT NULL) and `category` columns.
// Using it would fail at runtime. Per the calendar_events (052-W) / push-tokens
// raw-SQL fallback precedent we run raw, parameterized SQL against the migration
// columns, always scoped by user_id. (No migration + no model edit is in scope for
// 061; the model drift is flagged for a future 075/schema-resync pass.)
//
// LIVE bills columns (migration 20260601000006_modules.sql, §3 table 11):
//   id, user_id, name (NOT NULL), amount numeric(10,2) NULL,
//   due_day_of_month integer NULL CHECK 1..31, frequency bill_frequency_enum NOT NULL,
//   category text NULL, created_at, updated_at.
//
// Field mapping (camelCase request/response <-> snake_case column):
//   name <-> name, amount <-> amount, dueDayOfMonth <-> due_day_of_month,
//   frequency <-> frequency, category <-> category. user_id ALWAYS comes from the
//   authenticated session — NEVER from the request body.
import { z } from 'zod';
import { sql, type Database } from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';

// --- Response contract (camelCase) ------------------------------------------
//
// amount is a number (dollars, 2dp) or null; dueDayOfMonth is 1..31 or null. No
// createdAt / updatedAt is serialized (mirrors tasks / medications).
export interface BillResponse {
  id: string;
  name: string;
  amount: number | null;
  dueDayOfMonth: number | null;
  frequency: string;
  category: string | null;
}

export interface BillListResponse {
  bills: BillResponse[];
}

// --- Validation schemas ------------------------------------------------------

// bill_frequency_enum values (migration 0006 / TECHNICAL_SPEC §3 table 11).
const FREQUENCIES = ['monthly', 'quarterly', 'annually', 'one_time'] as const;

// amount: money >= 0 with at most 2 decimal places, fits numeric(10,2)
// (< 100_000_000). Accepts a JSON number; null clears it.
const amountField = z
  .number()
  .nonnegative('amount must be zero or positive.')
  .max(99_999_999.99, 'amount is too large.')
  .refine((n) => Math.round(n * 100) === n * 100, {
    message: 'amount may have at most 2 decimal places.',
  });

// due_day_of_month: integer 1..31 or null (mirrors the DB CHECK).
const dueDayField = z
  .number()
  .int('dueDayOfMonth must be a whole number.')
  .min(1, 'dueDayOfMonth must be between 1 and 31.')
  .max(31, 'dueDayOfMonth must be between 1 and 31.');

export const PostBillSchema = z
  .object({
    name: z.string().min(1),
    frequency: z.enum(FREQUENCIES),
    // amount / dueDayOfMonth / category are nullable columns — omit to store NULL.
    amount: amountField.nullable().optional(),
    dueDayOfMonth: dueDayField.nullable().optional(),
    category: z.string().min(1).nullable().optional(),
  })
  .strict();

export type PostBillInput = z.infer<typeof PostBillSchema>;

export const PatchBillSchema = z
  .object({
    name: z.string().min(1).optional(),
    frequency: z.enum(FREQUENCIES).optional(),
    amount: amountField.nullable().optional(),
    dueDayOfMonth: dueDayField.nullable().optional(),
    category: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.name !== undefined ||
      d.frequency !== undefined ||
      d.amount !== undefined ||
      d.dueDayOfMonth !== undefined ||
      d.category !== undefined,
    { message: 'At least one field is required.' },
  );

export type PatchBillInput = z.infer<typeof PatchBillSchema>;

// GET takes no filter params today; strict-empty so an unexpected query 400s.
export const GetBillsQuerySchema = z.object({}).strict();

const BILL_UUID = z.string().uuid();

// --- Row helpers -------------------------------------------------------------

// postgres-js returns numeric as a string (preserves precision) and integer as a
// number. Normalise both to the wire shape on read.
interface StoredRow {
  id: string;
  name: string;
  amount: string | number | null;
  due_day_of_month: number | null;
  frequency: string;
  category: string | null;
}

function serializeBill(row: StoredRow): BillResponse {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount == null ? null : Number(row.amount),
    dueDayOfMonth: row.due_day_of_month ?? null,
    frequency: row.frequency,
    category: row.category ?? null,
  };
}

const SELECT_COLS = sql`id, name, amount, due_day_of_month, frequency, category`;

// --- GET /bills --------------------------------------------------------------

/**
 * List all of the user's bills, ordered by due_day_of_month ASC NULLS LAST then
 * name ASC. user-scoped; returns only rows owned by {@link userId}.
 */
export async function listBills(
  db: Database,
  userId: string,
): Promise<BillListResponse> {
  const rows = (await db.execute(sql`
    SELECT ${SELECT_COLS}
    FROM bills
    WHERE user_id = ${userId}::uuid
    ORDER BY due_day_of_month ASC NULLS LAST, name ASC
  `)) as unknown as StoredRow[];

  return { bills: rows.map(serializeBill) };
}

// --- POST /bills -------------------------------------------------------------

/**
 * Create a bill for the user. user_id comes from the authenticated session (NEVER
 * the body). Supplies the two NOT-NULL columns (name, frequency); amount,
 * due_day_of_month and category are stored NULL when omitted (nullable columns).
 * Throws {@link ApiError} 400 (validation).
 */
export async function createBill(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<BillResponse> {
  const parsed = PostBillSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;
  const amount = input.amount ?? null;
  const dueDay = input.dueDayOfMonth ?? null;
  const category = input.category ?? null;

  const rows = (await db.execute(sql`
    INSERT INTO bills (user_id, name, amount, due_day_of_month, frequency, category)
    VALUES (
      ${userId}::uuid,
      ${input.name},
      ${amount}::numeric,
      ${dueDay}::integer,
      ${input.frequency}::bill_frequency_enum,
      ${category}
    )
    RETURNING ${SELECT_COLS}
  `)) as unknown as StoredRow[];

  const row = rows[0];
  if (!row) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Bill insert returned no row.');
  }
  return serializeBill(row);
}

// --- PATCH /bills/[id] -------------------------------------------------------

/**
 * Partial-update one of the user's bills. Reads the stored row first (user-scoped;
 * 404 if absent/not owned), merges the patch, then writes the merged values. A
 * present key with `null` clears the (nullable) column; an absent key leaves it
 * unchanged. updated_at is maintained by the set_updated_at trigger — never set
 * here.
 * Throws {@link ApiError}: 400 (validation), 404 (not found / not owned).
 */
export async function updateBill(
  db: Database,
  userId: string,
  billId: unknown,
  rawBody: unknown,
): Promise<BillResponse> {
  if (typeof billId !== 'string' || !BILL_UUID.safeParse(billId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Bill not found.');
  }

  const parsed = PatchBillSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const existingRows = (await tx.execute(sql`
      SELECT ${SELECT_COLS}
      FROM bills
      WHERE id = ${billId}::uuid AND user_id = ${userId}::uuid
      LIMIT 1
    `)) as unknown as StoredRow[];
    const existing = existingRows[0];
    if (!existing) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Bill not found.');
    }

    const nextName = input.name ?? existing.name;
    const nextFrequency = input.frequency ?? existing.frequency;
    const nextAmount =
      input.amount !== undefined
        ? input.amount
        : existing.amount == null
          ? null
          : Number(existing.amount);
    const nextDueDay =
      input.dueDayOfMonth !== undefined ? input.dueDayOfMonth : existing.due_day_of_month;
    const nextCategory =
      input.category !== undefined ? input.category : existing.category;

    const rows = (await tx.execute(sql`
      UPDATE bills SET
        name             = ${nextName},
        amount           = ${nextAmount}::numeric,
        due_day_of_month = ${nextDueDay}::integer,
        frequency        = ${nextFrequency}::bill_frequency_enum,
        category         = ${nextCategory}
      WHERE id = ${billId}::uuid AND user_id = ${userId}::uuid
      RETURNING ${SELECT_COLS}
    `)) as unknown as StoredRow[];

    const row = rows[0];
    if (!row) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Bill not found.');
    }
    return serializeBill(row);
  });
}

// --- DELETE /bills/[id] ------------------------------------------------------

/**
 * HARD-delete one of the user's bills. Throws {@link ApiError} 404 when the row is
 * absent or not owned by the caller.
 */
export async function deleteBill(
  db: Database,
  userId: string,
  billId: unknown,
): Promise<void> {
  if (typeof billId !== 'string' || !BILL_UUID.safeParse(billId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Bill not found.');
  }

  const rows = (await db.execute(sql`
    DELETE FROM bills
    WHERE id = ${billId}::uuid AND user_id = ${userId}::uuid
    RETURNING id
  `)) as unknown as Array<{ id: string }>;

  if (rows.length === 0) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Bill not found.');
  }
}
