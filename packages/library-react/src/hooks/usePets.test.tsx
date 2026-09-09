// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient, createWrapper } from "../lib/testing/query-client.js";
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

describe("useActivePet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchUserPets.mockResolvedValue({ pets: [], page: 1, has_more: false });
  });

  it("ignores retained account pets for signed-out temporary conversations", () => {
    mocks.useAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      userSettings: { pet_source: "custom", pet_id: "private-account-pet" },
      refreshAuthStatus: vi.fn(),
    });

    const { result } = renderHook(() => useActivePet(undefined, true, "temporary"), {
      wrapper: createWrapper(createQueryClient()),
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
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current).toMatchObject({ source: "preset", id: "wisp", name: "Wisp" });
  });
  it("drops an account preset immediately on sign-out and after remounting", async () => {
    const auth = {
      isAuthenticated: true,
      isLoading: false,
      userSettings: { pet_source: "preset", pet_id: "ash" },
      refreshAuthStatus: vi.fn(),
    };

    mocks.useAuthStatus.mockReturnValue(auth);
    const wrapper = createWrapper(createQueryClient());
    const { result, rerender, unmount } = renderHook(() => useActivePet(), { wrapper });

    await waitFor(() => expect(result.current.id).toBe("ash"));
    mocks.useAuthStatus.mockReturnValue({ ...auth, isAuthenticated: false });
    rerender();
    expect(result.current).toMatchObject({ id: "pip", isReady: true });
    unmount();
    const reopened = renderHook(() => useActivePet(), { wrapper });

    expect(reopened.result.current).toMatchObject({ id: "pip", isReady: true });
  });
});
