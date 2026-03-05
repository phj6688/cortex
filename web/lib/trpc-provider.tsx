'use client';

/**
 * tRPC + TanStack Query provider.
 * @module lib/trpc-provider
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from './trpc';

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.BACKEND_URL ?? 'http://localhost:3481';
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5_000, retry: 1 },
      },
    }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({ url: `${getBaseUrl()}/trpc` }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
