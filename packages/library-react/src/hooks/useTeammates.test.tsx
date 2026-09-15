// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAPABILITY_CATALOG_QUERY_KEY } from "./useCapabilityCatalog.js";
import { TEAMMATES_QUERY_KEYS, useTeammates } from "./useTeammates.js";

const mocks = vi.hoisted(() => ({
  createTeammate: vi.fn(),
  listTeammates: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-library-client", () => ({ apiService: mocks }));

vi.mock("./useCanAccessProFeatures.js", () => ({
  useCanAccessProFeatures: () => true,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("creating a teammate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTeammates.mockResolvedValue([]);
    mocks.createTeammate.mockResolvedValue({ id: "teammate-1", name: "Researcher" });
  });

  it("refreshes the capability catalogue so the new teammate appears in the library", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useTeammates(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.createTeammate({ name: "Researcher" });
    });

    expect(mocks.createTeammate).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: CAPABILITY_CATALOG_QUERY_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TEAMMATES_QUERY_KEYS.all });
  });
});
