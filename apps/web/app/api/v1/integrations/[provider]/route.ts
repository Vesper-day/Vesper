// DELETE /api/v1/integrations/:provider (§6, chat 063)
//
// Disconnects an integration: revokes the OAuth grant with the provider, then
// deletes the `integrations` row. Returns 204 (empty body), which createRoute
// (200 + JSON) cannot express, so this uses the manual auth/error wrapper.
//
// Revoke is BEST-EFFORT: if Google is unreachable or rejects the revoke, we log
// it but still delete the local row so "Disconnect" is never stuck — the worst
// case is a still-valid token at Google that the user can revoke from their
// Google account. A missing row is not an error (idempotent 204).
//
// RAW SQL: the Drizzle integrations model is stale vs migration 7 (see the
// connect route). The delete + the token read for revoke use raw parameterized
// SQL. The audit trigger (migration 11) records the DELETE into
// security_audit_log automatically.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  errorResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient, sql } from '@vesper/db';
import { decryptToken } from '@vesper/db/encryption';

const REQUEST_ID_HEADER = 'X-Request-Id';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

// integration_provider_enum (migration 1). At V1 only google_calendar is wired,
// but the param is validated against the full enum so an unknown provider is a
// clean 400 rather than a SQL enum cast error.
const VALID_PROVIDERS = new Set([
  'google_calendar',
  'apple_calendar',
  'google_fit',
  'apple_health',
]);

export const dynamic = 'force-dynamic';

type Outcome = 'success' | 'auth-error' | 'network-error';

function logOutcome(userId: string | undefined, provider: string, outcome: Outcome): void {
  console.info(
    JSON.stringify({ msg: 'integrations.disconnect', user_id: userId, provider, outcome }),
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const params = (await context?.params) ?? {};
    const provider = Array.isArray(params.provider) ? params.provider[0] : params.provider;
    if (!provider || !VALID_PROVIDERS.has(provider)) {
      throw new ApiError(ErrorCode.INVALID_REQUEST, 'Unknown integration provider.');
    }

    const db = createDrizzleClient();

    // Read the stored tokens so we can revoke the grant before deleting.
    const rows = (await db.execute(sql`
      SELECT access_token_encrypted, refresh_token_encrypted
      FROM integrations
      WHERE user_id = ${user.id} AND provider = ${provider}
      LIMIT 1
    `)) as unknown as Array<{
      access_token_encrypted: Buffer | null;
      refresh_token_encrypted: Buffer | null;
    }>;

    const row = rows[0];

    // Best-effort revoke for Google providers only (others have no revoke step at V1).
    if (row && provider.startsWith('google')) {
      const cipher = row.refresh_token_encrypted ?? row.access_token_encrypted;
      if (cipher) {
        try {
          const token = await decryptToken(cipher);
          const revokeRes = await fetch(GOOGLE_REVOKE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token }),
          });
          if (!revokeRes.ok) {
            const errorBody = await revokeRes.text().catch(() => '');
            Sentry.captureMessage('Google token revoke failed', {
              level: 'warning',
              tags: { requestId, provider, outcome: 'auth-error', status: String(revokeRes.status) },
              extra: { errorBody, userId },
            });
            logOutcome(userId, provider, 'auth-error');
          }
        } catch (revokeErr) {
          // Network/transport or decrypt failure — log, then fall through to delete.
          Sentry.captureException(revokeErr, {
            tags: { requestId, provider, outcome: 'network-error' },
            extra: { method: 'DELETE', path: '/api/v1/integrations/[provider]', userId },
          });
          logOutcome(userId, provider, 'network-error');
        }
      }
    }

    // Delete the row regardless of revoke outcome (idempotent: 204 even if absent).
    await db.execute(sql`
      DELETE FROM integrations
      WHERE user_id = ${user.id} AND provider = ${provider}
    `);

    if (row) logOutcome(userId, provider, 'success');

    const response = new Response(null, { status: 204 });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      const response = errorResponse(err.code, err.message, err.httpStatus);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
    Sentry.captureException(err, {
      tags: { requestId },
      extra: { method: 'DELETE', path: '/api/v1/integrations/[provider]', userId },
    });
    const response = errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
