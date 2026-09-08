import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient, createWrapper } from "../lib/testing/query-client.js";
import { useUsageStore } from "../state/usageStore.js";
import { useAuthStatus } from "./useAuth.js";

const mocks = vi.hoisted(() => {
  const user: { id: number } | undefined = { id: 42 };
  const state = {
    isAuthenticated: true,
    isAuthenticationLoading: false,
    user,
    userSettings: {},
    setIsAuthenticationLoading: vi.fn(),
    setAuthenticatedUserConfiguration: vi.fn(),
    clearAuthenticatedUserConfiguration: vi.fn(),
    setUserSettings: vi.fn(),
  };

  return { state, check: vi.fn(), getUser: vi.fn() };
});

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  useChatStore: Object.assign(() => mocks.state, { getState: () => mocks.state }),
  authService: {
    checkAuthStatus: mocks.check,
    getUser: mocks.getUser,
    getToken: async () => "test-token",
    getUserSettings: () => ({}),
  },
}));

const client = createQueryClient();
const balance = {
  credits: {
    included: 1500,
    used: 1510,
    reserved: 0,
    grace: 150,
    overrun: 0,
    overage: 0,
    overage_enabled: false,
    state: "reserve" as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.check.mockResolvedValue(true);
  mocks.getUser.mockReturnValue({ id: 42 });
  useUsageStore.getState().setUsageLimits(balance);
});

afterEach(() => {
  cleanup();
  client.clear();
  useUsageStore.getState().setUsageLimits(null);
});

describe("credit balance across authentication refresh", () => {
  it("keeps the streamed balance when the same account refreshes its settings", async () => {
    renderHook(useAuthStatus, { wrapper: createWrapper(client) });
    await waitFor(() => expect(mocks.state.setIsAuthenticationLoading).toHaveBeenCalledWith(false));
    expect(useUsageStore.getState().usageLimits).toEqual(balance);
  });

  it.each(["another account", "signed out"])(
    "clears the previous balance for %s",
    async (identity) => {
      mocks.check.mockResolvedValue(identity !== "signed out");
      mocks.getUser.mockReturnValue(identity === "signed out" ? undefined : { id: 99 });
      renderHook(useAuthStatus, { wrapper: createWrapper(client) });
      await waitFor(() =>
        expect(mocks.state.setIsAuthenticationLoading).toHaveBeenCalledWith(false),
      );
      expect(useUsageStore.getState().usageLimits).toBeNull();
    },
  );
});
