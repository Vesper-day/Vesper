import type { ErrorEvent, EventHint } from '@sentry/nextjs';

/**
 * Shared PII scrubber for Sentry `beforeSend`. Redacts emails, bearer/JWT-looking
 * tokens, and phone numbers from request URLs, request bodies, and breadcrumb
 * data before any event leaves the process. Runs on client, server, and edge.
 *
 * Conservative by design: over-redaction is acceptable, leaking PII is not.
 */
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
export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent {
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
 * tracesSampleRate: 0 in development (no trace noise locally); 1.0 in preview
 * and production. Reads VERCEL_ENV first, falls back to NODE_ENV.
 */
export function tracesSampleRate(): number {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  return env === 'development' ? 0 : 1.0;
}

/** Resolve the Sentry DSN; empty/undefined means Sentry.init is a no-op. */
export function resolveDsn(...candidates: Array<string | undefined>): string | undefined {
  return candidates.find((c) => c && c.length > 0);
}
