// Pure renewal-decision logic (Chat 066). NO I/O, NO imports — (integrations rows +
// now) → the set of channels to renew. This is the single, offline-tested source of
// the renewal boundary (Decision 19: renew when the remaining channel TTL drops below
// 24h). The worker fetches a coarse candidate set from Postgres and hands it here; the
// status='connected' + within-24h decision lives ONLY here so it can be asserted with
// fabricated rows and no mocks.

/** Renewal window: renew any channel whose expiration is within this of `now`. */
export const RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h (Decision 19).

/** A candidate integration row, already normalized off the raw DB shape. */
export interface RenewableIntegration {
  /** integrations.id (for diagnostics / Sentry). */
  id: string;
  /** integrations.user_id — the key registerWatch + persistChannelState are scoped to. */
  userId: string;
  /** integrations.status ('connected' | 'disconnected' | 'error'). */
  status: string;
  /** integrations.channel_expiration, or null if this integration has no channel. */
  channelExpiration: Date | null;
}

/**
 * Select the channels to renew: only `status === 'connected'` integrations whose
 * channel_expiration is non-null and falls at or before `now + windowMs`. An
 * already-past expiration satisfies the bound and is included (a dead channel must be
 * re-registered). Rows that are not connected, or that carry no channel_expiration,
 * are never selected.
 */
export function selectChannelsToRenew(
  rows: readonly RenewableIntegration[],
  now: Date,
  windowMs: number = RENEWAL_WINDOW_MS,
): RenewableIntegration[] {
  const threshold = now.getTime() + windowMs;
  return rows.filter(
    (r) =>
      r.status === 'connected' &&
      r.channelExpiration !== null &&
      r.channelExpiration.getTime() <= threshold,
  );
}
