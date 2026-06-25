import { useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { QueryClient, MutationCache, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import {
  buildMutationCacheConfig,
  buildMutationDefaults,
  createConflictToast,
  createMutationPersister,
  flushQueue,
  type MutationDroppedInfo,
} from '@vesper/shared/queries';
import { UpdateGateModal } from '../components/UpdateGateModal';
import { useUiStore } from '../store/ui';

/**
 * Client provider tree for the mobile app. Mirrors apps/web/app/providers.tsx
 * (one QueryClient per session via a useState initializer; staleTime 30_000,
 * retry 2).
 *
 * MOBILE DIVERGENCE FROM WEB: the cache is persisted to AsyncStorage via
 * persistQueryClient (ARCHITECTURE_DECISIONS Decision 06) so the plan surface
 * renders instantly from disk on cold start while a background refetch runs.
 * Only ['plan', *] and ['weeklyPriorities', *] queries are dehydrated; the
 * persisted cache expires after 24h.
 *
 * OFFLINE MUTATION QUEUE (build chat 038): a configured mutationCache + mutation
 * defaultOptions add the retry/backoff + 409 → invalidate+conflict-toast policy.
 * Unlike web, mobile ALSO persists the queued (paused) block mutations — under a
 * SEPARATE key (vesper.offline-mutations.v1) so it never collides with the
 * chat-013 query persister above — and rehydrates + flushes them on cold start.
 *
 * No React Query devtools on mobile — the devtools panel is web-only and has no
 * drop-in React Native equivalent.
 */

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

/** Guarded dev-log analytics seam (records-only; chat 096 routes these to PostHog). */
function emitAnalytics(event: string, payload: Record<string, unknown>): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[analytics] ${event}`, payload);
  }
}

/** Drop reporter — a dropped (non-OLF 4xx) edit must never be silent (chat 038 R3). */
function reportDroppedMutation(info: MutationDroppedInfo): void {
  Sentry.addBreadcrumb({
    category: 'offline-queue',
    level: 'warning',
    message: 'offline_queue_mutation_dropped',
    data: { ...info },
  });
}

export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  const [queryClient] = useState(() => {
    // Singleton conflict toast (chat 038 R5): one 5s coalescing window per app.
    const conflictToast = createConflictToast({
      emit: (message) => useUiStore.getState().enqueueToast({ message, variant: 'info' }),
    });
    let client!: QueryClient;
    const mutationCache = new MutationCache(
      buildMutationCacheConfig({
        getQueryClient: () => client,
        emitConflict: () => conflictToast.notify(),
        onAnalyticsEvent: emitAnalytics,
        onMutationDropped: reportDroppedMutation,
      }),
    );
    client = new QueryClient({
      mutationCache,
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 2,
        },
        mutations: buildMutationDefaults(),
      },
    });
    return client;
  });

  // Mobile-only mutation persister (chat 038 OD-5) — separate key from the query
  // persister above.
  const [mutationPersister] = useState(() =>
    createMutationPersister({ storage: AsyncStorage }),
  );

  useEffect(() => {
    let mounted = true;
    let stopPersist = (): void => {};

    void (async () => {
      // Cold start: rehydrate queued offline mutations, then begin persisting on
      // every cache change, then flush what was queued before the app was killed.
      await mutationPersister.hydrate(queryClient);
      if (!mounted) return;
      stopPersist = mutationPersister.start(queryClient);
      void flushQueue(queryClient, { onAnalyticsEvent: emitAnalytics });
    })();

    // SINGLE flush path (chat 038 R4): drive online state + flush manually so
    // TanStack's built-in online-resume never races our flush. No NetInfo dep —
    // foreground is the reconnect proxy: background pauses new mutations, and a
    // return to foreground flushes FIRST (sole emitter of flush_started/_completed
    // + the conflict window) then flips online.
    //
    // KNOWN V1 LIMITATION: network restored while the app is ALREADY foregrounded
    // does not flush until the next foreground transition (no NetInfo — by design).
    onlineManager.setEventListener((setOnline) => {
      const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (next === 'background') {
          setOnline(false);
        } else if (next === 'active') {
          void flushQueue(queryClient, { onAnalyticsEvent: emitAnalytics }).finally(() => {
            setOnline(true);
          });
        }
      });
      setOnline(true); // foregrounded at startup
      return () => sub.remove();
    });

    return () => {
      mounted = false;
      stopPersist();
    };
  }, [queryClient, mutationPersister]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: ONE_DAY_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            // Persists ['plan',*] and ['weeklyPriorities',*] per Chat 013 build-plan Output; note ARCHITECTURE_DECISIONS Decision 06 names plan-only — confirm scope before V1 ship.
            query.state.status === 'success' &&
            (query.queryKey[0] === 'plan' || query.queryKey[0] === 'weeklyPriorities'),
        },
      }}
    >
      {children}
      <UpdateGateModal />
    </PersistQueryClientProvider>
  );
}
