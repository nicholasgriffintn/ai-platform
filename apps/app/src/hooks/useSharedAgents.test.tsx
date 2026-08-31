import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AGENTS_QUERY_KEYS } from "./useAgents";
import { capabilityCatalogQueryKey } from "./useCapabilityCatalog";
import { useAgentSharing, useSharedAgents } from "./useSharedAgents";

const mocks = vi.hoisted(() => ({
  getSharedAgentListingForAgent: vi.fn(),
  getSharedCategories: vi.fn(),
  getSharedTags: vi.fn(),
  installSharedAgent: vi.fn(),
  listFeaturedSharedAgents: vi.fn(),
  listSharedAgents: vi.fn(),
  unshareAgent: vi.fn(),
}));

vi.mock("~/lib/api/api-service", () => ({ apiService: mocks }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSharedCategories.mockResolvedValue([]);
  mocks.getSharedTags.mockResolvedValue([]);
  mocks.listSharedAgents.mockResolvedValue([]);
  mocks.listFeaturedSharedAgents.mockResolvedValue([]);
  mocks.installSharedAgent.mockResolvedValue({});
  mocks.unshareAgent.mockResolvedValue(undefined);
  mocks.getSharedAgentListingForAgent.mockResolvedValue(null);
});

describe("installing a shared agent", () => {
  it("refreshes the personal capability library so the installed agent appears", async () => {
    const queryClient = createQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSharedAgents(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.installSharedAgent("shared-1");
    });

    expect(mocks.installSharedAgent).toHaveBeenCalledWith("shared-1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: capabilityCatalogQueryKey() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: AGENTS_QUERY_KEYS.all });
  });

  it("leaves the library untouched when the install fails", async () => {
    const queryClient = createQueryClient();

    mocks.installSharedAgent.mockRejectedValue(new Error("Agent already installed"));

    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSharedAgents(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.installSharedAgent("shared-1")).rejects.toThrow(
        "Agent already installed",
      );
    });

    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: capabilityCatalogQueryKey() });
  });
});

describe("sharing an owned agent", () => {
  it("reports the existing listing so the owner can withdraw it", async () => {
    const queryClient = createQueryClient();

    mocks.getSharedAgentListingForAgent.mockResolvedValue({
      id: "shared-1",
      name: "Researcher",
      usage_count: 3,
    });

    const { result } = renderHook(() => useAgentSharing("agent-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.listing?.id).toBe("shared-1"));

    await act(async () => {
      await result.current.unshareAgent("shared-1");
    });

    expect(mocks.unshareAgent).toHaveBeenCalledWith("shared-1");
    await waitFor(() => expect(mocks.getSharedAgentListingForAgent).toHaveBeenCalledTimes(2));
  });

  it("does not look up a listing until an agent is chosen", () => {
    renderHook(() => useAgentSharing(null), { wrapper: createWrapper(createQueryClient()) });

    expect(mocks.getSharedAgentListingForAgent).not.toHaveBeenCalled();
  });
});
