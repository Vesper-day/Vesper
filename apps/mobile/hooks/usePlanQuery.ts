// Mobile plan day-view query hook (build chat 040 — RN parity with web 039's
// apps/web/hooks/usePlanQuery.ts).
//
// Reads GET /api/v1/plans/date/[date] for an explicit local date and caches under
// ['plan', planDate] — the SAME key usePlanRealtime (chat 037) invalidates on a
// Realtime broadcast and useDayRollover re-fires for the new day. Built on the chat-013
// PersistQueryClientProvider's single QueryClient (apps/mobile/app/providers.tsx) via
// useQuery — this hook adds NO second query-client, and the ['plan', *] key is what that
// provider dehydrates to AsyncStorage, so a cached plan renders instantly on cold start.
//
// TRANSPORT: goes through the shared mobile API client (lib/api/client) so the plan read
// carries the Authorization bearer + X-Vesper-Client/X-App-Version headers and inherits
// the 401 (sign-out) and 426 (update-gate) handling — same convention as lib/tasks.ts /
// lib/calendarEvents.ts. The client throws a generic ApiError(status); a 404 from
// /plans/date is uniquely PLAN_NOT_FOUND (an invalid date shape → 400, not 404), so a
// status-404 check is a faithful PLAN_NOT_FOUND signal without parsing the §9 error body.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient, ApiError } from '../lib/api/client';
import type { PlanResponse } from '../components/plan/types';

/** Typed plan-read failure — carries the HTTP status so the empty state can branch. */
export class PlanQueryError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PlanQueryError';
    this.status = status;
  }

  /** True for the PLAN_NOT_FOUND 404 that signals the "no plan yet" empty state. */
  get isPlanNotFound(): boolean {
    return this.status === 404;
  }
}

async function fetchPlanForDate(planDate: string): Promise<PlanResponse> {
  try {
    return await apiClient.get<PlanResponse>(`/plans/date/${planDate}`);
  } catch (err) {
    if (err instanceof ApiError) {
      throw new PlanQueryError(err.message, err.status);
    }
    throw err;
  }
}

/**
 * Fetch the plan for `planDate` ("YYYY-MM-DD"). Disabled until a date is known (initial
 * render before the local date resolves). A PLAN_NOT_FOUND 404 is terminal and
 * non-retryable — retrying only delays the empty state — so retry is suppressed for it
 * while other failures keep the provider default (retry: 2).
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
      return failureCount < 2;
    },
  });
}
