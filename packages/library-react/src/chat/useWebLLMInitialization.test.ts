/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWebLLMConsentStore } from "../state/stores/webLLMConsentStore.js";
import { useWebLLMInitialization } from "./useWebLLMInitialization.js";

const mocks = vi.hoisted(() => ({
  chatState: {
    computeSite: "browser",
    model: "model-a",
    setModel: vi.fn(),
  },
  init: vi.fn(),
  prune: vi.fn(),
  startLoading: vi.fn(),
  updateLoading: vi.fn(),
  stopLoading: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  useChatStore: () => mocks.chatState,
}));
vi.mock("../state/LoadingContext.js", () => ({
  useLoadingActions: () => ({
    startLoading: mocks.startLoading,
    updateLoading: mocks.updateLoading,
    stopLoading: mocks.stopLoading,
  }),
}));
vi.mock("./useWebLLMModels.js", () => ({
  useWebLLMModels: () => ({ "model-a": { provider: "web-llm", name: "Model A" } }),
}));
vi.mock("./web-llm.js", () => ({
  WebLLMService: { getInstance: () => ({ init: mocks.init }) },
  pruneStaleWebLLMModels: mocks.prune,
}));
vi.mock("./web-llm-models.js", () => ({
  getCachedWebLLMModels: () => ({ "model-a": {}, "model-b": {} }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

beforeEach(() => {
  localStorage.clear();
  useWebLLMConsentStore.setState(useWebLLMConsentStore.getInitialState());
  mocks.chatState.computeSite = "browser";
  mocks.chatState.model = "model-a";
  mocks.init.mockReset().mockResolvedValue(undefined);
  mocks.prune.mockReset().mockResolvedValue([]);
  mocks.startLoading.mockReset();
  mocks.updateLoading.mockReset();
  mocks.stopLoading.mockReset();
  mocks.toastError.mockReset();
  mocks.chatState.setModel.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("browser model initialisation consent gate", () => {
  it("does not download without consent and requests confirmation instead", async () => {
    const { result } = renderHook(() => useWebLLMInitialization({}));

    await waitFor(() => expect(useWebLLMConsentStore.getState().pendingModelId).toBe("model-a"));
    expect(mocks.init).not.toHaveBeenCalled();
    expect(result.current.isAwaitingConsent).toBe(true);
  });

  it("starts the download after consent and prunes stale installs", async () => {
    const { result } = renderHook(() => useWebLLMInitialization({}));

    await waitFor(() => expect(useWebLLMConsentStore.getState().pendingModelId).toBe("model-a"));

    act(() => {
      useWebLLMConsentStore.getState().confirmConsent("model-a");
    });

    await waitFor(() => expect(mocks.init).toHaveBeenCalledWith("model-a", expect.any(Function)));
    await waitFor(() =>
      expect(mocks.prune).toHaveBeenCalledWith("model-a", ["model-a", "model-b"]),
    );
    expect(result.current.isAwaitingConsent).toBe(false);
  });

  it("never requests consent on hosted compute", async () => {
    mocks.chatState.computeSite = "hosted";

    renderHook(() => useWebLLMInitialization({}));

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(mocks.init).not.toHaveBeenCalled();
    expect(useWebLLMConsentStore.getState().pendingModelId).toBeNull();
  });
});
