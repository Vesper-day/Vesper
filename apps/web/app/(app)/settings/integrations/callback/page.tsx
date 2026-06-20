'use client';

// /settings/integrations/callback (chat 063, 7th output — approved scope expansion)
//
// Google redirects here after the consent screen with ?code=... (or ?error=...
// if the user declined). This client page captures the transient code, POSTs
// { code, redirectUri } to the connect route, then bounces back to
// /settings/integrations with a ?status the page renders. It holds no UI of its
// own beyond a brief "Connecting…" state.
//
// redirectUri MUST exactly match the URI used to start the consent flow and the
// one registered in Google Cloud (e.g. http://localhost:3000/settings/integrations/callback).
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '../../../../../lib/supabase/client';

const CALLBACK_PATH = '/settings/integrations/callback';
const SETTINGS_PATH = '/settings/integrations';

// useSearchParams() forces client-side rendering, so the page must sit behind a
// Suspense boundary or `next build` fails the static-gen CSR-bailout check.
export default function IntegrationsCallbackPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl px-6 py-10">
          <p className="text-cream">Connecting your Google Calendar…</p>
        </main>
      }
    >
      <IntegrationsCallbackInner />
    </Suspense>
  );
}

function IntegrationsCallbackInner(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Connecting your Google Calendar…');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');

    if (oauthError || !code) {
      router.replace(`${SETTINGS_PATH}?status=error`);
      return;
    }

    void (async () => {
      try {
        const supabase = createBrowserSupabase();
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;

        const res = await fetch('/api/v1/integrations/google-calendar/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}${CALLBACK_PATH}`,
          }),
        });

        router.replace(`${SETTINGS_PATH}?status=${res.ok ? 'connected' : 'error'}`);
      } catch {
        setMessage('Something went wrong. Returning to settings…');
        router.replace(`${SETTINGS_PATH}?status=error`);
      }
    })();
  }, [router, searchParams]);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <p className="text-cream">{message}</p>
    </main>
  );
}
