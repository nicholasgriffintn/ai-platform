// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { useWebLLMConsentStore } from "./webLLMConsentStore.js";

beforeEach(() => {
  localStorage.clear();
  useWebLLMConsentStore.setState(useWebLLMConsentStore.getInitialState());
});

describe("browser model download consent", () => {
  it("starts with no consent and no pending request", () => {
    const state = useWebLLMConsentStore.getState();

    expect(state.hasConsented("model-a")).toBe(false);
    expect(state.pendingModelId).toBeNull();
  });

  it("requests consent and confirms it for the pending model", () => {
    useWebLLMConsentStore.getState().requestConsent("model-a");
    expect(useWebLLMConsentStore.getState().pendingModelId).toBe("model-a");

    useWebLLMConsentStore.getState().confirmConsent("model-a");

    const state = useWebLLMConsentStore.getState();

    expect(state.hasConsented("model-a")).toBe(true);
    expect(state.pendingModelId).toBeNull();
  });

  it("does not re-request consent for an already consented model", () => {
    useWebLLMConsentStore.getState().confirmConsent("model-a");
    useWebLLMConsentStore.getState().requestConsent("model-a");

    expect(useWebLLMConsentStore.getState().pendingModelId).toBeNull();
  });

  it("cancelling clears the pending request without granting consent", () => {
    useWebLLMConsentStore.getState().requestConsent("model-a");
    useWebLLMConsentStore.getState().cancelConsent();

    const state = useWebLLMConsentStore.getState();

    expect(state.pendingModelId).toBeNull();
    expect(state.hasConsented("model-a")).toBe(false);
  });

  it("tracks consent per model", () => {
    useWebLLMConsentStore.getState().confirmConsent("model-a");

    expect(useWebLLMConsentStore.getState().hasConsented("model-a")).toBe(true);
    expect(useWebLLMConsentStore.getState().hasConsented("model-b")).toBe(false);
  });
});
