// @vitest-environment jsdom

import { setDeviceModelSource } from "@ngriffin_uk/polychat-library-chat";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeviceModels } from "./useDeviceModels.js";
import { useModels } from "./useModels.js";

const mocks = vi.hoisted(() => ({
  fetchModels: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  apiService: {
    fetchModels: mocks.fetchModels,
  },
  useChatStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}));

function model(matchingModel: string, provider: string) {
  return { matchingModel, provider };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("device model queries", () => {
  beforeEach(() => {
    mocks.fetchModels.mockResolvedValue({ hosted: model("hosted-model", "hosted") });
  });

  afterEach(() => {
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
