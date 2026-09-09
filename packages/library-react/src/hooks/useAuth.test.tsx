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
    hasApiKey: false,
    user,
    userSettings: {},
    setIsAuthenticationLoading: vi.fn(),
    setAuthenticatedUserConfiguration: vi.fn(),
    clearAuthenticatedUserConfiguration: vi.fn(),
    setHasApiKey: vi.fn(),
    setUserSettings: vi.fn(),
  };

  return { state, check: vi.fn(), getUser: vi.fn(), getToken: vi.fn() };
});

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  useChatStore: Object.assign(() => mocks.state, { getState: () => mocks.state }),
  authService: {
    checkAuthStatus: mocks.check,
    getUser: mocks.getUser,
    getToken: mocks.getToken,
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
  mocks.getToken.mockResolvedValue("test-token");
  useUsageStore.getState().setUsageLimits(balance);
});

afterEach(() => {
  cleanup();
  client.clear();
  useUsageStore.getState().setUsageLimits(null);
});

describe("credit balance across authentication refresh", () => {
  it("resolves the session before the bearer token arrives", async () => {
    let releaseToken: (token: string) => void = () => {};

    mocks.getToken.mockReturnValue(
      new Promise<string>((resolve) => {
        releaseToken = resolve;
      }),
    );

    renderHook(() => useAuthStatus(), { wrapper: createWrapper(client) });

    await waitFor(() => expect(mocks.state.setIsAuthenticationLoading).toHaveBeenCalledWith(false));
    expect(mocks.state.setAuthenticatedUserConfiguration).toHaveBeenCalledOnce();
    expect(mocks.state.setHasApiKey).not.toHaveBeenCalled();

    releaseToken("test-token");

    await waitFor(() => expect(mocks.state.setHasApiKey).toHaveBeenCalledWith(true));
  });

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
