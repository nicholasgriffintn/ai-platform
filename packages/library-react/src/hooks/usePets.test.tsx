// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActivePet } from "./usePets.js";

const mocks = vi.hoisted(() => ({
  useAuthStatus: vi.fn(),
  fetchUserPets: vi.fn(),
}));

vi.mock("./useAuth.js", () => ({
  useAuthStatus: mocks.useAuthStatus,
}));

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  createUserPet: vi.fn(),
  deleteUserPet: vi.fn(),
  fetchUserPet: vi.fn(),
  fetchUserPets: mocks.fetchUserPets,
  generatePetImage: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useActivePet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchUserPets.mockResolvedValue({ pets: [], page: 1, has_more: false });
  });

  it("uses Pip for signed-out temporary conversations", () => {
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      userSettings: null,
      refreshAuthStatus: vi.fn(),
    });

    const { result } = renderHook(() => useActivePet(undefined, true, "temporary"), {
      wrapper: createWrapper(),
    });

    expect(result.current).toMatchObject({
      source: "preset",
      id: "pip",
      name: "Pip",
      isReady: true,
    });
  });

  it("keeps Wisp for signed-in temporary conversations", async () => {
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      userSettings: null,
      refreshAuthStatus: vi.fn(),
    });

    const { result } = renderHook(() => useActivePet(undefined, true, "temporary"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current).toMatchObject({ source: "preset", id: "wisp", name: "Wisp" });
  });
});
