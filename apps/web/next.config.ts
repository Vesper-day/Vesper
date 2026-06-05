import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@vesper/ui', '@vesper/shared'],
  typedRoutes: true,
};

// Wrap with Sentry. Source-map upload is GUARDED: disabled whenever
// SENTRY_AUTH_TOKEN is absent (dev/preview before Cutover), and `silent: true`
// keeps the build from failing or logging when there is no token. Optional
// org/project/authToken are spread in only when set — exactOptionalPropertyTypes
// forbids assigning `undefined` to those string fields.
const { SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN } = process.env;

export default withSentryConfig(nextConfig, {
  silent: true,
  ...(SENTRY_ORG ? { org: SENTRY_ORG } : {}),
  ...(SENTRY_PROJECT ? { project: SENTRY_PROJECT } : {}),
  ...(SENTRY_AUTH_TOKEN ? { authToken: SENTRY_AUTH_TOKEN } : {}),
  sourcemaps: { disable: !SENTRY_AUTH_TOKEN },
});
