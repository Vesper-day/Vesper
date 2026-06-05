'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

/**
 * Client provider tree for the web app.
 *
 * TanStack Query: one QueryClient per browser session (useState initializer so
 * it survives re-renders but is never shared across requests). Defaults per
 * ARCHITECTURE_DECISIONS Decision 06 — in-memory only, NO persistence.
 *   staleTime 30_000ms, retry 2, refetchOnWindowFocus true.
 *
 * Zustand stores are plain hooks (apps/web/store/*), so no provider is needed.
 */
export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
