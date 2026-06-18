// GET /api/v1/plans/today (§9).
//
// Returns the authenticated user's plan for their CURRENT LOCAL date. The local
// date is computed from the user's IANA timezone (localDateInTimeZone), mirroring
// the DB-side start_of_local_day(tz) day boundary — so "today" is the user's
// today, not the server's. 404 (PLAN_NOT_FOUND) when no plan exists for it.
//
// Core logic lives in the sibling ../operations module (a route.ts may export
// only HTTP-method handlers + segment config). The integration tests drive
// getPlanForDate directly against the chat-002 local-Supabase test DB.
import { createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import { localDateInTimeZone } from '@/lib/dates/localDate';
import { getPlanForDate, type PlanResponse } from '../operations';

export const GET = createRoute<PlanResponse>(async ({ user }) => {
  const planDate = localDateInTimeZone(user.timezone, new Date());
  return getPlanForDate(createDrizzleClient(), user.id, planDate);
});
