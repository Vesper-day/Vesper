// POST /api/v1/plans/generate (§9) — streaming daily-plan generation.
//
// Returns text/event-stream (SSE): partial DailyPlans stream as `event: plan`
// while synthesis runs, then a final `event: done` once the plan is persisted.
// Node runtime is REQUIRED: Vercel's Edge runtime does not support the long-lived
// Web Streams plumbing this needs, and @vesper/db (postgres-js) is Node-only.
//
// This route file exports ONLY the POST handler + `runtime` (Next.js rejects any
// other Route export); the core logic lives in the sibling ./generatePlan module
// so the integration test can drive it without Supabase Auth.
//
// Flow (§9):
//   a. auth -> AuthenticatedUser (incl. timezone, subscriptionStatus)
//   b. read subscriptionStatus ONCE -> EXACTLY ONE cap path (never both):
//        trial -> checkTrialCap (2/local day) ; else -> checkActiveCap (5/rolling hr)
//      a capped request 429s BEFORE the lock is acquired.
//   c. acquire idempotency lock on (user, date); already held -> 409 (verbatim msg).
//   d. existence check -> regeneration?
//   e-i. stream + buffer-then-commit + heartbeat + abort + lock release (sibling).
//
// Pre-stream failures (auth/validation/cap/lock) return the §9 JSON error shape.
// Once streaming begins the response is a committed 200 SSE body, so failures
// after that point (incl. AI failure-after-fallbacks, §9) are 200 + an in-stream
// event, never a 5xx.
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  RateLimitError,
  errorResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { acquireLock } from '../../../../../lib/idempotency';
import { checkTrialCap, checkActiveCap } from '../../../../../lib/regenerationLimits';
import { GenerateRequestSchema, planExists, createPlanStream } from './generatePlan';

// Node runtime is mandatory (Web Streams streaming + postgres-js are not edge-safe).
export const runtime = 'nodejs';

const REQUEST_ID_HEADER = 'X-Request-Id';

const LOCK_HELD_MESSAGE =
  'A plan is being generated for this date; try again in a moment.';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const raw: unknown = await request.json().catch(() => null);
    const parsed = GenerateRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { date: YYYY-MM-DD, energyScore: 1..10 }.',
      );
    }
    const { date, energyScore } = parsed.data;

    const db = createDrizzleClient();

    // (b) Read subscriptionStatus ONCE; route to EXACTLY ONE cap path. A 429 here
    // happens before any lock is taken.
    if (user.subscriptionStatus === 'trial') {
      await checkTrialCap(db, { id: user.id, timezone: user.timezone });
    } else {
      await checkActiveCap({ id: user.id, timezone: user.timezone });
    }

    // (c) Idempotency lock. Already held -> 409 with the verbatim message.
    const acquired = await acquireLock(user.id, date);
    if (!acquired) {
      throw new ApiError(ErrorCode.CONFLICT, LOCK_HELD_MESSAGE);
    }

    // (d) Regeneration? (existence of an existing plan for (user, date)). On any
    // failure before streaming starts, release the lock so the date isn't wedged.
    let isRegeneration: boolean;
    try {
      isRegeneration = await planExists(db, user.id, date);
    } catch (err) {
      const { releaseLock } = await import('../../../../../lib/idempotency');
      await releaseLock(user.id, date).catch(() => undefined);
      throw err;
    }

    // (e-i) Hand off to the streaming body (owns heartbeat, abort wiring, commit,
    // and lock release on stream end).
    const stream = createPlanStream({
      db,
      userId: user.id,
      timezone: user.timezone,
      planDate: date,
      energyScore,
      isRegeneration,
      requestSignal: request.signal,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        [REQUEST_ID_HEADER]: requestId,
      },
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      const response = errorResponse(err.code, err.message, err.httpStatus);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      response.headers.set('Retry-After', String(err.retryAfterSeconds));
      return response;
    }
    if (err instanceof ApiError) {
      const response = errorResponse(err.code, err.message, err.httpStatus);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
    Sentry.captureException(err, {
      tags: { requestId },
      extra: { method: request.method, path: '/api/v1/plans/generate', userId },
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
