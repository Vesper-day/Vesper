import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { PlanResponse } from '@/app/api/v1/plans/operations';

/**
 * Plan day-view query hook (build chat 039). Reads GET /api/v1/plans/date/[date]
 * for an explicit local date and caches under the key ['plan', planDate] — the
 * same key usePlanRealtime invalidates on a Realtime broadcast, and the key
 * 041-W later hydrates block detail from. Follows the existing web query-client
 * conventions (the single QueryClient in app/providers.tsx; the ['tasks'] hook in
 * components/tasks/TaskList.tsx) — this hook adds NO second query-client.
 *
 * WHY a bespoke fetch (not @/lib/api): the shared api.get throws a generic
 * `Error("404 Not Found")` that loses the §9 error code, so the empty state
 * could not distinguish PLAN_NOT_FOUND (→ "no plan yet" CTA) from a real error.
 * Here the queryFn parses the §9 `{ error: { code, message } }` body and throws a
 * PlanQueryError carrying { code, status } so the caller can branch on it.
 */

/** Typed plan-read failure — carries the §9 error code + HTTP status. */
export class PlanQueryError extends Error {
  public readonly code: string | null;
  public readonly status: number;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'PlanQueryError';
    this.status = status;
    this.code = code;
  }

  /** True for the PLAN_NOT_FOUND 404 that signals the "no plan yet" empty state. */
  get isPlanNotFound(): boolean {
    return this.status === 404 || this.code === 'PLAN_NOT_FOUND';
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function fetchPlanForDate(planDate: string): Promise<PlanResponse> {
  const res = await fetch(`/api/v1/plans/date/${planDate}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    // Parse the §9 error body for the code; fall back to status-only on a
    // non-JSON body (e.g. an upstream 502 HTML page).
    let code: string | null = null;
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
    } catch {
      // keep the status-line message
    }
    throw new PlanQueryError(message, res.status, code);
  }
  return res.json() as Promise<PlanResponse>;
}

/**
 * Fetch the plan for `planDate` ("YYYY-MM-DD"). Disabled until a date is known
 * (initial render before the local date resolves). A PLAN_NOT_FOUND 404 is a
 * terminal, non-retryable outcome — retrying it just delays the empty state — so
 * retry is suppressed for it while other failures keep the provider default.
 */
export function usePlanQuery(
  planDate: string | null,
): UseQueryResult<PlanResponse, PlanQueryError> {
  return useQuery<PlanResponse, PlanQueryError>({
    queryKey: ['plan', planDate],
    enabled: planDate !== null,
    queryFn: () => fetchPlanForDate(planDate as string),
    retry: (failureCount, error) => {
      if (error instanceof PlanQueryError && error.isPlanNotFound) return false;
      return failureCount < 2; // matches the provider default (retry: 2)
    },
  });
}
