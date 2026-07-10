// POST /webhooks/google-calendar (Chat 065) — Google Calendar push receiver.
//
// UNAUTHENTICATED raw handler, deliberately OUTSIDE /api/v1: Google's push service
// is the only legitimate caller and it cannot present a Vesper session, so this is
// NOT a §9 route — no createRoute, no validateSession, no checkAppVersion. It follows
// the same raw-handler + secret-validation shape as /api/v1/internal/auth-event
// (the only prior secret-validated, non-session endpoint); there is no pre-existing
// route under app/webhooks (Stripe/Apple webhooks live on Cloudflare Workers, so
// there is no Next precedent for this directory).
//
// CONTRACT (Google "watch channel" push): the request BODY is empty; the entire
// payload is a set of X-Goog-* headers —
//   X-Goog-Channel-ID       channel UUID set at watch time
//   X-Goog-Channel-Token    opaque token set at watch time (our validation secret)
//   X-Goog-Resource-ID      opaque watched-resource id
//   X-Goog-Resource-State   sync | exists | not_exists
//   X-Goog-Resource-URI     resource URI to sync from
//   X-Goog-Message-Number   monotonic per-channel counter
//
// BEHAVIOR:
//   - token mismatch      → 401, NO sync, Sentry alert (a mismatch is a misconfigured
//                           channel or a spoof; Google is the only legitimate sender).
//   - resource-state sync → 200, NO sync (the one-shot handshake at watch creation).
//   - resource-state exists → trigger an incremental sync, then 200.
// Every receipt writes ONE structured Sentry entry carrying the channel id, resource
// id, message number, and the token-validation result; when a sync runs, its outcome
// (success | no-changes | error) is APPENDED to that same entry so receipt→sync is a
// single observable event.
//
// TOKEN SOURCE (persistence gap): registration is Cutover-deferred (C-17) and NO
// per-channel token is persisted (the integrations table has no channel columns),
// so the token is validated against a DEPLOYMENT secret env var
// GOOGLE_WEBHOOK_CHANNEL_TOKEN — never a DB row, never hardcoded. The classification
// + constant-time compare lives in the pure ./validateNotification helper.
//
// SYNC SEAM (inline, not enqueued): the deferred-job table `delayed_jobs` exists but
// has NO enqueue helper and NO tick worker dispatching job_types in the repo today,
// so the enqueue seam is not reusable. The 'exists' trigger therefore RE-INVOKES the
// existing Chat 064 entry point getTodayEvents (a re-fetch through the existing seam,
// NOT a true Google delta — no syncToken is persisted anywhere to do a real delta).
//
// CHANNEL→USER MAPPING (deferred): mapping a channel id back to a user requires a
// persisted channel_id→user_id row, which does not exist (channel-state persistence
// is the 066/Cutover gap). resolveChannelUser therefore returns null in dev; an
// unresolvable channel logs syncOutcome:'error' but still returns 200 so Google does
// not retry-storm a permanent config gap. The production mapping is owned by 066.
import * as Sentry from '@sentry/nextjs';
import { getTodayEvents } from '@vesper/ai';
import { classifyNotification } from './validateNotification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SyncOutcome = 'success' | 'no-changes' | 'error';

/**
 * Resolve the channel's user. DEFERRED: no channel_id→user_id store exists yet
 * (066/Cutover persistence gap), so this always returns null in dev. Kept as a
 * single seam so 066 can wire the real lookup here without touching the handler.
 */
async function resolveChannelUser(_channelId: string): Promise<string | null> {
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const classification = classifyNotification(
    request.headers,
    process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN,
  );

  // The single structured receipt entry (a sync outcome is appended below).
  const receipt: Record<string, unknown> = {
    msg: 'webhooks.google-calendar.receipt',
    channelId: classification.channelId,
    resourceId: classification.resourceId,
    messageNumber: classification.messageNumber,
    resourceState: classification.resourceState,
    tokenValid: classification.tokenValid,
    action: classification.action,
  };

  // --- Token mismatch: 401, no sync, alert. --------------------------------------
  if (!classification.tokenValid) {
    Sentry.captureMessage('Google Calendar webhook token mismatch', {
      level: 'warning',
      tags: { provider: 'google_calendar', op: 'webhook', outcome: 'token-mismatch' },
      extra: receipt,
    });
    return new Response(null, { status: 401 });
  }

  // --- Handshake / nothing-to-do: 200, no sync. ----------------------------------
  if (classification.action !== 'sync') {
    Sentry.captureMessage('Google Calendar webhook receipt', {
      level: 'info',
      tags: { provider: 'google_calendar', op: 'webhook', action: classification.action },
      extra: receipt,
    });
    return new Response(null, { status: 200 });
  }

  // --- 'exists' → trigger an incremental sync inline, then 200. -------------------
  let syncOutcome: SyncOutcome;
  try {
    const userId = classification.channelId
      ? await resolveChannelUser(classification.channelId)
      : null;
    if (!userId) {
      // Unresolvable channel (deferred mapping / torn-down channel). Do NOT make
      // Google retry a permanent gap — record and ack.
      syncOutcome = 'error';
      receipt.syncError = 'channel could not be mapped to a user (mapping deferred to 066)';
    } else {
      const events = await getTodayEvents(userId);
      syncOutcome = events.length > 0 ? 'success' : 'no-changes';
    }
  } catch (err) {
    // getTodayEvents is defensive (returns [] rather than throwing), but guard the
    // seam anyway so a receiver-level failure still acks Google.
    syncOutcome = 'error';
    receipt.syncError = err instanceof Error ? err.message : String(err);
  }

  receipt.syncOutcome = syncOutcome;
  Sentry.captureMessage('Google Calendar webhook receipt', {
    level: syncOutcome === 'error' ? 'error' : 'info',
    tags: { provider: 'google_calendar', op: 'webhook', action: 'sync', syncOutcome },
    extra: receipt,
  });
  return new Response(null, { status: 200 });
}
