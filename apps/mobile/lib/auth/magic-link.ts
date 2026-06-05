// Email magic link (mobile) — TECHNICAL_SPEC §4.
//
// supabase.auth.signInWithOtp({ email }) mails an opaque link (via Resend) that
// confirms to the `vesper://auth/confirm` deep link. The email address is NEVER
// placed in any redirect URL or query string — emailRedirectTo points only at the
// confirm deep link and Supabase carries an opaque token. The inbound confirm
// link is validated to be EXACTLY vesper://auth/confirm before any session is
// established (hardening), then completed with verifyOtp (token_hash + type) or
// exchangeCodeForSession, matching what the inbound URL actually carries.
import * as Linking from 'expo-linking';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { matchesDeepLinkPath, extractAuthParams } from './deepLink';
import {
  authBreadcrumb,
  authCaptureException,
  captureAuthEvent,
} from './observability';

/** Exact inbound deep link the magic-link flow accepts (spec §4). */
export const MAGIC_LINK_CONFIRM_PATH = 'vesper://auth/confirm';

export type MagicLinkResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Request a magic link for `email`. The email is passed only in the request
 * body to Supabase — never embedded in emailRedirectTo (which is the opaque
 * confirm deep link). On success the user's mail client is opened.
 */
export async function sendMagicLink(email: string): Promise<MagicLinkResult> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: MAGIC_LINK_CONFIRM_PATH },
  });
  if (error) {
    await authCaptureException(error);
    return { ok: false, reason: 'send_failed' };
  }

  await authBreadcrumb('Magic link requested', 'info');
  // distinct_id is 'anonymous' and NO email (PII) is sent as a property.
  await captureAuthEvent('mobile_magic_link_requested');

  await openMailClient();
  return { ok: true };
}

/** Best-effort: open the iOS Mail client so the user can tap the link. */
export async function openMailClient(): Promise<void> {
  try {
    const supported = await Linking.canOpenURL('message://');
    if (supported) await Linking.openURL('message://');
  } catch {
    // Non-fatal — the link still works if the user opens Mail manually.
  }
}

/**
 * Complete the Supabase session from a validated inbound confirm URL. Exported
 * for testing the hardening path. Rejects any URL whose path is not exactly
 * MAGIC_LINK_CONFIRM_PATH before touching Supabase.
 */
export async function completeMagicLinkSession(
  url: string,
): Promise<MagicLinkResult> {
  if (!matchesDeepLinkPath(url, MAGIC_LINK_CONFIRM_PATH)) {
    await authBreadcrumb('Magic-link confirm path rejected', 'warning');
    return { ok: false, reason: 'invalid_confirm_path' };
  }

  const params = extractAuthParams(url);

  if (params.error) {
    return { ok: false, reason: params.error };
  }

  if (params.token_hash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as EmailOtpType,
    });
    if (error) {
      await authCaptureException(error);
      return { ok: false, reason: 'verify_failed' };
    }
  } else if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      await authCaptureException(error);
      return { ok: false, reason: 'exchange_failed' };
    }
  } else {
    return { ok: false, reason: 'no_token_in_confirm' };
  }

  await authBreadcrumb('Magic-link sign-in succeeded', 'info');
  await captureAuthEvent('mobile_sign_in_succeeded', 'anonymous', {
    provider: 'magic_link',
  });
  return { ok: true };
}

/**
 * Register an expo-linking listener for the confirm deep link. Also drains the
 * initial URL (cold start from the email link). Returns an unsubscribe fn.
 */
export function registerMagicLinkHandler(
  onResult: (result: MagicLinkResult) => void,
): () => void {
  const handle = (url: string | null): void => {
    if (!url) return;
    if (!matchesDeepLinkPath(url, MAGIC_LINK_CONFIRM_PATH)) return;
    void completeMagicLinkSession(url).then(onResult);
  };

  const subscription = Linking.addEventListener('url', (event: { url: string }) =>
    handle(event.url),
  );
  void Linking.getInitialURL().then(handle);

  return () => subscription.remove();
}
