import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import { createRequire } from 'node:module';

// libsodium-wrappers ships a BROKEN ESM build (dist/modules-esm/libsodium-wrappers.mjs
// imports a nonexistent ./libsodium.mjs), so any bundler that picks the ESM `import`
// condition fails to resolve it. Force both Webpack (next build) and Turbopack
// (next dev) to resolve the bare specifier to the working CJS entry. Same fix as
// the alias in packages/db/vitest.config.ts.
const require = createRequire(import.meta.url);
const libsodiumWrappersCjs = require.resolve('libsodium-wrappers');

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
// Dev-only: Next's webpack/turbopack hot-reload runtime uses eval() and inline
// bootstrap scripts, which the production script-src (no 'unsafe-eval', no
// 'unsafe-inline' per Decision 13) blocks — that breaks client hydration in
// `next dev`. Loosen script-src for development ONLY; production stays strict.
const IS_DEV = process.env.NODE_ENV === 'development';
const SCRIPT_SRC = IS_DEV
  ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://app.posthog.com"
  : "script-src 'self' https://js.stripe.com https://app.posthog.com";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  SCRIPT_SRC,
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
  transpilePackages: ['@vesper/ui', '@vesper/shared', '@vesper/apple'],
  typedRoutes: true,
  // Turbopack (next dev): resolve libsodium-wrappers to its CJS entry.
  turbopack: {
    resolveAlias: {
      'libsodium-wrappers': libsodiumWrappersCjs,
    },
  },
  // Webpack (next build): same alias. `$` = exact-match so only the bare
  // specifier is rewritten, not deep imports.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'libsodium-wrappers$': libsodiumWrappersCjs,
    };
    return config;
  },
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
