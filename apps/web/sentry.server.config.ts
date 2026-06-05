// Sentry Node (server runtime) SDK init. Loaded via instrumentation.ts.
// No-op when no DSN is configured.
import * as Sentry from '@sentry/nextjs';
import { resolveDsn, scrubEvent, tracesSampleRate } from '@/lib/sentry/scrub';

const dsn = resolveDsn(process.env.SENTRY_DSN, process.env.NEXT_PUBLIC_SENTRY_DSN);

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: tracesSampleRate(),
    beforeSend: scrubEvent,
  });
}
