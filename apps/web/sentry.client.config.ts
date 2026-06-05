// Sentry browser SDK init. Loaded automatically by @sentry/nextjs.
// No-op when no DSN is configured (placeholder secrets are expected in
// dev/preview until Cutover) — Sentry.init('') simply disables transport.
import * as Sentry from '@sentry/nextjs';
import { resolveDsn, scrubEvent, tracesSampleRate } from '@/lib/sentry/scrub';

const dsn = resolveDsn(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_DSN);

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: tracesSampleRate(),
    beforeSend: scrubEvent,
  });
}
