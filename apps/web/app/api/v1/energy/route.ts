// POST /api/v1/energy (§9).
//
// Logs an energy score INDEPENDENT of plan generation: writes exactly one
// completion_log row with event_type='energy_logged'. Triggers no plan
// generation and modifies no plan.
//
// Canonical value shape (chat-024 decision Q1): value = { score }. Energy logging
// is plan-independent by spec, so plan_date is undefined-by-design (not merely
// absent from the body); logged_at already day-buckets the row. Chat 024 is the
// first writer and no completionLogValue Zod exists yet.
//
// IMPORTANT — completion_log raw-SQL workaround (chat-024 decision Q2):
// The completionLog ORM model (packages/db/src/schema/analytics.ts) is STALE vs
// the applied migration 20260601000010: the model declares event_name/occurred_at
// and omits block_id/event_type, while the real table has
// (user_id, block_id, event_type completion_event_enum, value, logged_at). We do
// NOT hand-edit the stub (that violates the CHAT_111 §5 locked decision and is out
// of apps/web scope); the durable fix is chat-006 drizzle-kit pull regenerating
// the model. Until then we INSERT via raw parameterized SQL against the
// migration-defined columns, scoped by an explicit user_id (the write-side analog
// of withUser).
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
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import {
  EnergyLogRequestSchema,
  type EnergyLogRequest,
  type EnergyLogResponse,
} from '../profile/schemas';

const REQUEST_ID_HEADER = 'X-Request-Id';

export async function logEnergy(
  db: Database,
  userId: string,
  input: EnergyLogRequest,
): Promise<EnergyLogResponse> {
  const valueJson = JSON.stringify({ score: input.score });
  const loggedAtExpr =
    input.loggedAt !== undefined ? sql`${input.loggedAt}::timestamptz` : sql`now()`;

  // completionLog ORM model (analytics.ts) is stale vs migration — raw SQL until
  // chat-006 drizzle-kit pull regenerates it.
  const result = await db.execute(sql`
    INSERT INTO completion_log (user_id, event_type, value, logged_at)
    VALUES (${userId}::uuid, 'energy_logged', ${valueJson}::jsonb, ${loggedAtExpr})
    RETURNING id, logged_at
  `);

  const rows = result as unknown as Array<{ id: string; logged_at: string | Date }>;
  const row = rows[0];
  if (!row) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to record energy log.');
  }

  const loggedAtIso =
    row.logged_at instanceof Date
      ? row.logged_at.toISOString()
      : new Date(row.logged_at).toISOString();

  return {
    logged: {
      id: row.id,
      score: input.score,
      loggedAt: loggedAtIso,
    },
  };
}

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
