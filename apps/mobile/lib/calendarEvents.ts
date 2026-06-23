// Thin mobile client for the built-in calendar (Chat 053 — parity with the 052-W
// web calendar). Wraps the existing /api/v1/calendar-events route set through the
// shared mobile API client (lib/api/client) — it does NOT re-implement CRUD and
// does NOT open a second transport or session path.
//
// RECURRENCE — why there is no client-side expander here:
//   react-native-calendars has NO native RRULE support (it renders whatever marked
//   dates / agenda items it is handed). The system DOES expand recurrence, but it
//   does so SERVER-SIDE: GET /api/v1/calendar-events already returns concrete
//   instances for the requested window (apps/web/.../operations.ts:listCalendarEvents
//   → recurrence.ts), and that route only exposes expanded instances (there is no
//   raw-series read endpoint to feed a client expander). Re-expanding here would be
//   a SECOND expander that could drift from the canonical web one — exactly what the
//   052-W parity contract forbids. So this module consumes server-expanded instances
//   and never persists or recomputes them. The expander stays single-sourced on the
//   server.
//
// Field mapping (camelCase request/response <-> snake_case column) is handled by the
// route; this module speaks the route's camelCase contract verbatim.
//   title <-> title, startTime <-> start_time, endTime <-> end_time, rrule <-> rrule
import { apiClient } from './api/client';

/**
 * One entry per concrete instance in the read window (GET response item). Recurring
 * instances share the series `id` and carry the series `rrule`; `recurring` flags
 * them. Mirrors operations.ts CalendarEventInstance.
 */
export interface CalendarEventInstance {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  rrule: string | null;
  recurring: boolean;
}

interface CalendarEventListResponse {
  events: CalendarEventInstance[];
}

/** The stored series row returned by create/update (NOT an expanded instance). */
export interface CalendarEventSeries {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  rrule: string | null;
}

interface CalendarEventResponse {
  event: CalendarEventSeries;
}

/** Inclusive ISO window for a list read. */
export interface CalendarWindow {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

/** Create/edit payload — the only fields the series owns. */
export interface CalendarEventDraft {
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  rrule?: string | null;
}

/**
 * Thrown when a draft's range is inverted (endTime <= startTime). The DB CHECK and
 * the route also reject this, but the client rejects early for instant UX feedback
 * — and so an invalid write never leaves the device.
 */
export class InvertedRangeError extends Error {
  constructor(message = 'End time must be after start time.') {
    super(message);
    this.name = 'InvertedRangeError';
  }
}

function assertForwardRange(startTime: string, endTime: string): void {
  if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    throw new InvertedRangeError();
  }
}

/**
 * Build the write body. Only the four series fields are ever sent — any extra
 * instance-shaped fields a caller might pass (id, recurring, …) are dropped, so an
 * expanded instance can never be written back as if it were the series.
 */
function toWriteBody(draft: CalendarEventDraft): {
  title: string;
  startTime: string;
  endTime: string;
  rrule: string | null;
} {
  return {
    title: draft.title,
    startTime: draft.startTime,
    endTime: draft.endTime,
    rrule: draft.rrule ?? null,
  };
}

/**
 * List the user's events as concrete instances within [window.start, window.end].
 * Recurring series are already expanded server-side; one-off rows come back as-is.
 */
export async function listCalendarEvents(
  window: CalendarWindow,
): Promise<CalendarEventInstance[]> {
  const qs = `?start=${encodeURIComponent(window.start)}&end=${encodeURIComponent(window.end)}`;
  const res = await apiClient.get<CalendarEventListResponse>(`/calendar-events${qs}`);
  return res.events;
}

/**
 * Create one event. Rejects an inverted range before the network call. rrule omitted
 * => one-off (sent as null).
 */
export async function createCalendarEvent(
  draft: CalendarEventDraft,
): Promise<CalendarEventSeries> {
  assertForwardRange(draft.startTime, draft.endTime);
  const res = await apiClient.post<CalendarEventResponse>('/calendar-events', toWriteBody(draft));
  return res.event;
}

/**
 * Update one event by SERIES id. Editing any instance of a recurring series edits the
 * WHOLE series (the route keys on the series id; there is no per-occurrence editing —
 * same limitation as web). Rejects an inverted range before the network call.
 */
export async function updateCalendarEvent(
  id: string,
  draft: CalendarEventDraft,
): Promise<CalendarEventSeries> {
  assertForwardRange(draft.startTime, draft.endTime);
  const res = await apiClient.patch<CalendarEventResponse>(
    `/calendar-events/${id}`,
    toWriteBody(draft),
  );
  return res.event;
}

/** Hard-delete one event by SERIES id (deletes the whole recurring series). */
export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiClient.delete<void>(`/calendar-events/${id}`);
}
