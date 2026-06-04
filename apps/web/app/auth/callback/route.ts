import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabase } from '@/lib/supabase/server';
import { resolveSafeRedirect } from '@/lib/auth/safeRedirect';

/**
 * OAuth callback (literal /auth/callback, OUTSIDE the (auth) route group).
 *
 * Google and the Apple web redirect both return here with a `code` to exchange
 * for a session. The `next` param is run through the open-redirect allowlist
 * (resolveSafeRedirect) before any redirect. On a rejected `next` we emit
 * observability ONLY — no DB write (security_audit_log is trigger-only per
 * TECHNICAL_SPEC §3.19).
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const rawNext = url.searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=auth', request.url));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/sign-in?error=auth', request.url));
  }

  const safeNext = resolveSafeRedirect(rawNext, request.url);

  // A `next` was supplied but did not survive the allowlist (and wasn't the
  // benign '/dashboard' fallback target itself) => treat as a rejected
  // open-redirect attempt and record observability.
  if (rawNext !== null && rawNext !== '/dashboard' && safeNext === '/dashboard') {
    const distinctId = data.user?.id ?? 'anonymous';
    Sentry.addBreadcrumb({
      category: 'auth',
      level: 'warning',
      message: 'Open-redirect next param rejected at /auth/callback',
    });
    await captureAuthEvent('auth_open_redirect_rejected', distinctId);
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}

/**
 * Minimal fetch-based PostHog capture. No-ops when NEXT_PUBLIC_POSTHOG_KEY /
 * NEXT_PUBLIC_POSTHOG_HOST are unset (pre-Cutover). Errors are swallowed —
 * analytics is never load-bearing. No PII is sent (no email / no `next` value).
 * Mirrors the pattern in @vesper/shared/api/rateLimit.ts (inlined to avoid
 * importing the shared barrel from a route).
 */
async function captureAuthEvent(
  event: string,
  distinctId: string,
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
        event,
        distinct_id: distinctId,
        properties: { endpoint: '/auth/callback' },
      }),
    });
  } catch {
    // Swallow — analytics is never load-bearing.
  }
}
