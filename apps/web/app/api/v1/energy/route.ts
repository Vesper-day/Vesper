// POST /api/v1/energy (§9).
//
// Logs an energy score INDEPENDENT of plan generation. The core logic lives in
// the sibling ./logEnergy module: a route.ts file may export ONLY HTTP-method
// handlers + segment config, so the pure logEnergy helper cannot be exported here
// (Next.js rejects it as "not a valid Route export field" at build time).
//
// 201 status is required by §9, which createRoute (fixed 200) cannot express, so
// this route mirrors createRoute's wrapper manually (requestId → version gate →
// session → handler → successResponse(.., 201)).
import * as Sentry from '@sentry/nextjs';
import {
  ApiError,
  ErrorCode,
  successResponse,
  errorResponse,
  validateSession,
  checkAppVersion,
} from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { EnergyLogRequestSchema } from '../profile/schemas';
import { logEnergy } from './logEnergy';

const REQUEST_ID_HEADER = 'X-Request-Id';

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;

  try {
    checkAppVersion(request);
    const user = await validateSession(request);
    userId = user.id;

    const raw: unknown = await request.json().catch(() => null);
    const parsed = EnergyLogRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.INVALID_REQUEST,
        'Request body must be { score: 1..10, loggedAt?: ISO }.',
      );
    }

    const data = await logEnergy(createDrizzleClient(), user.id, parsed.data);
    const response = successResponse(data, 201);
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
      extra: { method: request.method, path: '/api/v1/energy', userId },
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
