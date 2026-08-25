'use client';

// /settings/integrations (chat 063) — connect/disconnect Google Calendar.
//
// Structural surface. There is no GET /integrations endpoint at this chat, so
// connection status is driven by the ?status query param the callback page sets
// after a connect attempt (connected | error). The reconnect-banner pattern
// renders on the error state. Apple Calendar renders DISABLED ("Coming soon").
//
// The Connect button redirects the browser to Google's consent screen with
// access_type=offline + prompt=consent so the code exchange yields a refresh
// token. Google returns the user to /settings/integrations/callback?code=...,
// which POSTs the code to the connect route and then bounces back here.
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '../../../../lib/supabase/client';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const CALLBACK_PATH = '/settings/integrations/callback';

type GcalStatus = 'connected' | 'error' | 'unknown';

function startGoogleConnect(): void {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    // Misconfiguration — surface visibly rather than redirecting to a broken consent screen.
    window.alert('Google Calendar is not configured. Please contact support.');
    return;
  }
  const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', CALENDAR_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  window.location.href = url.toString();
}

// useSearchParams() forces client-side rendering, so the page must sit behind a
// Suspense boundary or `next build` fails the static-gen CSR-bailout check.
export default function IntegrationsPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl px-6 py-10">
          <h1 className="mb-6 text-2xl text-cream">Integrations</h1>
        </main>
      }
    >
      <IntegrationsInner />
    </Suspense>
  );
}

function IntegrationsInner(): React.JSX.Element {
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get('status') as GcalStatus | null) ?? 'unknown';
  const [status, setStatus] = useState<GcalStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function disconnect(): Promise<void> {
    setBusy(true);
    try {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await fetch('/api/v1/integrations/google_calendar', {
        method: 'DELETE',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (res.ok) setStatus('unknown');
      else setStatus('error');
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-2xl text-cream">Integrations</h1>

      {status === 'error' && (
        // Reconnect banner — the error-state pattern. Chats 064/099 wire the
        // status-driven trigger from the integrations row; here it reflects the
        // last connect/disconnect attempt.
        <div className="mb-6 rounded-lg border border-bronze bg-surface p-4 shadow-raised">
          <p className="text-cream">
            We couldn&apos;t reach your Google Calendar. Please reconnect.
          </p>
          <button
            type="button"
            onClick={startGoogleConnect}
            className="mt-3 rounded-md bg-bronze px-4 py-2 text-espresso shadow-raised transition-[background-color,box-shadow,transform] duration-quick ease-standard-out hover:shadow-floating focus-visible:shadow-glow active:scale-95 active:shadow-press"
          >
            Reconnect Google Calendar
          </button>
        </div>
      )}

      <ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle shadow-raised">
        {/* Google Calendar */}
        <li className="flex items-center justify-between p-4">
          <div>
            <p className="text-cream">Google Calendar</p>
            <p className="text-sm text-cream-faint">
              {status === 'connected' ? 'Connected' : 'Read-only calendar access'}
            </p>
          </div>
          {status === 'connected' ? (
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="rounded-md border border-line-subtle px-4 py-2 text-cream shadow-raised transition-[background-color,box-shadow,transform] duration-quick ease-standard-out hover:bg-elevated hover:shadow-floating active:scale-95 active:shadow-press disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={startGoogleConnect}
              disabled={busy}
              className="rounded-md bg-bronze px-4 py-2 text-espresso shadow-raised transition-[background-color,box-shadow,transform] duration-quick ease-standard-out hover:shadow-floating focus-visible:shadow-glow active:scale-95 active:shadow-press disabled:opacity-50"
            >
              Connect
            </button>
          )}
        </li>

        {/* Apple Calendar — disabled placeholder per chat 063 scope. */}
        <li className="flex items-center justify-between p-4 opacity-50">
          <div>
            <p className="text-cream">Apple Calendar</p>
            <p className="text-sm text-cream-faint">Coming soon</p>
          </div>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border border-line-subtle px-4 py-2 text-cream-faint"
          >
            Connect
          </button>
        </li>
      </ul>
    </main>
  );
}
