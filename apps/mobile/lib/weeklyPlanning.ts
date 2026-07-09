// Thin mobile client for the Sunday weekly-planning session (Chat 057 — parity with
// the web weekly-planning surface). Wraps the landed routes through the shared mobile
// API client (lib/api/client) — it does NOT re-implement any logic and does NOT open a
// second transport or session path (mirrors lib/calendarEvents.ts / lib/tasks.ts).
//
// HARD CONSTRAINT: zero @vesper/ai and zero @vesper/db imports. The Haiku/Sonnet
// suggestion is reached ONLY through the HTTP seam POST /weekly-priorities/suggest
// (DECISION B); server logic never enters the mobile bundle.
//
// Routes consumed:
//   GET  /weekly-priorities[?weekStart]     — landed chat 029; camelCase boundary.
//   PUT  /weekly-priorities                 — landed chat 029; items carry { text, source } only.
//   POST /weekly-priorities/suggest         — chat 057 seam; { suggestions }.
//   GET  /weekly-review[?weekStart]         — chat 057; prior-week completion.
//   GET  /calendar-events?start&end         — landed; server-expanded instances (via listCalendarEvents).
import { apiClient } from './api/client';
import { listCalendarEvents, type CalendarEventInstance } from './calendarEvents';

// --- Weekly priorities (029 boundary — camelCase) ---------------------------

export type PrioritySource = 'user' | 'ai_suggested';

/** A priority item as read from the §9 GET (camelCase; completedAt is always null). */
export interface WeeklyPriorityItem {
  text: string;
  source: PrioritySource;
  completedAt: string | null;
}

export interface WeeklyPriorities {
  /** null when no row exists yet for the resolved week. */
  id: string | null;
  weekStartDate: string;
  priorities: WeeklyPriorityItem[];
}

interface WeeklyPrioritiesResponse {
  weekPriorities: WeeklyPriorities;
}

/** PUT request item — text + source only (the server persists completed_at: null). */
export interface PriorityInput {
  text: string;
  source: PrioritySource;
}

/**
 * Read the priorities for a Monday-anchored week. `weekStart` (YYYY-MM-DD) selects an
 * explicit target week; omitted → the server's current UTC Monday. The server already
 * maps snake→camel, so this returns the camelCase shape verbatim.
 */
export async function getWeeklyPriorities(weekStart?: string): Promise<WeeklyPriorities> {
  const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : '';
  const res = await apiClient.get<WeeklyPrioritiesResponse>(`/weekly-priorities${qs}`);
  return res.weekPriorities;
}

/**
 * Create-or-replace the priorities for `weekStartDate`. Each item is reduced to
 * exactly { text, source } — completedAt/id and any other field a caller might carry
 * are dropped, so the PUT body never sends a completed_at (server sets it null).
 */
export async function putWeeklyPriorities(
  weekStartDate: string,
  priorities: readonly PriorityInput[],
): Promise<WeeklyPriorities> {
  const res = await apiClient.put<WeeklyPrioritiesResponse>('/weekly-priorities', {
    weekStartDate,
    priorities: priorities.map((p) => ({ text: p.text, source: p.source })),
  });
  return res.weekPriorities;
}

// --- AI suggestion seam (DECISION B) ----------------------------------------

export interface OutstandingTask {
  title: string;
  priority: string;
  estimatedMinutes?: number;
}

export interface PriorWeekCompletionInput {
  completed: number;
  total: number;
  priorPriorities?: string[];
}

export interface SuggestInput {
  outstandingTasks: OutstandingTask[];
  priorWeekCompletion: PriorWeekCompletionInput;
}

/** Fetch 3–5 AI-suggested priorities via the web seam (mobile never imports @vesper/ai). */
export async function suggestPriorities(input: SuggestInput): Promise<string[]> {
  const res = await apiClient.post<{ suggestions: string[] }>(
    '/weekly-priorities/suggest',
    input,
  );
  return res.suggestions;
}

// --- Prior-week completion (DECISION A) -------------------------------------

export interface WeeklyReview {
  weekStartDate: string;
  priorWeekStart: string;
  completed: number;
  total: number;
  rate: number | null;
}

/**
 * Read the prior-week block-completion review for the target planning week.
 * `weekStart` is the TARGET Monday (coming Monday for a Sunday session); the server
 * derives the reviewed [targetMonday − 7, targetMonday) window.
 */
export async function getPriorWeekCompletion(weekStart?: string): Promise<WeeklyReview> {
  const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : '';
  const res = await apiClient.get<{ weeklyReview: WeeklyReview }>(`/weekly-review${qs}`);
  return res.weeklyReview;
}

// --- Week math (pure; shared by the surface + the Sunday prompt) ------------

/** The Monday (UTC) of the week containing `d`, as YYYY-MM-DD (029 mondayOf parity). */
export function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const offset = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset),
  );
  return monday.toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD string by `n` days (UTC), returning YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The TARGET planning week's Monday: the COMING week's Monday (the week ahead). A
 * Sunday session plans the week starting the next day, so the reviewed prior week is
 * exactly the week just ending.
 */
export function comingMonday(now: Date = new Date()): string {
  return addDays(mondayOf(now), 7);
}

/** True when the LOCAL day is Sunday (the Sunday-prompt visibility gate). */
export function isLocalSunday(now: Date = new Date()): boolean {
  return now.getDay() === 0;
}

// --- Upcoming-week fixed events (DECISION D, read-only) ---------------------

/**
 * The inclusive Mon–Sun ISO window for a target-week Monday (YYYY-MM-DD): start at
 * the Monday 00:00:00.000Z, end at the Sunday 23:59:59.999Z (6 days later). Used to
 * read the target week's fixed events for the step-3 read-only review.
 */
export function weekWindow(monday: string): { start: string; end: string } {
  const start = new Date(`${monday}T00:00:00.000Z`);
  const sunday = new Date(start);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const end = new Date(
    Date.UTC(
      sunday.getUTCFullYear(),
      sunday.getUTCMonth(),
      sunday.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * List the target week's fixed events as server-expanded instances (Mon–Sun window).
 * Delegates to the landed calendar-events client — no second transport, no client-side
 * RRULE expander (see lib/calendarEvents.ts). READ-ONLY: step 3 never mutates events.
 */
export async function listWeekEvents(monday: string): Promise<CalendarEventInstance[]> {
  return listCalendarEvents(weekWindow(monday));
}

export type { CalendarEventInstance } from './calendarEvents';
