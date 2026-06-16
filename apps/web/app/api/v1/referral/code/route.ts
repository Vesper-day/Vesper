// GET /api/v1/referral/code (§9) — AUTHENTICATED referral summary.
//
// Returns { code, url, referralCount, creditsApplied, creditsPending } for the
// settings panel, or 404 { reason: 'not_eligible' } when the user has never
// reached subscription_status='active' (referral_code NULL — §9).
//
// createRoute is unusable: its error path emits the §9 { error: { code, message } }
// envelope, but §9 mandates the bare { reason: 'not_eligible' } body for this 404.
// So this mirrors the chat-024 energy route's manual wrapper (requestId → version
// gate → session → handler) with a custom 404 body. Read logic + withUser scoping
// live in ./getReferralCode (a route.ts file may export only HTTP handlers +
// segment config).
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  errorResponse,
  successResponse,
  validateSession,
  checkAppVersion,
  ErrorCode,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { getReferralCode } from './getReferralCode';
import type { ReferralNotEligibleResponse } from '../schemas';

const REQUEST_ID_HEADER = 'X-Request-Id';

export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const result = await getReferralCode(createDrizzleClient(), user.id);

    if (!result.eligible) {
      const body: ReferralNotEligibleResponse = { reason: 'not_eligible' };
      const response = new Response(JSON.stringify(body), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }

    const response = successResponse(result.data);
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
      extra: { method: request.method, path: '/api/v1/referral/code', userId },
    });
    const response = errorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      500,
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}
