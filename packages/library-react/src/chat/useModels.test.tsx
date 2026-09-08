import { setDeviceModelSource } from "@ngriffin_uk/polychat-library-chat";
// @vitest-environment jsdom
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { focusManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useMemo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createQueryClient,
  createWrapper,
  clearQueryClients,
} from "../lib/testing/query-client.js";
import { useDeviceModels } from "./useDeviceModels.js";
import { useModels } from "./useModels.js";

const mocks = vi.hoisted(() => ({
  fetchModels: vi.fn(),
  fetchMachines: vi.fn().mockResolvedValue([]),
}));

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  apiService: {
    fetchModels: mocks.fetchModels,
    fetchMachines: mocks.fetchMachines,
  },
  useChatStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
  useSyncStore: { getState: () => ({ status: "idle" }) },
}));

function model(matchingModel: string, provider: string) {
  return { matchingModel, provider };
}

describe("device model queries", () => {
  beforeEach(() => {
    mocks.fetchModels.mockResolvedValue({ hosted: model("hosted-model", "hosted") });
  });

  afterEach(() => {
    cleanup();
    clearQueryClients();
    setDeviceModelSource(null);
    focusManager.setFocused(undefined);
    vi.clearAllMocks();
  });

  it("merges hosted and device models while keeping separate query data", async () => {
    const deviceModels: ModelConfig = {
      device: model("device-model", "ollama"),
    };
    const source = vi.fn().mockResolvedValue(deviceModels);

    setDeviceModelSource(source);

    const queryClient = createQueryClient();

    const { result } = renderHook(() => useModels(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() =>
      expect(result.current.data).toEqual({
        hosted: model("hosted-model", "hosted"),
        device: model("device-model", "ollama"),
      }),
    );

    expect(queryClient.getQueryData(["models"])).toEqual({
      hosted: model("hosted-model", "hosted"),
    });
    expect(queryClient.getQueryData(["device-models"])).toEqual(deviceModels);
  });

  it("does not rebuild the selector catalogue on unrelated renders but updates when discovery changes", async () => {
    setDeviceModelSource(async () => ({}));
    const queryClient = createQueryClient();
    const rebuild = vi.fn((models: ModelConfig | undefined) => Object.keys(models ?? {}));
    const { result, rerender } = renderHook(
      () => {
        const { data } = useModels();

        return useMemo(() => rebuild(data), [data]);
      },
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current).toContain("hosted"));
    const initialBuilds = rebuild.mock.calls.length;

    for (let index = 0; index < 10; index += 1) {
      rerender();
    }

    expect(rebuild.mock.calls.length - initialBuilds).toBe(0);

    act(() => {
      queryClient.setQueryData(["device-models"], {
        local: { matchingModel: "local", provider: "ollama" },
      });
    });
    await waitFor(() => expect(result.current).toContain("local"));
  });

  it("does not rediscover device models when the window regains focus", async () => {
    const source = vi.fn().mockResolvedValue({ device: model("device-model", "ollama") });

    setDeviceModelSource(source);

    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDeviceModels(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(source).toHaveBeenCalledTimes(1);

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(source).toHaveBeenCalledTimes(1);
  });
});
