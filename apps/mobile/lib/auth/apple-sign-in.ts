// Native Sign in with Apple (iOS) — TECHNICAL_SPEC §4.
//
// ⚠️ DEFERRED VERIFICATION: this path is fully implemented but CANNOT be tested
// end-to-end until Apple Developer Program enrollment + Cutover C-09 (the Apple
// Services ID / key are provisioned in the Supabase Apple provider then). It is
// shipped now because App Store guideline 4.8 mandates Apple Sign In whenever any
// third-party social login (Google) is offered, and the native button must exist
// in the sign-in screen. Unit tests here mock expo-apple-authentication.
//
// Flow: AppleAuthentication.signInAsync (scopes FULL_NAME + EMAIL) returns a
// credential; its identityToken is exchanged for a Supabase session via
// signInWithIdToken({ provider: 'apple', token }). Apple returns fullName/email
// ONLY on the very first authorization, so on first sign-in we forward them onto
// the user record; subsequent sign-ins carry only the token (fullName === null,
// tolerated). User cancellation is a non-error (no Sentry capture).
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../supabase';
import {
  authBreadcrumb,
  authCaptureException,
  captureAuthEvent,
} from './observability';

// Apple raises this code when the user dismisses the native sheet.
const APPLE_CANCEL_CODE = 'ERR_REQUEST_CANCELED';

export type AppleSignInResult =
  | { ok: true }
  | { ok: false; canceled: boolean; reason: string };

function joinName(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function isCanceled(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === APPLE_CANCEL_CODE
  );
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    if (isCanceled(err)) {
      // User dismissed — not an error.
      return { ok: false, canceled: true, reason: 'user_canceled' };
    }
    await authCaptureException(err);
    return { ok: false, canceled: false, reason: 'apple_prompt_failed' };
  }

  if (!credential.identityToken) {
    return { ok: false, canceled: false, reason: 'no_identity_token' };
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) {
    await authCaptureException(error);
    return { ok: false, canceled: false, reason: 'id_token_exchange_failed' };
  }

  // FIRST sign-in only: Apple returns name/email exactly once. Forward them onto
  // the user record. On subsequent sign-ins fullName === null — skip silently.
  const fullName = joinName(credential.fullName);
  if (fullName || credential.email) {
    const data: Record<string, string> = {};
    if (fullName) data.full_name = fullName;
    if (credential.email) data.email = credential.email;
    const { error: updateError } = await supabase.auth.updateUser({ data });
    if (updateError) {
      // Non-fatal: the session is valid; profile enrichment can be retried later.
      await authBreadcrumb('Apple profile enrichment failed', 'warning');
    }
  }

  await authBreadcrumb('Apple sign-in succeeded', 'info');
  await captureAuthEvent('mobile_sign_in_succeeded', 'anonymous', {
    provider: 'apple',
  });
  return { ok: true };
}
