// gcal-channel-renewal (Chat 066) — daily-cron module that renews Google Calendar push
// channels before Google's 7-day maximum expires, so push sync does not silently die.
//
// DISPATCH: registered at the 5am UTC tick of the consolidated workers/daily-cron worker
// (Decision 20 — all scheduled workers are named modules dispatched by UTC hour). The
// entrypoint (../src/index.ts) routes hour-of-UTC → module.
//
// WHAT IT DOES:
//   1. Fetch the coarse candidate set (google_calendar integrations that HAVE a channel).
//   2. selectChannelsToRenew (pure, ./gcal-channel-renewal.logic) applies the real
//      decision: status='connected' AND channel_expiration within 24h (Decision 19).
//   3. For each, re-register via @vesper/ai registerWatch (Google has no "renew" — you
//      create a fresh channel) and persist the new { id, resourceId, expiration } via
//      the single persistChannelState path. A single failure is ISOLATED (Sentry-logged,
//      does NOT abort the batch — other users still process).
//   4. Emit ONE structured run summary (attempted/succeeded/failed) to Sentry. This is
//      also the heartbeat the 097a "worker-didn't-run" defense keys on: the module logs
//      exactly one run-summary event per dispatch, expected within a 90-minute window of
//      the 5am UTC tick.
//
// SINK = option B (Sentry-only): the run is observed via the structured summary below,
// NOT a completion_log row. completion_log.user_id is NOT NULL + FK, so there is no
// valid aggregate/run-level row; per-user rows would need a new completion_event_enum
// value (a non-reversible ALTER TYPE) for no analytics consumer. Per-user FAILED
// renewals are still Sentry-logged individually (below), regardless of sink choice.
//
// DB ACCESS: the canonical @vesper/db client (createDrizzleClient), which selects the
// Supavisor transaction-mode pooler in a worker/serverless context (RUNTIME set,
// Decision 04). There is no in-repo Worker→Postgres precedent yet; the real Cloudflare
// runtime driver/binding (Hyperdrive etc.) is an operator/Cutover concern — this module
// is Cutover-deferred anyway (no channels exist until registerWatch's first Cutover call).
import * as Sentry from '@sentry/nextjs';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
// Import from @vesper/ai SUBPATHS, not the barrel: the barrel constructs the Anthropic
// SDK client at import (client.ts), which has no place in a cron worker's bundle. The
// subpaths pull only the two integration modules (deps: @vesper/db + dynamic encryption).
import { registerWatch } from '@vesper/ai/integrations/registerWatch';
import { persistChannelState } from '@vesper/ai/integrations/persistChannelState';
import {
  selectChannelsToRenew,
  type RenewableIntegration,
} from './gcal-channel-renewal.logic';

/** Raw integrations columns read for the renewal decision. */
interface RawIntegrationRow {
  id: string;
  user_id: string;
  status: string;
  channel_expiration: string | Date | null;
}

export interface RenewalDeps {
  /** Injected Drizzle client (tests). Defaults to the canonical factory. */
  db?: Database;
  /** Injected clock (tests). Defaults to the real wall clock. */
  now?: Date;
  /** Injected registration (tests). Defaults to @vesper/ai registerWatch. */
  registerWatchImpl?: typeof registerWatch;
  /** Injected persistence (tests). Defaults to @vesper/ai persistChannelState. */
  persistChannelStateImpl?: typeof persistChannelState;
}

export interface RenewalRunSummary {
  attempted: number;
  succeeded: number;
  failed: number;
}

const RENEWAL_TAGS = { provider: 'google_calendar', worker: 'gcal-channel-renewal' } as const;

/**
 * Run one renewal pass. Never throws for a single user's failure — each renewal is
 * isolated so one revoked token cannot starve the rest of the batch. Returns the run
 * counts (also emitted as the structured Sentry run-summary heartbeat).
 */
export async function runGcalChannelRenewal(
  deps?: RenewalDeps,
): Promise<RenewalRunSummary> {
  const db = deps?.db ?? createDrizzleClient();
  const now = deps?.now ?? new Date();
  const doRegister = deps?.registerWatchImpl ?? registerWatch;
  const doPersist = deps?.persistChannelStateImpl ?? persistChannelState;

  // Coarse candidate fetch: gcal integrations that actually carry a channel. The
  // precise status='connected' + within-24h decision is the pure helper's job (so that
  // boundary is unit-tested offline), not the SQL's.
  const rows = (await db.execute(sql`
    SELECT id, user_id, status, channel_expiration
    FROM integrations
    WHERE provider = 'google_calendar' AND channel_id IS NOT NULL
  `)) as unknown as RawIntegrationRow[];

  const candidates: RenewableIntegration[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    status: r.status,
    channelExpiration: r.channel_expiration ? new Date(r.channel_expiration) : null,
  }));

  const toRenew = selectChannelsToRenew(candidates, now);

  let succeeded = 0;
  let failed = 0;
  for (const integ of toRenew) {
    try {
      const channel = await doRegister(integ.userId, { db });
      await doPersist(integ.userId, channel, { db });
      succeeded += 1;
    } catch (err) {
      // Isolate: one user's failure (revoked token, Google 4xx/5xx) must not abort the
      // batch. Log it per-user and keep going.
      failed += 1;
      Sentry.captureException(err, {
        tags: { ...RENEWAL_TAGS, outcome: 'renewal-failed' },
        extra: { userId: integ.userId, integrationId: integ.id },
      });
    }
  }

  const summary: RenewalRunSummary = { attempted: toRenew.length, succeeded, failed };

  // The single run-summary heartbeat (097a worker-didn't-run defense keys on this
  // firing once per dispatch).
  Sentry.captureMessage('gcal-channel-renewal run', {
    level: failed > 0 ? 'warning' : 'info',
    tags: { ...RENEWAL_TAGS, outcome: 'run-summary' },
    extra: { ...summary, candidates: candidates.length },
  });

  return summary;
}
