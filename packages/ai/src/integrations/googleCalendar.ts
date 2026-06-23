// Google Calendar today-sync (Chat 064).
//
// PLACEMENT NOTE: the build plan named packages/shared/integrations/googleCalendar.ts,
// but this module is authored in @vesper/ai instead. Reason (live-repo truth):
//   - it consumes the chat-023 classifier (classifyCalendarEvent / ...Batch) which
//     lives in @vesper/ai, and returns the CalendarEvent type which is OWNED by
//     @vesper/ai (context/planContext.ts);
//   - @vesper/ai already depends on @vesper/db (raw SQL + encryption) and
//     @vesper/shared. Putting getTodayEvents in @vesper/shared would force
//     shared -> ai, and @vesper/ai already imports @vesper/shared => a build cycle.
// So @vesper/ai is the only cycle-free home that co-locates the classifier, the
// CalendarEvent type, and the sole consumer (synthesizePlan).
//
// WHAT THIS DOES: fetch the user's google_calendar integration row (RAW
// parameterized SQL — the pull-generated ORM model for `integrations` is stale),
// refresh the OAuth access token when it is within 5 minutes of expiry (or already
// expired), fetch today's primary-calendar events with the decrypted access token
// (scope calendar.readonly), classify ambiguous titles via the 023 classifier
// (rule-first; batched for 2+, single for exactly 1), and return them as the
// Layer-4 calendarEvents array for plan synthesis.
//
// ERROR LIFECYCLE (contract): on refresh failure (revoked access, missing refresh
// token, network) set status='error' + last_error and return []. The chat-099
// reconnect banner reads status='error' (NOT last_error IS NOT NULL), so a recovered
// transient error never flickers the banner. A Sentry breadcrumb is emitted on
// EVERY refresh attempt (user_id, response status, error code on non-2xx) so a
// transient error that later recovers stays visible even after last_error is
// overwritten. On a successful sync we bump last_synced_at.
//
// ENCRYPTION: reuses packages/db/src/encryption.ts as chat 063 wrote it
// (encryptToken / decryptToken; nonce-prepended XChaCha20-Poly1305 bytea, NO AAD —
// the 063 connect route encrypts without AAD, so we decrypt/re-encrypt without AAD).
// It is loaded with a DYNAMIC import (not a static one) for the SAME reason the
// @vesper/db barrel deliberately does not re-export it (see packages/db/src/index.ts):
// encryptToken/decryptToken drag in libsodium-wrappers (+ WASM), whose ESM entry
// fails vitest's SSR transform. A static import here would pull libsodium into the
// @vesper/ai barrel and the synthesizePlan module graph, breaking every consumer's
// test at import time. The dynamic import keeps libsodium off the import graph; it
// loads only when getTodayEvents actually reaches the crypto path at runtime.
//
// NOTE — classification output is computed for the 023 step (and surfaced as a
// breadcrumb summary) but is NOT carried in the pinned CalendarEvent shape
// ({ id, title, startTime, endTime }); the block_type a later chat (067 conflict UI)
// needs will travel in a future field, not this one.

import * as Sentry from '@sentry/nextjs';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import type { BlockType } from '@vesper/shared';

import type { CalendarEvent } from '../context/planContext';
import { classifyCalendarEvent } from '../classifyCalendarEvent';
import { classifyCalendarEventsBatch } from '../classifyCalendarEventsBatch';

const PROVIDER = 'google_calendar';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_ENDPOINT =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
/** Refresh proactively once the token is within this window of expiry. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

const REFRESH_BREADCRUMB = 'integrations.google-calendar.refresh';

export interface GetTodayEventsOptions {
  /** Injected Drizzle client (tests / route). Defaults to the canonical factory. */
  db?: Database;
  /** Injected clock (tests). Defaults to the real wall clock. */
  now?: Date;
}

/** The columns we read off the integrations row (snake_case migration columns). */
interface IntegrationRow {
  status: string;
  access_token_encrypted: Uint8Array | Buffer | null;
  refresh_token_encrypted: Uint8Array | Buffer | null;
  expires_at: string | Date | null;
}

interface GoogleTokenRefreshResponse {
  access_token: string;
  expires_in?: number;
}

interface GoogleEventItem {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Fetch today's Google Calendar events for a user, refreshing the OAuth token
 * automatically. Returns [] (and sets the reconnect flag) when the integration is
 * not connected or a refresh fails — never throws into the synthesis path.
 */
export async function getTodayEvents(
  userId: string,
  options?: GetTodayEventsOptions,
): Promise<CalendarEvent[]> {
  const db = options?.db ?? createDrizzleClient();
  const now = options?.now ?? new Date();

  try {
    const rows = (await db.execute(sql`
      SELECT status, access_token_encrypted, refresh_token_encrypted, expires_at
      FROM integrations
      WHERE user_id = ${userId}::uuid AND provider = ${PROVIDER}
      LIMIT 1
    `)) as unknown as IntegrationRow[];

    const row = rows[0];
    // No row at all: nothing was ever connected, so there is nothing to reconnect.
    if (!row) return [];

    // Already degraded (error) — the reconnect flag (status='error') is set; bail
    // with no Google call so a recovered-elsewhere flow is not disturbed. A
    // deliberate 'disconnected' is left untouched (we do NOT nag a user who chose
    // to disconnect); either way we make no Google request and return [].
    if (row.status !== 'connected') {
      if (row.status === 'error') {
        // Re-affirm the flag idempotently so the banner stays correct.
        await markReconnectNeeded(db, userId, 'integration already in error state');
      }
      return [];
    }

    // Load the encryption helper lazily (see header note: keeps libsodium off the
    // @vesper/ai import graph). vi.mock intercepts this dynamic import in tests.
    const { encryptToken, decryptToken } = await import('@vesper/db/encryption');

    // --- Resolve a usable access token, refreshing if near/!past expiry ----------
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    const needsRefresh =
      expiresAt === null || expiresAt.getTime() - now.getTime() <= REFRESH_SKEW_MS;

    let accessToken: string;
    if (needsRefresh) {
      if (!row.refresh_token_encrypted) {
        await markReconnectNeeded(
          db,
          userId,
          'access token expired and no refresh token is on file',
        );
        return [];
      }

      const refreshToken = await decryptToken(toBuffer(row.refresh_token_encrypted));
      const refreshed = await refreshAccessToken(refreshToken, userId);
      if (!refreshed.ok) {
        await markReconnectNeeded(db, userId, refreshed.error);
        return [];
      }

      accessToken = refreshed.accessToken;

      // Re-encrypt the new access token + expiry back to the row (same encryption
      // helper + no-AAD convention as the 063 connect site).
      const newAccessEncrypted = await encryptToken(accessToken);
      const newExpiresIso = new Date(
        now.getTime() + refreshed.expiresIn * 1000,
      ).toISOString();
      await db.execute(sql`
        UPDATE integrations SET
          access_token_encrypted = ${newAccessEncrypted},
          expires_at = ${newExpiresIso}::timestamptz,
          updated_at = now()
        WHERE user_id = ${userId}::uuid AND provider = ${PROVIDER}
      `);
    } else {
      if (!row.access_token_encrypted) {
        await markReconnectNeeded(db, userId, 'integration row is missing an access token');
        return [];
      }
      accessToken = await decryptToken(toBuffer(row.access_token_encrypted));
    }

    // --- Fetch today's events ----------------------------------------------------
    const fetched = await fetchTodayEvents(accessToken, now);
    if (!fetched.ok) {
      await markReconnectNeeded(db, userId, fetched.error);
      return [];
    }

    // Classify (rule-first; batched for 2+ ambiguous, single for exactly 1). The
    // result drives the 023 step + a breadcrumb summary; it is not carried in the
    // pinned CalendarEvent shape (see header note).
    await classifyEvents(fetched.events);

    // Successful sync.
    await db.execute(sql`
      UPDATE integrations SET last_synced_at = now(), updated_at = now()
      WHERE user_id = ${userId}::uuid AND provider = ${PROVIDER}
    `);

    return fetched.events;
  } catch (err) {
    // Defensive: an unexpected failure must degrade to [] (plan synthesis still
    // runs) rather than throw. We do NOT force status='error' here — an unexpected
    // crash is not evidence the user must reconnect.
    Sentry.captureException(err, {
      tags: { provider: PROVIDER, op: 'getTodayEvents' },
      extra: { userId },
    });
    return [];
  }
}

/** Coerce a bytea read-back (Buffer or Uint8Array from postgres-js) to a Buffer. */
function toBuffer(value: Uint8Array | Buffer): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

/**
 * Set the reconnect flag: status='error' + last_error. The chat-099 banner keys
 * off status='error' (not last_error), so overwriting last_error on a later
 * recovery does not flicker the banner.
 */
async function markReconnectNeeded(
  db: Database,
  userId: string,
  reason: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE integrations SET
      status = 'error',
      last_error = ${reason},
      updated_at = now()
    WHERE user_id = ${userId}::uuid AND provider = ${PROVIDER}
  `);
}

type RefreshResult =
  | { ok: true; accessToken: string; expiresIn: number }
  | { ok: false; error: string };

/**
 * Exchange the decrypted refresh token for a fresh access token. Emits a Sentry
 * breadcrumb on EVERY attempt (success and failure) so transient errors stay
 * visible even after last_error is overwritten on recovery.
 */
async function refreshAccessToken(
  refreshToken: string,
  userId: string,
): Promise<RefreshResult> {
  const clientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    Sentry.addBreadcrumb({
      category: REFRESH_BREADCRUMB,
      level: 'error',
      message: 'google oauth client not configured',
      data: { userId, status: 'config-error' },
    });
    return { ok: false, error: 'Google OAuth client id/secret are not configured.' };
  }

  let res: globalThis.Response;
  try {
    res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
  } catch {
    Sentry.addBreadcrumb({
      category: REFRESH_BREADCRUMB,
      level: 'error',
      message: 'network error reaching Google token endpoint',
      data: { userId, status: 'network-error' },
    });
    return { ok: false, error: 'Could not reach Google to refresh the access token.' };
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const code = body.error ?? 'unknown';
    Sentry.addBreadcrumb({
      category: REFRESH_BREADCRUMB,
      level: 'error',
      message: 'token refresh rejected by Google',
      data: { userId, status: res.status, code },
    });
    return {
      ok: false,
      error: `Google rejected the token refresh (status ${res.status}, ${code}).`,
    };
  }

  Sentry.addBreadcrumb({
    category: REFRESH_BREADCRUMB,
    level: 'info',
    message: 'token refresh succeeded',
    data: { userId, status: res.status },
  });
  const json = (await res.json()) as GoogleTokenRefreshResponse;
  return {
    ok: true,
    accessToken: json.access_token,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : 3600,
  };
}

type FetchResult =
  | { ok: true; events: CalendarEvent[] }
  | { ok: false; error: string };

/** Local start/end-of-day bounds for the given clock, as ISO instants. */
function dayBoundsIso(now: Date): { timeMin: string; timeMax: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

/** GET today's primary-calendar events (singleEvents expanded, time-ordered). */
async function fetchTodayEvents(accessToken: string, now: Date): Promise<FetchResult> {
  const { timeMin, timeMax } = dayBoundsIso(now);
  const url =
    `${GOOGLE_EVENTS_ENDPOINT}?singleEvents=true&orderBy=startTime` +
    `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;

  let res: globalThis.Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    return { ok: false, error: 'Could not reach Google Calendar to fetch events.' };
  }

  if (!res.ok) {
    return { ok: false, error: `Google Calendar event fetch failed (status ${res.status}).` };
  }

  const json = (await res.json()) as { items?: GoogleEventItem[] };
  const items = json.items ?? [];
  const events: CalendarEvent[] = [];
  for (const item of items) {
    const start = item.start?.dateTime ?? item.start?.date;
    const end = item.end?.dateTime ?? item.end?.date;
    if (!item.id || !start || !end) continue; // skip malformed rows
    events.push({
      id: item.id,
      title: item.summary ?? '(untitled)',
      startTime: start,
      endTime: end,
    });
  }
  return { ok: true, events };
}

// --- Classification routing ---------------------------------------------------
//
// Rule-first: obvious-marker titles are classified by these regexes and NEVER reach
// Haiku. Only titles that match NO rule are "ambiguous" and routed to the 023
// classifier — batched when 2+ need it (the common morning case), single when
// exactly 1 (no batch overhead for a one-element list).
const RULES: ReadonlyArray<{ re: RegExp; type: BlockType }> = [
  { re: /\b(gym|workout|run|jog|yoga|pilates|crossfit|lift|cardio|spin|swim)\b/i, type: 'fitness' },
  { re: /\b(lunch|dinner|breakfast|brunch|meal)\b/i, type: 'nutrition' },
  { re: /\b(sleep|nap|bedtime)\b/i, type: 'sleep' },
  { re: /\b(commute|flight|train|drive to)\b/i, type: 'commute' },
];

function ruleClassify(title: string): BlockType | null {
  for (const rule of RULES) {
    if (rule.re.test(title)) return rule.type;
  }
  return null;
}

/**
 * Classify each event's title. Rule-matched titles are resolved locally; the rest
 * are routed to the 023 classifier (batch for 2+, single for exactly 1). Returns
 * one (BlockType | null) per input event, in order.
 */
async function classifyEvents(events: CalendarEvent[]): Promise<(BlockType | null)[]> {
  const result: (BlockType | null)[] = events.map(() => null);
  const ambiguous: number[] = [];

  events.forEach((event, i) => {
    const ruled = ruleClassify(event.title);
    if (ruled) {
      result[i] = ruled;
    } else {
      ambiguous.push(i);
    }
  });

  if (ambiguous.length === 1) {
    const idx = ambiguous[0]!;
    result[idx] = await classifyCalendarEvent(events[idx]!.title);
  } else if (ambiguous.length >= 2) {
    const titles = ambiguous.map((i) => events[i]!.title);
    const classifications = await classifyCalendarEventsBatch(titles);
    ambiguous.forEach((eventIdx, k) => {
      result[eventIdx] = classifications[k] ?? null;
    });
  }

  Sentry.addBreadcrumb({
    category: 'integrations.google-calendar.classify',
    level: 'info',
    message: 'classified today calendar events',
    data: {
      total: events.length,
      ambiguous: ambiguous.length,
      classified: result.filter((b) => b !== null).length,
    },
  });

  return result;
}
