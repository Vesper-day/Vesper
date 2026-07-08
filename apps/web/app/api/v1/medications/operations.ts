// Medications DB-layer core logic (Chat 060 — the Medications module), shared by:
//   GET    /api/v1/medications        -> listMedications
//   POST   /api/v1/medications        -> createMedication
//   PATCH  /api/v1/medications/[id]   -> updateMedication
//   DELETE /api/v1/medications/[id]   -> deleteMedication
//
// Mirrors tasks/operations.ts exactly: the pure functions + colocated Zod schemas
// live in this plain sibling module (a Next.js App Router route.ts may export only
// HTTP-method handlers + segment config). The route handlers import them; the
// integration tests drive them directly against the chat-002 local-Supabase test
// DB without standing up Supabase Auth.
//
// SCHEMA SOURCE: the Drizzle `medications` model in packages/db/src/schema/modules.ts,
// re-synced in chat 060 to the LIVE applied DDL (migrations 0006 + 0011 + migration
// 20). Columns: name, dose, frequency (medication_frequency_enum), times (time[]),
// start_date, end_date (nullable, CHECK end_date >= start_date), notes, and
// shift_out_of_quiet_hours (bool, default false). user_id ALWAYS comes from the
// authenticated session — NEVER from the request body.
//
// The ORM (non-raw) path returns timestamptz columns as JS `Date`; DATE columns come
// back as "YYYY-MM-DD" strings and TIME[] as "HH:MM:SS" string arrays (Drizzle string
// mode) — both already the wire shape, so no conversion is needed on read.
import { z } from 'zod';
import { medications, eq, and, sql, type Database } from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';

// --- Response contract (camelCase) ------------------------------------------
//
// times is a "HH:MM[:SS]" string[]; startDate/endDate are "YYYY-MM-DD" (endDate
// null when open-ended). No createdAt / updatedAt is serialized (mirrors tasks).
export interface MedicationResponse {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  times: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  notes: string | null;
  shiftOutOfQuietHours: boolean;
}

export interface MedicationListResponse {
  medications: MedicationResponse[];
}

type MedicationRow = typeof medications.$inferSelect;

function serializeMedication(row: MedicationRow): MedicationResponse {
  return {
    id: row.id,
    name: row.name,
    dose: row.dose,
    frequency: row.frequency,
    times: row.times ?? [],
    startDate: row.startDate,
    endDate: row.endDate ?? null,
    notes: row.notes ?? null,
    shiftOutOfQuietHours: row.shiftOutOfQuietHours,
  };
}

// --- Validation schemas ------------------------------------------------------

// medication_frequency_enum values (verified live via introspection).
const FREQUENCIES = ['daily', 'twice_daily', 'weekly', 'custom'] as const;

// A dose reminder time-of-day: "HH:MM" or "HH:MM:SS" (24-hour, zero-padded). The
// column is Postgres `time`, which round-trips as "HH:MM:SS"; both shapes accepted.
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const timeString = z
  .string()
  .regex(TIME_OF_DAY, 'Each time must be 24-hour HH:MM or HH:MM:SS.');

// A calendar date "YYYY-MM-DD" that is also a REAL date (rejects 2026-02-31).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z
  .string()
  .regex(ISO_DATE, 'Date must be YYYY-MM-DD.')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    return (
      dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d
    );
  }, 'Date is not a valid calendar date.');

// endDate >= startDate — lexicographic comparison is correct for zero-padded
// YYYY-MM-DD (mirrors the DB CHECK end_date IS NULL OR end_date >= start_date).
function endNotBeforeStart(startDate: string, endDate: string | null | undefined): boolean {
  if (endDate == null) return true;
  return endDate >= startDate;
}

export const PostMedicationSchema = z
  .object({
    name: z.string().min(1),
    dose: z.string().min(1),
    frequency: z.enum(FREQUENCIES),
    // times defaults to [] (the DB column default is '{}'); the UI supplies it
    // explicitly, but an omitted array is accepted and stored empty.
    times: z.array(timeString).optional(),
    startDate: dateString,
    endDate: dateString.nullable().optional(),
    notes: z.string().optional(),
    shiftOutOfQuietHours: z.boolean().optional(),
  })
  .strict()
  .refine((d) => endNotBeforeStart(d.startDate, d.endDate), {
    message: 'endDate must be on or after startDate.',
    path: ['endDate'],
  });

export type PostMedicationInput = z.infer<typeof PostMedicationSchema>;

export const PatchMedicationSchema = z
  .object({
    name: z.string().min(1).optional(),
    dose: z.string().min(1).optional(),
    frequency: z.enum(FREQUENCIES).optional(),
    times: z.array(timeString).optional(),
    startDate: dateString.optional(),
    endDate: dateString.nullable().optional(),
    notes: z.string().nullable().optional(),
    shiftOutOfQuietHours: z.boolean().optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.name !== undefined ||
      d.dose !== undefined ||
      d.frequency !== undefined ||
      d.times !== undefined ||
      d.startDate !== undefined ||
      d.endDate !== undefined ||
      d.notes !== undefined ||
      d.shiftOutOfQuietHours !== undefined,
    { message: 'At least one field is required.' },
  )
  // Cross-field check only when BOTH are present in the same patch. A one-sided
  // patch is re-checked against the stored row inside updateMedication.
  .refine(
    (d) =>
      d.startDate === undefined ||
      d.endDate === undefined ||
      endNotBeforeStart(d.startDate, d.endDate ?? null),
    { message: 'endDate must be on or after startDate.', path: ['endDate'] },
  );

export type PatchMedicationInput = z.infer<typeof PatchMedicationSchema>;

// GET takes no filter params today; strict-empty so an unexpected query 400s.
export const GetMedicationsQuerySchema = z.object({}).strict();

const MEDICATION_UUID = z.string().uuid();

// --- GET /medications --------------------------------------------------------

/**
 * List all of the user's medications, ordered by name ASC then start_date ASC.
 * user-scoped; returns only rows owned by {@link userId}.
 */
export async function listMedications(
  db: Database,
  userId: string,
): Promise<MedicationListResponse> {
  const rows = await db
    .select()
    .from(medications)
    .where(eq(medications.userId, userId))
    .orderBy(sql`${medications.name} ASC, ${medications.startDate} ASC`);

  return { medications: rows.map(serializeMedication) };
}

// --- POST /medications -------------------------------------------------------

/**
 * Create a medication for the user. user_id comes from the authenticated session
 * (NEVER the body). Supplies all NOT-NULL columns (name, dose, frequency,
 * start_date); times defaults to [] and shift_out_of_quiet_hours to false when
 * omitted (matching the DB defaults). Throws {@link ApiError} 400 (validation).
 */
export async function createMedication(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<MedicationResponse> {
  const parsed = PostMedicationSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  const [row] = await db
    .insert(medications)
    .values({
      userId,
      name: input.name,
      dose: input.dose,
      frequency: input.frequency,
      times: input.times ?? [],
      startDate: input.startDate,
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.shiftOutOfQuietHours !== undefined
        ? { shiftOutOfQuietHours: input.shiftOutOfQuietHours }
        : {}),
    })
    .returning();

  if (!row) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Medication insert returned no row.');
  }
  return serializeMedication(row);
}

// --- PATCH /medications/[id] -------------------------------------------------

/**
 * Partial-update one of the user's medications. Reads the existing row (user-scoped)
 * so a one-sided start/end date patch can be re-checked against the stored value,
 * then applies only the provided fields. updated_at is maintained by the
 * set_updated_at trigger; we never set it here.
 * Throws {@link ApiError}: 400 (validation), 404 (not found / not owned).
 */
export async function updateMedication(
  db: Database,
  userId: string,
  medicationId: unknown,
  rawBody: unknown,
): Promise<MedicationResponse> {
  if (typeof medicationId !== 'string' || !MEDICATION_UUID.safeParse(medicationId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Medication not found.');
  }

  const parsed = PatchMedicationSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ startDate: medications.startDate, endDate: medications.endDate })
      .from(medications)
      .where(and(eq(medications.id, medicationId), eq(medications.userId, userId)))
      .limit(1);
    if (!existing) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Medication not found.');
    }

    // Re-check the start/end ordering against the effective (post-patch) values so
    // a one-sided date change can't violate the DB CHECK.
    const effectiveStart = input.startDate ?? existing.startDate;
    const effectiveEnd =
      input.endDate !== undefined ? input.endDate : existing.endDate;
    if (!endNotBeforeStart(effectiveStart, effectiveEnd)) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'endDate must be on or after startDate.',
      );
    }

    const set: Partial<typeof medications.$inferInsert> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.dose !== undefined) set.dose = input.dose;
    if (input.frequency !== undefined) set.frequency = input.frequency;
    if (input.times !== undefined) set.times = input.times;
    if (input.startDate !== undefined) set.startDate = input.startDate;
    if (input.endDate !== undefined) set.endDate = input.endDate;
    if (input.notes !== undefined) set.notes = input.notes;
    if (input.shiftOutOfQuietHours !== undefined) {
      set.shiftOutOfQuietHours = input.shiftOutOfQuietHours;
    }

    const [row] = await tx
      .update(medications)
      .set(set)
      .where(and(eq(medications.id, medicationId), eq(medications.userId, userId)))
      .returning();
    if (!row) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Medication not found.');
    }
    return serializeMedication(row);
  });
}

// --- DELETE /medications/[id] ------------------------------------------------

/**
 * HARD-delete one of the user's medications. Throws {@link ApiError} 404 when the
 * row is absent or not owned by the caller.
 */
export async function deleteMedication(
  db: Database,
  userId: string,
  medicationId: unknown,
): Promise<void> {
  if (typeof medicationId !== 'string' || !MEDICATION_UUID.safeParse(medicationId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Medication not found.');
  }

  const deleted = await db
    .delete(medications)
    .where(and(eq(medications.id, medicationId), eq(medications.userId, userId)))
    .returning({ id: medications.id });

  if (deleted.length === 0) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Medication not found.');
  }
}
