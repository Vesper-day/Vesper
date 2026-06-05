// Google OAuth (native mobile) — TECHNICAL_SPEC §4.
//
// The same supabase.auth.signInWithOAuth({ provider: 'google' }) call as web is
// wrapped in expo-auth-session's makeRedirectUri to produce the
// `vesper://auth/callback` deep link, and opened with expo-web-browser's
// openAuthSessionAsync. The returned redirect is validated to be EXACTLY the
// expected callback path before its tokens/code are exchanged for a session.
//
// Observability is PostHog event + Sentry breadcrumb only (HARD CONSTRAINT 1).
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../supabase';
import { matchesDeepLinkPath, extractAuthParams } from './deepLink';
import {
  authBreadcrumb,
  authCaptureException,
  captureAuthEvent,
} from './observability';

/** Exact inbound deep link the Google flow accepts (spec §4). */
export const GOOGLE_REDIRECT_PATH = 'vesper://auth/callback';

export type GoogleSignInResult =
  | { ok: true }
  | { ok: false; canceled: boolean; reason: string };

/** Build the dev deep-link redirect URI (vesper://auth/callback). */
export function buildGoogleRedirectUri(): string {
  return makeRedirectUri({ scheme: 'vesper', path: 'auth/callback' });
}

/**
 * Complete the Supabase session from a validated inbound redirect URL. Exported
 * for testing the hardening path. Rejects any URL whose path is not exactly
 * GOOGLE_REDIRECT_PATH before touching Supabase.
 */
export async function completeGoogleSession(
  redirectUrl: string,
): Promise<GoogleSignInResult> {
  if (!matchesDeepLinkPath(redirectUrl, GOOGLE_REDIRECT_PATH)) {
    await authBreadcrumb('Google redirect path rejected', 'warning');
    return { ok: false, canceled: false, reason: 'invalid_redirect_path' };
  }

  const params = extractAuthParams(redirectUrl);

  if (params.error) {
    return { ok: false, canceled: false, reason: params.error };
  }

  // PKCE: exchange the returned `code`. Implicit: setSession from the tokens in
  // the fragment. Use whichever the redirect actually carried.
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      await authCaptureException(error);
      return { ok: false, canceled: false, reason: 'exchange_failed' };
    }
  } else if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) {
      await authCaptureException(error);
      return { ok: false, canceled: false, reason: 'set_session_failed' };
    }
  } else {
    return { ok: false, canceled: false, reason: 'no_credentials_in_redirect' };
  }

  await authBreadcrumb('Google sign-in succeeded', 'info');
  await captureAuthEvent('mobile_sign_in_succeeded', 'anonymous', {
    provider: 'google',
  });
  return { ok: true };
}

/**
 * Begin the native Google OAuth flow. Opens the consent screen in an auth
 * session and completes the Supabase session from the returned redirect.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const redirectTo = buildGoogleRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    await authCaptureException(error ?? new Error('No OAuth URL returned'));
    return { ok: false, canceled: false, reason: 'oauth_init_failed' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, canceled: true, reason: 'user_canceled' };
  }
  if (result.type !== 'success' || !result.url) {
    return { ok: false, canceled: false, reason: 'browser_no_redirect' };
  }

  return completeGoogleSession(result.url);
}
