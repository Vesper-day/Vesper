// Built-in calendar_events CRUD core logic (TECHNICAL_SPEC §3 #25), shared by:
//   GET    /api/v1/calendar-events             -> listCalendarEvents (window read)
//   POST   /api/v1/calendar-events             -> createCalendarEvent (201)
//   PATCH  /api/v1/calendar-events/[eventId]   -> updateCalendarEvent
//   DELETE /api/v1/calendar-events/[eventId]   -> deleteCalendarEvent
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config, so the pure functions + Zod schemas live in this sibling module
// (mirrors tasks/operations.ts, push-tokens/operations.ts). Route handlers import
// them; the integration test drives them directly against the local-Supabase test
// DB (push-tokens precedent) without standing up Supabase Auth.
//
// SCHEMA SOURCE — RAW SQL (not the ORM model):
// There is NO generated Drizzle model for calendar_events in packages/db/src
// (the table is migration 20260601000018; the drizzle-kit pull that would emit
// its model has not been run). Per the push-tokens precedent we run raw,
// parameterized SQL against the migration columns, always scoped by user_id.
//
// Field mapping (camelCase request/response <-> snake_case column):
//   title <-> title, startTime <-> start_time, endTime <-> end_time, rrule <-> rrule
//
// RECURRENCE: the table stores ONLY the rrule string + the series start/end.
// Recurring rows are EXPANDED ON READ for the requested window (see recurrence.ts)
// and NEVER written back. Persisting expanded instances is a bug (§3 #25).
import { z } from 'zod';
import { sql, type Database } from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';
import { expandRecurrence, isValidRrule } from './recurrence';

// --- Response contract (camelCase) ------------------------------------------
//
// One entry per *instance* in the read window. Recurring instances share the
// series `id` and carry the series `rrule`; `recurring` flags them so the client
// can show repeat affordances. startTime/endTime are ISO-8601 instants.
export interface CalendarEventInstance {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  rrule: string | null;
  recurring: boolean;
}

export interface CalendarEventListResponse {
  events: CalendarEventInstance[];
}

// The single-row shape returned by create/update (the stored series row, not an
// expanded instance).
export interface CalendarEventResponse {
  event: {
    id: string;
    title: string;
    startTime: string; // ISO 8601
    endTime: string; // ISO 8601
    rrule: string | null;
  };
}

// --- Validation schemas ------------------------------------------------------

const ISO_DATETIME = { offset: true } as const;
const EVENT_UUID = z.string().uuid();

const rruleField = z
  .string()
  .min(1)
  .refine(isValidRrule, { message: 'rrule must be a valid iCalendar RRULE string.' });

// CREATE: title + startTime + endTime required; rrule optional/nullable. The
// inverted-range guard (endTime <= startTime) is enforced HERE, before insert,
// matching the DB CHECK (end_time > start_time).
export const PostCalendarEventSchema = z
  .object({
    title: z.string().min(1),
    startTime: z.string().datetime(ISO_DATETIME),
    endTime: z.string().datetime(ISO_DATETIME),
    rrule: rruleField.nullable().optional(),
  })
  .strict()
  .refine((d) => new Date(d.endTime).getTime() > new Date(d.startTime).getTime(), {
    message: 'endTime must be after startTime.',
    path: ['endTime'],
  });

export type PostCalendarEventInput = z.infer<typeof PostCalendarEventSchema>;

// PATCH: every field optional; at least one required. The combined-range guard is
// applied in updateCalendarEvent after merging with the stored row (a lone
// startTime or endTime cannot be range-checked in isolation).
export const PatchCalendarEventSchema = z
  .object({
    title: z.string().min(1).optional(),
    startTime: z.string().datetime(ISO_DATETIME).optional(),
    endTime: z.string().datetime(ISO_DATETIME).optional(),
    rrule: rruleField.nullable().optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.title !== undefined ||
      d.startTime !== undefined ||
      d.endTime !== undefined ||
      d.rrule !== undefined,
    { message: 'At least one field is required.' },
  );

export type PatchCalendarEventInput = z.infer<typeof PatchCalendarEventSchema>;

// GET window query — both bounds required, valid ISO, end strictly after start.
export const GetCalendarEventsQuerySchema = z
  .object({
    start: z.string().datetime(ISO_DATETIME),
    end: z.string().datetime(ISO_DATETIME),
  })
  .strict()
  .refine((d) => new Date(d.end).getTime() > new Date(d.start).getTime(), {
    message: 'end must be after start.',
    path: ['end'],
  });

// --- Row helpers -------------------------------------------------------------

// timestamptz comes back from postgres-js as a Date; the raw `sql` path may also
// surface strings. new Date(...) normalises both before .toISOString().
interface StoredRow {
  id: string;
  title: string;
  start_time: string | Date;
  end_time: string | Date;
  rrule: string | null;
}

function toIso(v: string | Date): string {
  return new Date(v).toISOString();
}

// --- GET /calendar-events ----------------------------------------------------

/**
 * List the user's calendar events as concrete instances within [start, end].
 *
 * Two reads, both user-scoped:
 *   1. one-off rows (rrule IS NULL) that OVERLAP the window;
 *   2. ALL recurring rows (rrule IS NOT NULL) — a series whose stored start_time
 *      predates the window can still recur into it — each expanded via
 *      recurrence.ts and clamped to the window.
 * Nothing is written. Result is sorted ascending by instance start.
 *
 * @throws {@link ApiError} 400 on an invalid/!end>start window.
 */
export async function listCalendarEvents(
  db: Database,
  userId: string,
  startParam: string | null | undefined,
  endParam: string | null | undefined,
): Promise<CalendarEventListResponse> {
  const parsed = GetCalendarEventsQuerySchema.safeParse({
    start: startParam ?? undefined,
    end: endParam ?? undefined,
  });
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid window.',
    );
  }
  const windowStart = new Date(parsed.data.start);
  const windowEnd = new Date(parsed.data.end);

  const oneOff = (await db.execute(sql`
    SELECT id, title, start_time, end_time, rrule
    FROM calendar_events
    WHERE user_id = ${userId}::uuid
      AND rrule IS NULL
      AND start_time <= ${windowEnd.toISOString()}::timestamptz
      AND end_time   >= ${windowStart.toISOString()}::timestamptz
  `)) as unknown as StoredRow[];

  const recurring = (await db.execute(sql`
    SELECT id, title, start_time, end_time, rrule
    FROM calendar_events
    WHERE user_id = ${userId}::uuid
      AND rrule IS NOT NULL
  `)) as unknown as StoredRow[];

  const events: CalendarEventInstance[] = [];

  for (const row of oneOff) {
    events.push({
      id: row.id,
      title: row.title,
      startTime: toIso(row.start_time),
      endTime: toIso(row.end_time),
      rrule: null,
      recurring: false,
    });
  }

  for (const row of recurring) {
    const instances = expandRecurrence({
      rrule: row.rrule as string,
      seriesStart: new Date(row.start_time),
      seriesEnd: new Date(row.end_time),
      windowStart,
      windowEnd,
    });
    for (const inst of instances) {
      events.push({
        id: row.id,
        title: row.title,
        startTime: inst.start.toISOString(),
        endTime: inst.end.toISOString(),
        rrule: row.rrule,
        recurring: true,
      });
    }
  }

  events.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { events };
}

// --- POST /calendar-events ---------------------------------------------------

/**
 * Create one calendar event for the user. user_id comes from the session, never
 * the body. An inverted range (endTime <= startTime) is rejected by validation
 * before the insert, matching the DB CHECK.
 *
 * @throws {@link ApiError} 400 on validation failure.
 */
export async function createCalendarEvent(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<CalendarEventResponse> {
  const parsed = PostCalendarEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;
  const rrule = input.rrule ?? null;

  const rows = (await db.execute(sql`
    INSERT INTO calendar_events (user_id, title, start_time, end_time, rrule)
    VALUES (
      ${userId}::uuid,
      ${input.title},
      ${input.startTime}::timestamptz,
      ${input.endTime}::timestamptz,
      ${rrule}
    )
    RETURNING id, title, start_time, end_time, rrule
  `)) as unknown as StoredRow[];

  const row = rows[0];
  if (!row) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Calendar event insert returned no row.');
  }
  return serializeRow(row);
}

// --- PATCH /calendar-events/[eventId] ---------------------------------------

/**
 * Partial-update one of the user's calendar events. Reads the stored row first
 * (user-scoped; 404 if absent/not owned), merges the patch, then enforces
 * end_time > start_time on the MERGED range before writing. `rrule: null` clears
 * recurrence. updated_at is maintained by the set_updated_at trigger — never set
 * here.
 *
 * @throws {@link ApiError} 400 (validation / inverted range), 404 (not found).
 */
export async function updateCalendarEvent(
  db: Database,
  userId: string,
  eventId: unknown,
  rawBody: unknown,
): Promise<CalendarEventResponse> {
  if (typeof eventId !== 'string' || !EVENT_UUID.safeParse(eventId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Calendar event not found.');
  }

  const parsed = PatchCalendarEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  const existingRows = (await db.execute(sql`
    SELECT id, title, start_time, end_time, rrule
    FROM calendar_events
    WHERE id = ${eventId}::uuid AND user_id = ${userId}::uuid
    LIMIT 1
  `)) as unknown as StoredRow[];
  const existing = existingRows[0];
  if (!existing) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Calendar event not found.');
  }

  const nextTitle = input.title ?? existing.title;
  const nextStart = input.startTime ?? toIso(existing.start_time);
  const nextEnd = input.endTime ?? toIso(existing.end_time);
  const nextRrule = input.rrule !== undefined ? input.rrule : existing.rrule;

  if (new Date(nextEnd).getTime() <= new Date(nextStart).getTime()) {
    throw new ApiError(ErrorCode.INVALID_REQUEST, 'endTime must be after startTime.');
  }

  const rows = (await db.execute(sql`
    UPDATE calendar_events SET
      title      = ${nextTitle},
      start_time = ${nextStart}::timestamptz,
      end_time   = ${nextEnd}::timestamptz,
      rrule      = ${nextRrule}
    WHERE id = ${eventId}::uuid AND user_id = ${userId}::uuid
    RETURNING id, title, start_time, end_time, rrule
  `)) as unknown as StoredRow[];

  const row = rows[0];
  if (!row) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Calendar event not found.');
  }
  return serializeRow(row);
}

// --- DELETE /calendar-events/[eventId] --------------------------------------

/**
 * HARD-delete one of the user's calendar events. 404 when the row is absent or
 * not owned by the caller.
 *
 * @throws {@link ApiError} 404.
 */
export async function deleteCalendarEvent(
  db: Database,
  userId: string,
  eventId: unknown,
): Promise<void> {
  if (typeof eventId !== 'string' || !EVENT_UUID.safeParse(eventId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Calendar event not found.');
  }

  const rows = (await db.execute(sql`
    DELETE FROM calendar_events
    WHERE id = ${eventId}::uuid AND user_id = ${userId}::uuid
    RETURNING id
  `)) as unknown as Array<{ id: string }>;

  if (rows.length === 0) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Calendar event not found.');
  }
}

function serializeRow(row: StoredRow): CalendarEventResponse {
  return {
    event: {
      id: row.id,
      title: row.title,
      startTime: toIso(row.start_time),
      endTime: toIso(row.end_time),
      rrule: row.rrule,
    },
  };
}
