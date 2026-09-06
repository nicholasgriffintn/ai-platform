import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { capabilityCatalogQueryKey } from "./useCapabilityCatalog";
import { useTeammateSharing, useSharedTeammates } from "./useSharedTeammates";
import { TEAMMATES_QUERY_KEYS } from "./useTeammates";

const mocks = vi.hoisted(() => ({
  getSharedTeammateListingForTeammate: vi.fn(),
  getSharedCategories: vi.fn(),
  getSharedTags: vi.fn(),
  installSharedTeammate: vi.fn(),
  listFeaturedSharedTeammates: vi.fn(),
  listSharedTeammates: vi.fn(),
  unshareTeammate: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-library-client", () => ({ apiService: mocks }));

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
  mocks.listSharedTeammates.mockResolvedValue([]);
  mocks.listFeaturedSharedTeammates.mockResolvedValue([]);
  mocks.installSharedTeammate.mockResolvedValue({});
  mocks.unshareTeammate.mockResolvedValue(undefined);
  mocks.getSharedTeammateListingForTeammate.mockResolvedValue(null);
});

describe("installing a shared teammate", () => {
  it("refreshes the personal capability library so the installed teammate appears", async () => {
    const queryClient = createQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSharedTeammates(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.installSharedTeammate("shared-1");
    });

    expect(mocks.installSharedTeammate).toHaveBeenCalledWith("shared-1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: capabilityCatalogQueryKey() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TEAMMATES_QUERY_KEYS.all });
  });

  it("leaves the library untouched when the install fails", async () => {
    const queryClient = createQueryClient();

    mocks.installSharedTeammate.mockRejectedValue(new Error("Teammate already installed"));

    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSharedTeammates(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.installSharedTeammate("shared-1")).rejects.toThrow(
        "Teammate already installed",
      );
    });

    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: capabilityCatalogQueryKey() });
  });
});

describe("sharing an owned teammate", () => {
  it("reports the existing listing so the owner can withdraw it", async () => {
    const queryClient = createQueryClient();

    mocks.getSharedTeammateListingForTeammate.mockResolvedValue({
      id: "shared-1",
      name: "Researcher",
      usage_count: 3,
    });

    const { result } = renderHook(() => useTeammateSharing("teammate-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.listing?.id).toBe("shared-1"));

    await act(async () => {
      await result.current.unshareTeammate("shared-1");
    });

    expect(mocks.unshareTeammate).toHaveBeenCalledWith("shared-1");
    await waitFor(() => expect(mocks.getSharedTeammateListingForTeammate).toHaveBeenCalledTimes(2));
  });

  it("does not look up a listing until an teammate is chosen", () => {
    renderHook(() => useTeammateSharing(null), { wrapper: createWrapper(createQueryClient()) });

    expect(mocks.getSharedTeammateListingForTeammate).not.toHaveBeenCalled();
  });
});
