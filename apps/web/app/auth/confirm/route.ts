import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { resolveSafeRedirect } from '@/lib/auth/safeRedirect';

/**
 * Magic-link return handler (literal /auth/confirm — TECHNICAL_SPEC §4).
 *
 * The email link carries an opaque `token_hash` + `type` (NO email address per
 * §13). We verify the OTP, then redirect. Any `next` param goes through the same
 * open-redirect allowlist (resolveSafeRedirect) used by /auth/callback.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const rawNext = url.searchParams.get('next');

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/sign-in?error=link', request.url));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });
  if (error) {
    return NextResponse.redirect(new URL('/sign-in?error=link', request.url));
  }

  const safeNext = resolveSafeRedirect(rawNext, request.url);
  return NextResponse.redirect(new URL(safeNext, request.url));
}
