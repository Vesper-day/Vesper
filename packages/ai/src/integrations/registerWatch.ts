// registerWatch (Chat 065, re-homed to @vesper/ai by Chat 066) — create a Google
// Calendar push channel via events.watch.
//
// WHY THIS LIVES IN @vesper/ai (Chat 066 extraction): Chat 065 authored this in
// apps/web/lib/googleCalendar/registerWatch.ts. The 066 daily-cron renewal worker
// must re-register expiring channels, but a Cloudflare Worker cannot cleanly import
// a Next app's internal lib/ (apps/web exposes no package entry point for it, and the
// import would drag Next app config across the worker boundary). So the single
// implementation moved HERE — a worker-safe library that already depends on @vesper/db
// and is the cycle-free home for the GCal integration code (see googleCalendar.ts) —
// and apps/web/lib/googleCalendar/registerWatch.ts is now a thin re-export so 065's
// landed public path + test keep working. ONE registration path, importable by both
// the worker and the (deferred) Cutover call site.
//
// AUTHORED BUT NOT INVOKED IN DEV. Channel registration is Cutover-blocked (C-17):
// events.watch requires a publicly reachable, verified HTTPS `address`, which dev
// does not have. Its first real invocation is deferred to 034-W / Cutover.
//
// It POSTs to the Calendar events.watch endpoint with a generated channel id, the
// SAME deployment channel token the receiver validates (GOOGLE_WEBHOOK_CHANNEL_TOKEN),
// the webhook address built from NEXT_PUBLIC_APP_URL (the established base-URL env —
// no hardcoded domain), and type 'web_hook'. It returns { id, resourceId, expiration }.
// Persisting that state is persistChannelState (co-located) — this fn persists nothing.
//
// ENCRYPTION: the user's access token is decrypted through the @vesper/db libsodium
// path via a DYNAMIC import (import('@vesper/db/encryption')) — mirroring Chat 064.
// A static import would pull libsodium/WASM onto the module graph and break vitest's
// SSR transform for every consumer, so it is loaded lazily at call time only.
import { createDrizzleClient, sql, type Database } from '@vesper/db';

const PROVIDER = 'google_calendar';
const GOOGLE_WATCH_ENDPOINT =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch';
const WEBHOOK_PATH = '/webhooks/google-calendar';

/** The channel handle events.watch returns; all three are needed by the 066 renewal. */
export interface WatchChannel {
  id: string;
  resourceId: string;
  /** ms-epoch expiration as a string, or null if Google omitted it. */
  expiration: string | null;
}

export interface RegisterWatchOptions {
  /** Injected Drizzle client (tests / caller). Defaults to the canonical factory. */
  db?: Database;
  /** Injected fetch (tests). Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected channel id (tests / deterministic ids). Defaults to a random UUID. */
  channelId?: string;
  /** Optional channel expiration (ms epoch) requested from Google. */
  expirationMs?: number;
}

/** Columns read off the integrations row (snake_case migration columns). */
interface IntegrationRow {
  status: string;
  access_token_encrypted: Uint8Array | Buffer | null;
}

interface WatchResponse {
  id?: string;
  resourceId?: string;
  expiration?: string;
}

/** Coerce a bytea read-back (Buffer or Uint8Array from postgres-js) to a Buffer. */
function toBuffer(value: Uint8Array | Buffer): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

/**
 * Register a Google Calendar push channel for the user's primary calendar.
 * Returns the { id, resourceId, expiration } the renewal worker will later need.
 * Throws on a missing/unconnected integration, missing config, or a non-2xx from
 * Google — the caller decides how to surface those.
 */
export async function registerWatch(
  userId: string,
  options?: RegisterWatchOptions,
): Promise<WatchChannel> {
  const db = options?.db ?? createDrizzleClient();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const channelId = options?.channelId ?? crypto.randomUUID();

  const channelToken = process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN;
  if (!channelToken) {
    throw new Error('GOOGLE_WEBHOOK_CHANNEL_TOKEN is not configured.');
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is not configured.');
  }
  const address = `${appUrl.replace(/\/$/, '')}${WEBHOOK_PATH}`;

  // --- Load + decrypt the user's access token (dynamic import; see header note). --
  const rows = (await db.execute(sql`
    SELECT status, access_token_encrypted
    FROM integrations
    WHERE user_id = ${userId}::uuid AND provider = ${PROVIDER}
    LIMIT 1
  `)) as unknown as IntegrationRow[];

  const row = rows[0];
  if (!row || row.status !== 'connected' || !row.access_token_encrypted) {
    throw new Error('No connected Google Calendar integration to watch.');
  }

  const { decryptToken } = await import('@vesper/db/encryption');
  const accessToken = await decryptToken(toBuffer(row.access_token_encrypted));

  // --- events.watch: create the push channel. ------------------------------------
  const body: Record<string, unknown> = {
    id: channelId,
    type: 'web_hook',
    address,
    token: channelToken,
  };
  if (options?.expirationMs !== undefined) {
    body.expiration = String(options.expirationMs);
  }

  const res = await fetchImpl(GOOGLE_WATCH_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Google events.watch failed (status ${res.status}).`);
  }

  const json = (await res.json()) as WatchResponse;
  if (!json.id || !json.resourceId) {
    throw new Error('Google events.watch returned no channel id / resource id.');
  }

  return {
    id: json.id,
    resourceId: json.resourceId,
    expiration: json.expiration ?? null,
  };
}
