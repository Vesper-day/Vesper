// Sentry init for the mobile app (@sentry/react-native).
//
// Mirrors the web Sentry posture (apps/web/sentry.*.config.ts +
// apps/web/lib/sentry/scrub.ts):
//   - init NO-OPS when no DSN is configured (placeholder SENTRY_* secrets are
//     expected until Cutover) — a missing DSN must never throw or fail the build;
//   - tracesSampleRate is 0 in development and 1.0 in preview/production
//     (ARCHITECTURE_DECISIONS Decision 07);
//   - beforeSend scrubs known PII (emails, bearer/JWT tokens, phone numbers)
//     before any event leaves the device.
//
// MUST NOT import @vesper/db.
import * as Sentry from '@sentry/react-native';

const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Emails.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  // `Bearer <token>` authorization values.
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [token]'],
  // Bare JWTs (header.payload.signature).
  [/eyJ[A-Za-z0-9._-]{8,}/g, '[token]'],
  // Phone numbers (loose: 8+ digits with optional separators / leading +).
  [/\+?\d[\d\s().-]{7,}\d/g, '[phone]'],
];

function scrubString(input: string): string {
  return PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), input);
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return value; // guard against deep/cyclic structures
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Sentry `beforeSend` — scrub known PII from the outgoing event. */
function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request?.url) {
    event.request.url = scrubString(event.request.url);
  }
  if (event.request?.data !== undefined) {
    event.request.data = scrubValue(event.request.data);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      ...(crumb.data ? { data: scrubValue(crumb.data) as Record<string, unknown> } : {}),
      ...(crumb.message ? { message: scrubString(crumb.message) } : {}),
    }));
  }
  return event;
}

/**
 * tracesSampleRate: 0 in development (no trace noise locally); 1.0 in preview and
 * production. `__DEV__` is true only under the Metro dev bundle; preview and
 * production are both release builds (Decision 07).
 */
function tracesSampleRate(): number {
  return typeof __DEV__ !== 'undefined' && __DEV__ ? 0 : 1.0;
}

/** Resolve the Sentry DSN; empty/undefined means Sentry.init is a no-op. */
function resolveDsn(): string | undefined {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  return dsn && dsn.length > 0 ? dsn : undefined;
}

let initialized = false;

/**
 * Initialize Sentry. Idempotent. No-ops silently when no DSN is present so the
 * app boots cleanly in dev/preview before the Cutover DSN is provisioned.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = resolveDsn();
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: tracesSampleRate(),
    beforeSend: scrubEvent,
  });
  initialized = true;
}
