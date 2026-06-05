// Next.js instrumentation hook — loads the runtime-appropriate Sentry config.
// @sentry/nextjs v8 loads sentry.server.config / sentry.edge.config from here
// (the client config is loaded automatically in the browser bundle).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
