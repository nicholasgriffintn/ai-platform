import type { LastModelSelection } from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLastModelSelection } from "./useLastModelSelection.js";

const mocks = vi.hoisted(() => {
  const userSettings: { last_model_selection: LastModelSelection | null } = {
    last_model_selection: null,
  };
  const state = { user: { id: 42 }, userSettings, setUserSettings: vi.fn() };

  return { state, update: vi.fn(), toast: vi.fn() };
});

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
    { getState: () => mocks.state },
  ),
  authService: {
    updateUserSettings: mocks.update,
    getUserSettings: () => mocks.state.userSettings,
  },
  getNotificationInstallationId: () => "installation",
}));
vi.mock("../hooks/useAuth.js", () => ({ AUTH_QUERY_KEYS: { authStatus: ["auth", "status"] } }));
vi.mock("sonner", () => ({ toast: { error: mocks.toast } }));

const selection: LastModelSelection = {
  modelId: "model",
  name: "Model",
  computeSite: "hosted",
  locationLabel: "Cloud",
};
const client = new QueryClient({
  defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  mocks.state.user.id = 42;
  mocks.state.userSettings.last_model_selection = null;
  mocks.update.mockReset();
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("last-used model synchronisation", () => {
  it("retains the local choice and reports a failed account save", async () => {
    mocks.update.mockResolvedValue(false);
    const { result } = renderHook(useLastModelSelection, { wrapper });

    act(() => result.current.remember(selection));
    await waitFor(() => expect(result.current.syncError).toContain("could not sync"));
    expect(result.current.selection).toEqual(selection);
    expect(mocks.toast).toHaveBeenCalled();
  });
  it("saves local device provenance and keeps another account's shortcut separate", async () => {
    mocks.update.mockResolvedValue(true);
    const { result, rerender } = renderHook(useLastModelSelection, { wrapper });

    act(() => result.current.remember({ ...selection, computeSite: "device" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        last_model_selection: {
          ...selection,
          computeSite: "device",
          originInstallationId: "installation",
        },
      }),
    );
    mocks.state.user.id = 99;
    rerender();
    expect(result.current.selection).toBeNull();
  });
});
