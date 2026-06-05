// Auth observability for mobile — PostHog event + Sentry breadcrumb ONLY.
//
// Mirrors the web auth chat (apps/web/app/api/v1/auth/magic-link/route.ts and
// /auth/callback). Per HARD CONSTRAINT 1 there is NO security_audit_log write and
// NO "auth-event endpoint" — §3.19 forbids app-level writes to that table.
//
// Both sinks are GUARDED so this module is a no-op until the SDKs are initialized
// (Sentry mobile init is Chat 013; PostHog mobile wiring is later):
//   - PostHog: fetch-based capture, no-ops unless EXPO_PUBLIC_POSTHOG_KEY +
//     EXPO_PUBLIC_POSTHOG_HOST are set. Never sends PII (no email).
//   - Sentry: every call wrapped in try/catch, so an uninitialized SDK no-ops.
//     @sentry/react-native is already a dependency; init itself is Chat 013 —
//     addBreadcrumb/captureException are safe (buffered) even before init.
import * as Sentry from '@sentry/react-native';

/** Add a Sentry breadcrumb if the SDK is present + initialized; else no-op. */
export async function authBreadcrumb(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  try {
    Sentry.addBreadcrumb({ category: 'auth', level, message });
  } catch {
    // SDK not initialized (Chat 013) — breadcrumbs are never load-bearing.
  }
}

/** Capture a non-canceled auth error as a Sentry exception; else no-op. */
export async function authCaptureException(err: unknown): Promise<void> {
  try {
    Sentry.captureException(err);
  } catch {
    // SDK not initialized — swallow.
  }
}

/**
 * Fetch-based PostHog capture. No-ops unless both env vars are set. Errors are
 * swallowed — analytics is never load-bearing. Pass no PII as properties.
 */
export async function captureAuthEvent(
  event: string,
  distinctId: string = 'anonymous',
  properties: Record<string, string> = {},
): Promise<void> {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) return;

  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: { platform: 'mobile', ...properties },
      }),
    });
  } catch {
    // Swallow — analytics is never load-bearing.
  }
}
