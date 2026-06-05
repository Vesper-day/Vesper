import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

/**
 * App lifecycle bridge. Mounted once inside the TanStack Query provider (root
 * layout → providers).
 *
 *   - foreground ('active'): invalidate ['plan'] queries so the daily surface
 *     refetches fresh data the moment the user returns to the app;
 *   - background ('background'): tear down the Realtime connection
 *     (ARCHITECTURE_DECISIONS Decision 18 — no background WebSocket). The
 *     Realtime client itself is wired in Chat 037; this is a no-op stub until
 *     then.
 */
export function useAppLifecycle(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void queryClient.invalidateQueries({ queryKey: ['plan'] });
      } else if (next === 'background') {
        // TODO(Chat 037): suspend the Supabase Realtime WebSocket here
        // (Decision 18). No Realtime client exists yet — intentional no-op.
      }
    });

    return () => subscription.remove();
  }, [queryClient]);
}
