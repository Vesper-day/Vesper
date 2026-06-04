'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { signInWithApple } from '@/lib/auth/apple-sign-in';

/**
 * Sign-in page. Three stacked, equal-weight options: Google, Apple, email magic
 * link (App Store guideline 4.8 — Apple shown equal-weight to Google).
 *
 * Layer 4 palette (docs/LAYER_4_EXPERIENCE_IDENTITY.md): espresso background,
 * cream foreground, bronze accent. Registered as named tokens in the shared
 * @vesper/ui Tailwind preset, consumed here as bg-espresso / text-cream /
 * bronze utility classes (no arbitrary hex values).
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

type MagicLinkStatus = 'idle' | 'sending' | 'sent' | 'error';

export default function SignInPage(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<MagicLinkStatus>('idle');

  async function handleGoogle(): Promise<void> {
    const supabase = createBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });
  }

  async function handleApple(): Promise<void> {
    await signInWithApple();
  }

  async function handleMagicLink(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/v1/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-espresso px-6 text-cream">
      <div className="w-full max-w-sm space-y-8">
        <h1 className="text-center text-2xl font-medium">Sign in to Vesper</h1>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full rounded-md border border-bronze px-4 py-3 text-sm font-medium text-cream transition-colors hover:bg-bronze/10"
          >
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleApple}
            className="w-full rounded-md border border-bronze px-4 py-3 text-sm font-medium text-cream transition-colors hover:bg-bronze/10"
          >
            Continue with Apple
          </button>
        </div>

        <form onSubmit={handleMagicLink} className="space-y-3">
          <label htmlFor="email" className="block text-sm">
            Or continue with email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-bronze/40 bg-transparent px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-bronze focus:outline-none"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-md bg-bronze px-4 py-3 text-sm font-medium text-espresso transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>

          {status === 'sent' && (
            <p className="text-center text-sm text-cream/80">
              Check your inbox for a sign-in link.
            </p>
          )}
          {status === 'error' && (
            <p className="text-center text-sm text-bronze">
              Something went wrong. Please try again.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
