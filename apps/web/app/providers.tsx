'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
  onlineManager,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import * as Sentry from '@sentry/nextjs';
import {
  buildMutationCacheConfig,
  buildMutationDefaults,
  createConflictToast,
  flushQueue,
  type MutationDroppedInfo,
} from '@vesper/shared/queries';
import { useUiStore } from '../store/ui';

/**
 * Client provider tree for the web app.
 *
 * TanStack Query: one QueryClient per browser session (useState initializer so
 * it survives re-renders but is never shared across requests). Defaults per
 * ARCHITECTURE_DECISIONS Decision 06 — in-memory only, NO persistence.
 *   staleTime 30_000ms, retry 2, refetchOnWindowFocus true.
 *
 * OFFLINE MUTATION QUEUE (build chat 038): a configured mutationCache + mutation
 * defaultOptions wire the retry/backoff + 409 → invalidate+conflict-toast policy.
 * Web has NO mutation-cache persistence (Decision 06) — only mobile persists.
 *
 * Zustand stores are plain hooks (apps/web/store/*), so no provider is needed.
 */

/** Guarded dev-log analytics seam (records-only; chat 096 routes these to PostHog). */
function emitAnalytics(event: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
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
          refetchOnWindowFocus: true,
        },
        mutations: buildMutationDefaults(),
      },
    });
    return client;
  });

  // SINGLE flush path (chat 038 R4): drive online state + flush manually so
  // TanStack's built-in online-resume never races our flush. We replace the
  // default onlineManager listener: 'offline' pauses new mutations; 'online'
  // flushes FIRST (the sole emitter of flush_started/_completed + the conflict
  // window) and only THEN flips online (by which point nothing is left to
  // auto-resume).
  useEffect(() => {
    onlineManager.setEventListener((setOnline) => {
      const onOnline = (): void => {
        void flushQueue(queryClient, { onAnalyticsEvent: emitAnalytics }).finally(() => {
          setOnline(true);
        });
      };
      const onOffline = (): void => setOnline(false);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      // Seed from the current state.
      setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
