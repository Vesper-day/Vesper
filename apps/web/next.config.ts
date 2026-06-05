import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Content-Security-Policy — static, single source of truth for the whole app
// (ARCHITECTURE_DECISIONS Decision 13). Authored as one line per directive for
// readability, then joined with '; '. See docs/CSP_NOTES.md for the rationale
// behind every origin.
//
// script-src deliberately carries NO 'unsafe-eval' (Decision 13) and NO
// 'unsafe-inline'. It also carries NO nonce: a per-request nonce cannot be
// emitted from a static headers() block, and there is no inline-script consumer
// yet, so the document-response CSP stays static here. When the first inline
// script lands, the CSP moves to middleware.ts to carry a live nonce — the
// migration path is documented in docs/CSP_NOTES.md ("Deferred: per-request
// nonce") and the generator already exists at apps/web/lib/csp/nonce.ts.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com https://app.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.posthog.com https://*.sentry.io https://api.stripe.com",
  "frame-src 'self' https://js.stripe.com https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
];

const CONTENT_SECURITY_POLICY = CSP_DIRECTIVES.join('; ');

// Headers applied to every route. HSTS enables strict transport; the preload
// directive is set but the hstspreload.org submission is a deferred manual
// cutover task (see CSP_NOTES.md). Permissions-Policy denies camera, mic, and
// geolocation by default; geolocation is re-granted at runtime via the browser
// prompt in the location-capture flow, never via this header.
const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@vesper/ui', '@vesper/shared'],
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },
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
