import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
// Client-safe SUBPATH import (not the bare '@vesper/shared' barrel): the barrel
// statically pulls api/auth → @vesper/db → postgres (fs/perf_hooks), which breaks
// `next build` the moment a 'use client' page mounts this hook (chat 039 is the
// first such consumer). The '/realtime' subpath exports exactly these symbols.
import {
  createRealtimeClient,
  selfMutationFilter,
  type RealtimeConnectionState,
  type RealtimeStateContext,
} from '@vesper/shared/realtime';
import { getSupabaseClient } from '../lib/supabase';

/**
 * Web Realtime hook (build chat 037). Subscribes to block changes for the current
 * plan via the shared Realtime client; on each broadcast that passes the
 * self-mutation filter it invalidates the TanStack Query key `['plan', planDate]`
 * so the plan refetches. The QueryClient is read from the existing
 * QueryClientProvider (apps/web/app/providers.tsx) — this hook never constructs
 * one (that is chat 038's queryClient.ts).
 *
 * Emits the PostHog event `realtime_connection_state_changed` on every state
 * transition and drops a Sentry breadcrumb on non-recoverable errors.
 */

interface RealtimeConnectionStateChangedPayload {
  state: RealtimeConnectionState;
  // Explicitly `| undefined` (not `?:`) — exactOptionalPropertyTypes forbids
  // passing an undefined `reason` through an optional member.
  reason: string | undefined;
  plan_date: string;
  retry_count: number;
}

/**
 * Emit `realtime_connection_state_changed`. Payload is snake_case to match the
 * taxonomy (cf. the alarm_* emits in apps/mobile/lib/analytics.ts).
 *
 * FLAG: the web app has no PostHog seam yet — posthog-js is installed but is not
 * initialised until chat 096 registers the taxonomy. Until then this is a
 * guarded dev-only log, mirroring the mobile track() no-op. Chat 096 must
 * register `realtime_connection_state_changed` and route this through PostHog.
 */
function emitConnectionState(payload: RealtimeConnectionStateChangedPayload): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[analytics] realtime_connection_state_changed', payload);
  }
}

export function usePlanRealtime(userId: string | undefined, planDate: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !planDate) return;

    const client = createRealtimeClient(getSupabaseClient());

    void client.subscribeToBlocks(
      userId,
      planDate,
      (row) => {
        // Drop the device's own echoed write (already applied optimistically).
        if (selfMutationFilter.shouldDrop(row.client_mutation_id)) return;
        void queryClient.invalidateQueries({ queryKey: ['plan', planDate] });
      },
      (state: RealtimeConnectionState, ctx: RealtimeStateContext) => {
        emitConnectionState({
          state,
          reason: ctx.reason,
          plan_date: planDate,
          retry_count: ctx.retryCount,
        });
        if (state === 'error') {
          Sentry.addBreadcrumb({
            category: 'realtime',
            level: 'error',
            message: 'realtime_channel_error',
            data: { plan_date: planDate, reason: ctx.reason, retry_count: ctx.retryCount },
          });
        }
      },
    );

    return () => {
      void client.unsubscribe();
    };
  }, [userId, planDate, queryClient]);
}
