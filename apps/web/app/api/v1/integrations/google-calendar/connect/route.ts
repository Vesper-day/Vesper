// POST /api/v1/integrations/google-calendar/connect (§6, chat 063)
//
// Exchanges a Google OAuth authorization code for tokens (MANUAL exchange at
// Google's token endpoint — the §6 request contract is `{ code, redirectUri }`,
// which `supabase.auth.signInWithOAuth` cannot express), encrypts the access and
// refresh tokens app-side, and upserts the `integrations` row keyed by the
// UNIQUE (user_id, provider) constraint. Token REFRESH is chat 064, not here.
//
// RAW SQL: the Drizzle model in packages/db/src/schema/integrations.ts is stale
// vs migration 20260601000007 (it declares `text` columns named
// encrypted_access_token and a phantom `scopes` column; the live table has
// `bytea` columns access_token_encrypted / refresh_token_encrypted plus
// last_synced_at / last_error). Per the standing per-table pattern we write the
// row with raw parameterized SQL against the real columns rather than the model.
//
// The audit trigger `audit_integrations_changes` (migration 11) records the
// INSERT/UPDATE into security_audit_log automatically — no app write needed.
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  successResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient, sql } from '@vesper/db';
import { encryptToken } from '@vesper/db/encryption';

const REQUEST_ID_HEADER = 'X-Request-Id';
const PROVIDER = 'google_calendar';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export const dynamic = 'force-dynamic';

const ConnectRequestSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

type Outcome = 'success' | 'auth-error' | 'network-error';

/** Structured diagnostic log line (the "I clicked Connect and nothing happened" trail). */
function logOutcome(userId: string | undefined, outcome: Outcome): void {
  console.info(
    JSON.stringify({ msg: 'integrations.connect', user_id: userId, provider: PROVIDER, outcome }),
  );
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const raw: unknown = await request.json().catch(() => null);
    const parsed = ConnectRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { code, redirectUri }.',
      );
    }

    // Calendar OAuth client. Prefer the dedicated GOOGLE_OAUTH_* pair; fall back
    // to GOOGLE_CLIENT_ID/SECRET (the Supabase Auth "Sign in with Google" client)
    // for single-client setups that reuse one Google project.
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      // Misconfiguration, not a client error: fail closed and surface to Sentry.
      throw new Error('Google OAuth client id/secret are not configured.');
    }

    // --- Exchange the authorization code for tokens (network-error on transport) ---
    let tokenRes: globalThis.Response;
    try {
      tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: parsed.data.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: parsed.data.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
    } catch (networkErr) {
      Sentry.captureException(networkErr, {
        tags: { requestId, provider: PROVIDER, outcome: 'network-error' },
        extra: { method: 'POST', path: '/api/v1/integrations/google-calendar/connect', userId },
      });
      logOutcome(userId, 'network-error');
      throw new ApiError(
        ErrorCode.INTEGRATION_ERROR,
        'Could not reach Google to complete the connection. Please try again.',
      );
    }

    // --- Non-2xx from Google = auth-error (bad/expired code, redirect mismatch) ---
    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text().catch(() => '');
      Sentry.captureMessage('Google token exchange failed', {
        level: 'error',
        tags: { requestId, provider: PROVIDER, outcome: 'auth-error', status: String(tokenRes.status) },
        extra: { errorBody, userId },
      });
      logOutcome(userId, 'auth-error');
      throw new ApiError(
        ErrorCode.INTEGRATION_ERROR,
        'Google rejected the authorization. Please reconnect and try again.',
      );
    }

    const tokens = (await tokenRes.json()) as GoogleTokenResponse;

    // --- Encrypt app-side; access token is required ciphertext, refresh optional ---
    const accessTokenEncrypted = await encryptToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token
      ? await encryptToken(tokens.refresh_token)
      : null;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    // postgres-js will not bind a raw Date as a parameter; pass an ISO string and
    // cast to timestamptz in SQL.
    const expiresAtIso = expiresAt.toISOString();

    // --- Upsert on UNIQUE (user_id, provider). Reconnect clears any prior error. ---
    const db = createDrizzleClient();
    const rows = await db.execute(sql`
      INSERT INTO integrations
        (user_id, provider, status, access_token_encrypted, refresh_token_encrypted, expires_at, last_error, updated_at)
      VALUES
        (${user.id}, ${PROVIDER}, 'connected', ${accessTokenEncrypted}, ${refreshTokenEncrypted}, ${expiresAtIso}::timestamptz, NULL, now())
      ON CONFLICT (user_id, provider) DO UPDATE SET
        status = 'connected',
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, integrations.refresh_token_encrypted),
        expires_at = EXCLUDED.expires_at,
        last_error = NULL,
        updated_at = now()
      RETURNING provider, status, expires_at
    `);

    const updated = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {
      provider: PROVIDER,
      status: 'connected',
    };

    logOutcome(userId, 'success');
    const response = successResponse(
      { provider: updated.provider, status: updated.status, expiresAt },
      200,
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      const response = errorResponse(err.code, err.message, err.httpStatus);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
    Sentry.captureException(err, {
      tags: { requestId, provider: PROVIDER },
      extra: { method: 'POST', path: '/api/v1/integrations/google-calendar/connect', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
