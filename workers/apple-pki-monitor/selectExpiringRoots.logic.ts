// Pure expiry-decision logic (Chat 086a). NO I/O, NO imports — (parsed root certs +
// now) → the roots whose notAfter falls at or before the alert threshold. This is the
// single, offline-tested source of the 180-day boundary: the worker fetches each pinned
// root's live cert from Apple, parses its validity window, and hands the notAfter dates
// here. Keeping the boundary here (not in the fetch/Sentry path) lets it be asserted with
// fabricated dates and no mocks.

/** Alert window: a pinned root whose notAfter is within this of `now` is near-expiry. */
export const EXPIRY_THRESHOLD_DAYS = 180; // six months (APPLE_ROOT_CA_ROTATION lead time).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A pinned root reduced to what the expiry decision needs (identity + live notAfter). */
export interface MonitoredRoot {
  /** Human-readable root name (e.g. "Apple Root CA - G3") — carried into the alert. */
  name: string;
  /** SHA-256 fingerprint (lowercase hex) — the stable root id carried into the alert. */
  sha256: string;
  /** notAfter of the LIVE cert Apple currently publishes for this pinned root. */
  notAfter: Date;
}

/** A near-expiry root plus the whole-days remaining until its notAfter (may be negative). */
export interface ExpiringRoot extends MonitoredRoot {
  daysRemaining: number;
}

/**
 * Select the pinned roots that are near (or past) expiry: those whose `notAfter` is at or
 * before `now + thresholdDays`. The boundary is INCLUSIVE — a root expiring in exactly
 * `thresholdDays` days is selected. An already-expired root (notAfter < now) also satisfies
 * the bound and is included (its `daysRemaining` is negative). A healthy set returns [].
 */
export function selectExpiringRoots(
  roots: readonly MonitoredRoot[],
  now: Date,
  thresholdDays: number = EXPIRY_THRESHOLD_DAYS,
): ExpiringRoot[] {
  const threshold = now.getTime() + thresholdDays * MS_PER_DAY;
  return roots
    .filter((r) => r.notAfter.getTime() <= threshold)
    .map((r) => ({
      ...r,
      daysRemaining: Math.floor((r.notAfter.getTime() - now.getTime()) / MS_PER_DAY),
    }));
}
