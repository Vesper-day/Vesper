// Weekly Priorities DB-layer core logic (§9 GET + PUT /api/v1/weekly-priorities),
// extracted from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config; these pure functions are invalid Route exports, so they live here.
// route.ts imports them; the integration test drives them directly against the
// chat-002 local-Supabase test DB.
//
// STALE-MODEL CHECK (build-plan Chat 029): the `weekly_priorities` Drizzle model
// (daily-planning.ts:148-172) matches §3 #6 column-for-column — id/user_id/
// week_start_date/priorities(jsonb default [])/created_at/updated_at + UNIQUE
// (user_id, week_start_date). Because it is CURRENT we use the Drizzle query
// builder (not raw SQL). The `priorities` jsonb column is untyped, so STORAGE is
// snake_case ({ text, source, completed_at }) per §3 and we map to/from the
// camelCase §9 API shape ({ text, source, completedAt }) at this boundary.
//
// PUT invariant (build-plan L1107): base_profile_version is incremented IN THE
// SAME TRANSACTION as the upsert — priorities feed plan-gen context, so the cache
// key must invalidate. Mirrors the §9 modules-toggle / profile-PUT version-bump
// precedent (profile/operations.ts, toggleModule.ts).
import {
  weeklyPriorities,
  userProfiles,
  sql,
  eq,
  and,
  type Database,
} from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';
import {
  PutWeeklyPrioritiesSchema,
  type PriorityItem,
  type PrioritySource,
  type WeeklyPrioritiesResponse,
} from './schemas';

// Storage shape of a single priority (jsonb, snake_case per §3 #6).
interface StoredPriority {
  text: string;
  source: PrioritySource;
  completed_at?: string | null;
}

/**
 * The Monday (UTC) of the week containing `d`, as a YYYY-MM-DD string. week_start_date
 * is always the Monday of the week (§3 #6). getUTCDay(): 0=Sun..6=Sat, so the
 * offset back to Monday is (day + 6) % 7 days.
 */
export function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const offset = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset),
  );
  return monday.toISOString().slice(0, 10);
}

function serializePriorities(raw: unknown): PriorityItem[] {
  const items = Array.isArray(raw) ? (raw as StoredPriority[]) : [];
  return items.map((p) => ({
    text: p.text,
    source: p.source,
    completedAt: p.completed_at ?? null,
  }));
}

/**
 * Read the user's priorities for a Monday-anchored week. `weekStart` (YYYY-MM-DD)
 * selects an explicit week; when omitted the current UTC week's Monday is used.
 * Returns an empty (id: null) shape when no row exists for that week.
 */
export async function getWeeklyPriorities(
  db: Database,
  userId: string,
  weekStart?: string,
  now: Date = new Date(),
): Promise<WeeklyPrioritiesResponse> {
  const weekStartDate = weekStart ?? mondayOf(now);

  const rows = await db
    .select({
      id: weeklyPriorities.id,
      weekStartDate: weeklyPriorities.weekStartDate,
      priorities: weeklyPriorities.priorities,
    })
    .from(weeklyPriorities)
    .where(
      and(
        eq(weeklyPriorities.userId, userId),
        eq(weeklyPriorities.weekStartDate, weekStartDate),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { weekPriorities: { id: null, weekStartDate, priorities: [] } };
  }
  return {
    weekPriorities: {
      id: row.id,
      weekStartDate: row.weekStartDate,
      priorities: serializePriorities(row.priorities),
    },
  };
}

export interface PutWeeklyPrioritiesResult {
  response: WeeklyPrioritiesResponse;
  /** true when a new row was inserted (HTTP 201), false when an existing row was replaced (200). */
  created: boolean;
}

/**
 * Create-or-replace the priorities for (userId, weekStartDate). The whole array
 * is replaced atomically via upsert on the unique constraint. user_id comes from
 * the authenticated session, week_start_date + priorities from the validated body.
 * Throws {@link ApiError} 400 on a body that fails validation (incl. array length
 * outside 3..5) or 404 when the user has no user_profiles row to bump.
 */
export async function putWeeklyPriorities(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<PutWeeklyPrioritiesResult> {
  const parsed = PutWeeklyPrioritiesSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const { weekStartDate, priorities } = parsed.data;

  // PUT items carry only { text, source }; persist with completed_at: null so the
  // stored shape is uniform (§3 #6 storage shape).
  const stored: StoredPriority[] = priorities.map((p) => ({
    text: p.text,
    source: p.source,
    completed_at: null,
  }));

  return db.transaction(async (tx) => {
    // created-vs-replaced detection: a pre-existence check inside the tx. The
    // unique constraint guarantees correctness under the upsert regardless.
    const existing = await tx
      .select({ id: weeklyPriorities.id })
      .from(weeklyPriorities)
      .where(
        and(
          eq(weeklyPriorities.userId, userId),
          eq(weeklyPriorities.weekStartDate, weekStartDate),
        ),
      )
      .limit(1);
    const created = existing.length === 0;

    const upserted = await tx
      .insert(weeklyPriorities)
      .values({ userId, weekStartDate, priorities: stored })
      .onConflictDoUpdate({
        target: [weeklyPriorities.userId, weeklyPriorities.weekStartDate],
        set: { priorities: stored, updatedAt: sql`now()` },
      })
      .returning({
        id: weeklyPriorities.id,
        weekStartDate: weeklyPriorities.weekStartDate,
        priorities: weeklyPriorities.priorities,
      });
    const row = upserted[0];
    if (!row) {
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Upsert returned no row.');
    }

    // INVARIANT: bump base_profile_version IN THIS TRANSACTION (priorities feed
    // plan-gen context; the cache key must invalidate). Mirrors profile PUT.
    const bumped = await tx
      .update(userProfiles)
      .set({
        baseProfileVersion: sql`${userProfiles.baseProfileVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(userProfiles.userId, userId))
      .returning({ baseProfileVersion: userProfiles.baseProfileVersion });
    if (bumped.length === 0) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'User profile not found');
    }

    return {
      response: {
        weekPriorities: {
          id: row.id,
          weekStartDate: row.weekStartDate,
          priorities: serializePriorities(row.priorities),
        },
      },
      created,
    };
  });
}
