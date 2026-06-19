// Request Zod + response-shape types for the Weekly Priorities API group (§9).
//
// Co-located. CASING SPLIT (build-plan Chat 029): the `priorities` jsonb column
// is UNTYPED in the Drizzle model (daily-planning.ts: `t.jsonb('priorities')`),
// so per §3 #6 STORAGE is snake_case — each item is { text, source, completed_at }.
// The API boundary (§9) is camelCase — each item is { text, source, completedAt }.
// operations.ts maps snake_case <-> camelCase at serialize/persist time.
//
// PUT request items carry ONLY { text, source } (no completedAt) per §9; the
// completed_at lifecycle is set elsewhere, never on create-or-replace.
import { z } from 'zod';

// source enum, shared by request + response item shapes (§3 #6).
export const PrioritySourceSchema = z.enum(['user', 'ai_suggested']);
export type PrioritySource = z.infer<typeof PrioritySourceSchema>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// PUT request item: text + source only (§9).
export const PriorityInputSchema = z
  .object({
    text: z.string().trim().min(1),
    source: PrioritySourceSchema,
  })
  .strict();

export type PriorityInput = z.infer<typeof PriorityInputSchema>;

// PUT body. Array length 3..5 enforced at the schema level (§3 #6 / §9: "Validates
// that the array length is between 3 and 5"). length < 3 or > 5 -> 400.
export const PutWeeklyPrioritiesSchema = z
  .object({
    weekStartDate: z.string().regex(DATE_REGEX),
    priorities: z.array(PriorityInputSchema).min(3).max(5),
  })
  .strict();

export type PutWeeklyPrioritiesRequest = z.infer<typeof PutWeeklyPrioritiesSchema>;

// Optional ?weekStart=YYYY-MM-DD on GET (defaults to the current Monday-anchored
// week when absent).
export const WeekStartQuerySchema = z
  .string()
  .regex(DATE_REGEX)
  .optional();

// --- §9 response shapes (camelCase) ------------------------------------------

export interface PriorityItem {
  text: string;
  source: PrioritySource;
  completedAt: string | null;
}

export interface WeeklyPrioritiesResponse {
  weekPriorities: {
    // null when no row exists yet for the resolved week (GET on an empty week).
    id: string | null;
    weekStartDate: string;
    priorities: PriorityItem[];
  };
}
