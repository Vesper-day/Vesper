// workers/daily-cron — consolidated scheduled-worker entrypoint (Chat 066 scaffold).
//
// Decision 20: all scheduled workers deploy as named modules inside ONE Cloudflare
// Worker, dispatched by UTC hour. This is the MINIMAL shell — Chat 066 is the first
// daily-cron module (gcal-channel-renewal at the 5am UTC tick). Later chats
// (trial-reminder, dunning-check, hard-delete, reconciliation, bill-reminder,
// spend-monitor) register their own modules against other hours; they extend this
// dispatch table and add their cron rows — they do not restructure this shell.
//
// The wrangler cron fires hourly ("0 * * * *"); this handler routes the UTC hour to the
// module registered for it and no-ops on unregistered hours. Keeping one hourly trigger
// (rather than one cron per module) stays well within the 250-trigger Paid limit.
import { runGcalChannelRenewal } from '../modules/gcal-channel-renewal';

/** Minimal structural types for the Workers scheduled API (avoids a @cloudflare/workers-types dep in this shell). */
interface ScheduledEvent {
  /** ms-epoch time the cron was scheduled to fire. */
  scheduledTime: number;
  cron: string;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
type Env = Record<string, string | undefined>;

/**
 * UTC-hour → module dispatch table. gcal-channel-renewal runs at 05:00 UTC. A module
 * returns a promise; the handler awaits it via waitUntil so the run finishes before the
 * worker is torn down.
 */
const HOURLY_DISPATCH: Record<number, () => Promise<unknown>> = {
  5: () => runGcalChannelRenewal(),
};

export default {
  async scheduled(
    event: ScheduledEvent,
    _env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();
    const module = HOURLY_DISPATCH[hour];
    if (!module) return; // no module registered for this hour — no-op.
    ctx.waitUntil(module());
  },
};
