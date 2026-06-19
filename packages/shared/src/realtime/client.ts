import type {
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

/**
 * Shared Supabase Realtime client (build chat 037; TECHNICAL_SPEC §3 + LAYER_3).
 *
 * Subscribes to changes on the `blocks` table for ONE plan, scoped by the
 * mandatory filter `daily_plan_id=eq.{planId}`. Without that filter every user's
 * every block change would broadcast to every device and exhaust the Realtime
 * quota. The plan id is resolved from (userId, planDate) at subscribe time.
 *
 * The Supabase client is INJECTED (web: apps/web/lib/supabase.ts; mobile:
 * apps/mobile/lib/supabase.ts) so this module stays free of app-specific env and
 * platform (web vs react-native) wiring.
 */

/** Subscription lifecycle states emitted to the PostHog taxonomy. */
export type RealtimeConnectionState =
  | 'subscribing'
  | 'subscribed'
  | 'error'
  | 'closed'
  | 'reconnecting';

/** Context delivered alongside each state transition. */
export interface RealtimeStateContext {
  reason?: string;
  retryCount: number;
}

/**
 * Raw `blocks` row as delivered by Supabase Realtime (postgres_changes payload).
 *
 * These are DB column names (snake_case) — Realtime ships the row straight from
 * Postgres, so this is NOT the camelCase `@vesper/shared` Block Zod shape. We
 * type only the columns the client/hook reads. `client_mutation_id` exists in the
 * live schema (migration 20260601000004) but not in the Drizzle pull-schema.
 */
export interface BlocksRealtimeRow {
  id: string;
  daily_plan_id: string;
  user_id: string;
  client_mutation_id: string | null;
}

export interface RealtimeClient {
  /**
   * Subscribe to block changes for (userId, planDate). `onUpdate` fires for each
   * broadcast carrying the full row; `onStateChange` (optional) fires on every
   * lifecycle transition for the analytics taxonomy. Resolving to no plan for the
   * date is a no-op that emits `closed` (reason `no_plan_for_date`).
   */
  subscribeToBlocks(
    userId: string,
    planDate: string,
    onUpdate: (row: BlocksRealtimeRow) => void,
    onStateChange?: (state: RealtimeConnectionState, ctx: RealtimeStateContext) => void,
  ): Promise<void>;
  /** Tear down the channel and stop any pending reconnect. */
  unsubscribe(): Promise<void>;
}

const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

interface Subscription {
  planId: string;
  onUpdate: (row: BlocksRealtimeRow) => void;
  // Not optional but explicitly `| undefined`: exactOptionalPropertyTypes forbids
  // assigning `undefined` to a `?:` member, and the caller may pass no handler.
  onStateChange: ((state: RealtimeConnectionState, ctx: RealtimeStateContext) => void) | undefined;
}

export function createRealtimeClient(supabase: SupabaseClient): RealtimeClient {
  let channel: RealtimeChannel | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let retryCount = 0;
  let current: Subscription | null = null;

  function emit(state: RealtimeConnectionState, reason?: string): void {
    // Build ctx conditionally: under exactOptionalPropertyTypes an optional
    // `reason` may not be set to `undefined` explicitly.
    const ctx: RealtimeStateContext =
      reason === undefined ? { retryCount } : { reason, retryCount };
    current?.onStateChange?.(state, ctx);
  }

  function clearReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  async function teardownChannel(): Promise<void> {
    clearReconnect();
    if (channel) {
      await supabase.removeChannel(channel);
      channel = null;
    }
  }

  async function resolvePlanId(userId: string, planDate: string): Promise<string | null> {
    // RLS already scopes the row to the authed user; user_id is kept explicit per
    // the subscribeToBlocks contract and matches the (user_id, plan_date) unique key.
    const { data, error } = await supabase
      .from('daily_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('plan_date', planDate)
      .maybeSingle();
    if (error) return null;
    return (data?.id as string | undefined) ?? null;
  }

  // Reconnection on network blips: supabase-js auto-reconnects the underlying
  // socket, but a dropped channel surfaces as CHANNEL_ERROR / TIMED_OUT. Re-open
  // the channel with capped exponential backoff and surface a `reconnecting`
  // transition so the UI/analytics can see it.
  function scheduleReconnect(): void {
    if (disposed || !current) return;
    clearReconnect();
    retryCount += 1;
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** (retryCount - 1),
      MAX_RECONNECT_DELAY_MS,
    );
    emit('reconnecting', `retry_${retryCount}`);
    reconnectTimer = setTimeout(() => {
      void openChannel();
    }, delay);
  }

  async function openChannel(): Promise<void> {
    if (disposed || !current) return;
    if (channel) {
      await supabase.removeChannel(channel);
      channel = null;
    }
    const sub = current;
    emit('subscribing');
    channel = supabase
      .channel(`blocks:plan:${sub.planId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocks',
          // MANDATORY filter — scope the stream to this plan's rows only.
          filter: `daily_plan_id=eq.${sub.planId}`,
        },
        (payload: RealtimePostgresChangesPayload<BlocksRealtimeRow>) => {
          const row = (payload.new ?? payload.old) as BlocksRealtimeRow | undefined;
          if (row && 'id' in row) sub.onUpdate(row);
        },
      )
      .subscribe((status, err) => {
        switch (status) {
          case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
            retryCount = 0;
            emit('subscribed');
            break;
          case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
            emit('error', 'timed_out');
            scheduleReconnect();
            break;
          case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
            emit('error', err?.message ?? 'channel_error');
            scheduleReconnect();
            break;
          case REALTIME_SUBSCRIBE_STATES.CLOSED:
            emit('closed');
            break;
        }
      });
  }

  return {
    async subscribeToBlocks(userId, planDate, onUpdate, onStateChange) {
      disposed = false;
      await teardownChannel();
      retryCount = 0;
      // Temporary holder so emit() during plan resolution can reach onStateChange.
      current = { planId: '', onUpdate, onStateChange };
      const planId = await resolvePlanId(userId, planDate);
      if (!planId) {
        emit('closed', 'no_plan_for_date');
        current = null;
        return;
      }
      // Fresh assignment (not a mutation) so TS keeps `current` non-null here.
      current = { planId, onUpdate, onStateChange };
      await openChannel();
    },
    async unsubscribe() {
      disposed = true;
      const hadSubscription = current !== null || channel !== null;
      await teardownChannel();
      if (hadSubscription) emit('closed', 'unsubscribed');
      current = null;
    },
  };
}
