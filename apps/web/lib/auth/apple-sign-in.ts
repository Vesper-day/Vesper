// Apple Sign In — WEB redirect flow (not native iOS).
//
// The Apple Services ID + private key are provisioned at Cutover step C-09 and
// configured in the Supabase Dashboard Apple provider; until then this path
// cannot be exercised end-to-end in dev.
//
// On the FIRST Apple auth the provider returns the user's email/name exactly
// once. Supabase persists these onto the initial user record automatically via
// the provider — no extra handling is needed here for the web redirect flow.
//
// App Store guideline 4.8: this option is shown equal-weight to Google on the
// sign-in page.
import { createBrowserSupabase } from '@/lib/supabase/client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

/**
 * Begin the Apple OAuth web redirect. The provider returns to /auth/callback
 * with a `code` to exchange for a session (same path as Google).
 */
export async function signInWithApple(): Promise<void> {
  const supabase = createBrowserSupabase();
  await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${APP_URL}/auth/callback` },
  });
}
