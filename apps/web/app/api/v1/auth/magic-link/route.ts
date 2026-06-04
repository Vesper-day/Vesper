import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  successResponse,
  errorResponse,
} from '@vesper/shared';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * POST /api/v1/auth/magic-link — request an email magic link.
 *
 * PUBLIC endpoint: the caller is, by definition, not yet authenticated, so it
 * does NOT use createRoute (which mandates a Bearer session). It reuses the same
 * @vesper/shared primitives — ApiError / errorResponse / successResponse and the
 * X-Request-Id header — so the error/response shape still matches §9.
 *
 * §13: the email address is never placed in a redirect URL or query string;
 * `emailRedirectTo` points only at /auth/confirm and Supabase mails an opaque
 * token. Observability is a PostHog event only (no DB write — security_audit_log
 * is trigger-only per §3.19); distinct_id is 'anonymous' (no PII as a property).
 */
const REQUEST_ID_HEADER = 'X-Request-Id';

const MagicLinkRequestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = MagicLinkRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'A valid email address is required.',
      );
    }
    const { email } = parsed.data;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl}/auth/confirm` },
    });
    if (error) {
      throw new ApiError(
        ErrorCode.INTERNAL_ERROR,
        'Could not send the sign-in link. Please try again.',
      );
    }

    await captureMagicLinkRequested();

    const response = successResponse({ ok: true });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      const response = errorResponse(err.code, err.message, err.httpStatus);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
    Sentry.captureException(err, { tags: { requestId } });
    const response = errorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      500,
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}

/**
 * Fetch-based PostHog capture for 'magic_link_requested'. No-ops without
 * NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST; errors swallowed. distinct_id
 * is 'anonymous' and no email (PII) is sent. Mirrors rateLimit.ts (inlined).
 */
async function captureMagicLinkRequested(): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) return;

  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: 'magic_link_requested',
        distinct_id: 'anonymous',
        properties: { endpoint: '/api/v1/auth/magic-link' },
      }),
    });
  } catch {
    // Swallow — analytics is never load-bearing.
  }
}
