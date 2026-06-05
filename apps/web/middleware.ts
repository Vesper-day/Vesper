// Vercel Edge middleware — two branches, one per request:
//   1. PUBLIC per-IP-hash rate limiting for the two waitlist/referral API paths.
//   2. @supabase/ssr cookie AUTH gate for the authenticated (app) route group.
//
// Intentionally dependency-isolated from @vesper/shared: that barrel
// re-exports route.ts/auth.ts which import @vesper/db (a Node chain), and
// pulling it here would break the Edge build. This file imports ONLY
// @upstash/ratelimit, @upstash/redis, @sentry/nextjs, @supabase/ssr, and
// next/server, and uses Web Crypto (crypto.subtle) — never node:crypto.
// (@supabase/ssr is Edge-safe; the web cookie auth path, NOT the @vesper/shared
// Bearer-token validateSession which is the API path only.)
//
// Store: Upstash Redis (ARCHITECTURE_DECISIONS Decision 14). The web app runs
// on Vercel with no Cloudflare layer in front (TECHNICAL_SPEC §10), so the
// build plan's "Cloudflare-edge" limiting is @upstash/ratelimit in Edge
// middleware. RATE_LIMITING.md is the source of truth for the numbers below.
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import * as Sentry from '@sentry/nextjs';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Authenticated app paths (children of the app/(app) route group; route groups
// are stripped from the URL, so these are the concrete top-level segments).
// Add new app/(app)/* top-level segments here.
const PROTECTED_PREFIXES = ['/plan', '/tasks', '/week', '/settings'];

export const config = {
  // Unified matcher: the two rate-limited API paths PLUS the four protected app
  // paths (and their subtrees). Path-scoped matchers exclude _next, static
  // assets, and favicon by construction.
  matcher: [
    '/api/v1/waitlist',
    '/api/v1/referral/track',
    '/plan/:path*',
    '/tasks/:path*',
    '/week/:path*',
    '/settings/:path*',
  ],
};

interface Surface {
  limiterName: string;
  tokens: number;
  windowSeconds: number;
}

const SURFACES: Record<string, Surface> = {
  '/api/v1/waitlist': { limiterName: 'waitlist', tokens: 100, windowSeconds: 3600 },
  '/api/v1/referral/track': {
    limiterName: 'referral-track',
    tokens: 200,
    windowSeconds: 3600,
  },
};

// Lazy singletons — constructed on first request so module eval never calls
// Redis.fromEnv() (which throws without Upstash env present).
let redisClient: Redis | undefined;
const limiters = new Map<string, Ratelimit>();

function getLimiter(path: string, surface: Surface): Ratelimit {
  let limiter = limiters.get(path);
  if (!limiter) {
    redisClient = redisClient ?? Redis.fromEnv();
    limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(surface.tokens, '1 h'),
      prefix: `ratelimit:${surface.limiterName}`,
    });
    limiters.set(path, limiter);
  }
  return limiter;
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  // `request.ip` exists on some runtimes but is absent from the Next 15 types.
  return (request as unknown as { ip?: string }).ip ?? 'unknown';
}

/**
 * anonymous_ip_hash = lowercase hex SHA-256 of `${ip}:${utcDateYYYY-MM-DD}`.
 * The UTC date is a daily-rotating salt: raw IPs are never persisted and no
 * extra secret is needed.
 */
async function anonymousIpHash(ip: string): Promise<string> {
  const utcDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const data = new TextEncoder().encode(`${ip}:${utcDate}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  // Branch 1 — rate-limit the two public API paths. Runs ONLY for those paths.
  const surface = SURFACES[path];
  if (surface) return rateLimitBranch(request, path, surface);

  // Branch 2 — auth gate the protected app paths. A request takes exactly one
  // branch; these path sets never overlap.
  if (PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return authBranch(request);
  }

  return NextResponse.next();
}

/**
 * @supabase/ssr cookie auth gate (canonical Next.js middleware client). Reads
 * request cookies, refreshes the session, and forwards Set-Cookie on the
 * response. Redirects to /sign-in when there is no authenticated user.
 */
async function authBranch(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  return response;
}

async function rateLimitBranch(
  request: NextRequest,
  path: string,
  surface: Surface,
): Promise<NextResponse> {
  const ip = getClientIp(request);
  const key = await anonymousIpHash(ip);
  const { success, reset } = await getLimiter(path, surface).limit(key);
  if (success) return NextResponse.next();

  const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));

  // Sentry breadcrumb — best-effort (no-op if SDK uninitialized in Edge).
  try {
    Sentry.addBreadcrumb({
      category: 'rate-limit',
      data: {
        endpoint: path,
        limiter_name: surface.limiterName,
        window_seconds: surface.windowSeconds,
        retry_after_seconds: retryAfterSeconds,
      },
    });
  } catch {
    // best-effort
  }

  await captureRateLimitTripped({
    distinctId: key,
    endpoint: path,
    limiterName: surface.limiterName,
    windowSeconds: surface.windowSeconds,
    retryAfterSeconds,
  });

  return new NextResponse(
    JSON.stringify({
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please slow down and try again shortly.',
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}

interface CaptureRateLimitTrippedArgs {
  distinctId: string;
  endpoint: string;
  limiterName: string;
  windowSeconds: number;
  retryAfterSeconds: number;
}

// Inlined PostHog capture — must NOT import the shared helper (that pulls the
// @vesper/shared barrel and the db chain into the Edge bundle). Properties are
// EXACTLY { endpoint, limiter_name, window_seconds, retry_after_seconds } per
// TECHNICAL_SPEC §15; distinct_id = anonymous_ip_hash. No-ops without PostHog
// env; errors swallowed.
//
// Chat 096 replaces this with the @vesper/shared/analytics wrapper.
async function captureRateLimitTripped(
  args: CaptureRateLimitTrippedArgs,
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) return;

  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: 'rate_limit_tripped',
        distinct_id: args.distinctId,
        properties: {
          endpoint: args.endpoint,
          limiter_name: args.limiterName,
          window_seconds: args.windowSeconds,
          retry_after_seconds: args.retryAfterSeconds,
        },
      }),
    });
  } catch {
    // Swallow — analytics is never load-bearing.
  }
}
