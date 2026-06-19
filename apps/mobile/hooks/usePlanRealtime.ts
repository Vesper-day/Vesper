import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import {
  createRealtimeClient,
  selfMutationFilter,
  type RealtimeConnectionState,
  type RealtimeStateContext,
} from '@vesper/shared';
import { supabase } from '../lib/supabase';

/**
 * Mobile Realtime hook (build chat 037). Subscribes to block changes for the
 * current plan via the shared Realtime client; on each broadcast that passes the
 * self-mutation filter it invalidates the TanStack Query key `['plan', planDate]`.
 * The QueryClient is read from the existing PersistQueryClientProvider
 * (apps/mobile/app/providers.tsx) — this hook never constructs one (chat 038).
 *
 * Lifecycle (ARCHITECTURE_DECISIONS Decision 18 — no background WebSocket): the
 * socket is torn down on background and re-subscribed on foreground; on
 * foreground it ALSO explicitly invalidates `['plan', planDate]` so broadcasts
 * received while the socket was suspended are picked up by the refetch (without
 * this, missed background updates are silently dropped).
 *
 * FLAG (useAppLifecycle): the chat-013 hook apps/mobile/hooks/useAppLifecycle.ts
 * is `useAppLifecycle(): void` — it takes no callbacks and is already mounted at
 * the root provider, where it invalidates `['plan']` on foreground. Its signature
 * exposes no seam to drive this Realtime socket's suspend/resume, so suspend/
 * resume is handled here via the hook's own AppState listener. Its
 * `TODO(Chat 037): suspend the Supabase Realtime WebSocket here` therefore
 * remains; wiring it would require editing useAppLifecycle (out of this chat's
 * four-file scope). Recommend a follow-up to reconcile (give useAppLifecycle
 * lifecycle callbacks, or drop the now-stale TODO).
 *
 * Emits `realtime_connection_state_changed` on every state transition and drops a
 * Sentry breadcrumb on non-recoverable errors.
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
 * FLAG: routes through a guarded dev log, not the lib/analytics.ts track() seam,
 * because that seam's typed AnalyticsEventMap does not yet include this event
 * (extending it is chat 096's taxonomy work). Chat 096 must register
 * `realtime_connection_state_changed` and route this through track()/PostHog.
 */
function emitConnectionState(payload: RealtimeConnectionStateChangedPayload): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log('[analytics] realtime_connection_state_changed', payload);
  }
}

export function usePlanRealtime(userId: string | undefined, planDate: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !planDate) return;

    const client = createRealtimeClient(supabase);

    const onUpdate = (row: { client_mutation_id: string | null }): void => {
      // Drop the device's own echoed write (already applied optimistically).
      if (selfMutationFilter.shouldDrop(row.client_mutation_id)) return;
      void queryClient.invalidateQueries({ queryKey: ['plan', planDate] });
    };

    const onStateChange = (
      state: RealtimeConnectionState,
      ctx: RealtimeStateContext,
    ): void => {
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
    };

    void client.subscribeToBlocks(userId, planDate, onUpdate, onStateChange);

    let suspended = false;
    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') {
        // Tear down the websocket — no background WebSocket (Decision 18).
        suspended = true;
        void client.unsubscribe();
      } else if (next === 'active' && suspended) {
        suspended = false;
        void client.subscribeToBlocks(userId, planDate, onUpdate, onStateChange);
        // Explicit foreground refetch: pick up broadcasts missed while suspended.
        void queryClient.invalidateQueries({ queryKey: ['plan', planDate] });
      }
    });

    return () => {
      appStateSub.remove();
      void client.unsubscribe();
    };
  }, [userId, planDate, queryClient]);
}
