import { useState, type ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UpdateGateModal } from '../components/UpdateGateModal';

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
 * No React Query devtools on mobile — the devtools panel is web-only and has no
 * drop-in React Native equivalent.
 */

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
          },
        },
      }),
  );

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
