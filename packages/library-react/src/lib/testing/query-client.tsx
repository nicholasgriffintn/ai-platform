import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const clients = new Set<QueryClient>();

export function createQueryClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  clients.add(client);

  return client;
}

export function clearQueryClients(): void {
  for (const client of clients) {
    client.clear();
  }

  clients.clear();
}

export function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
