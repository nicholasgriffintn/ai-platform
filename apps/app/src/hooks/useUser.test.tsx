import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MODELS_QUERY_KEY } from "./useModels";
import { REALTIME_PROVIDERS_QUERY_KEY } from "./useRealtimeProviders";
import { useUser } from "./useUser";

const mocks = vi.hoisted(() => ({
  deleteProviderApiKey: vi.fn(),
  storeProviderApiKey: vi.fn(),
}));

vi.mock("~/lib/api/api-service", () => ({
  apiService: {
    deleteProviderApiKey: mocks.deleteProviderApiKey,
    getProviderSettings: vi.fn(async () => []),
    getProviderSyncStatus: vi.fn(async () => ({ required: false })),
    storeProviderApiKey: mocks.storeProviderApiKey,
    syncProviders: vi.fn(),
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  queryClient.setQueryData([MODELS_QUERY_KEY], {});
  queryClient.setQueryData(REALTIME_PROVIDERS_QUERY_KEY, { providers: [] });

  return queryClient;
}

function expectProviderReadinessInvalidated(queryClient: QueryClient): void {
  expect(queryClient.getQueryState([MODELS_QUERY_KEY])?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(REALTIME_PROVIDERS_QUERY_KEY)?.isInvalidated).toBe(true);
}

describe("provider credential mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteProviderApiKey.mockResolvedValue(undefined);
    mocks.storeProviderApiKey.mockResolvedValue(undefined);
  });

  it("refreshes model and realtime readiness after storing a provider key", async () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useUser({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.storeProviderApiKey({ providerId: "openai", apiKey: "test-key" });
    });

    expectProviderReadinessInvalidated(queryClient);
  });

  it("refreshes model and realtime readiness after deleting a provider key", async () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useUser({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.deleteProviderApiKey({ providerId: "openai" });
    });

    expectProviderReadinessInvalidated(queryClient);
  });
});
