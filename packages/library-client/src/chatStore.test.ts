// @vitest-environment jsdom

import { beforeEach, expect, it, vi } from "vitest";

import { apiKeyService } from "./api-key.js";
import { useChatStore } from "./chatStore.js";

vi.mock("./api-key.js", () => ({
  apiKeyService: { getApiKey: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  useChatStore.setState(useChatStore.getInitialState());
});

it("restores the route before authentication finishes and never overwrites a later selection", async () => {
  let finishKeyLookup: (key: string | null) => void = () => {};

  vi.mocked(apiKeyService.getApiKey).mockReturnValue(
    new Promise((resolve) => {
      finishKeyLookup = resolve;
    }),
  );
  useChatStore.setState({ isAuthenticationLoading: true });

  const initialization = useChatStore.getState().initializeStore("restored-conversation");

  expect(useChatStore.getState().currentConversationId).toBe("restored-conversation");
  useChatStore.getState().setCurrentConversationId("next-conversation");
  useChatStore.setState({ isAuthenticationLoading: false, isAuthenticated: true });
  finishKeyLookup(null);
  await initialization;

  expect(useChatStore.getState().currentConversationId).toBe("next-conversation");
});

it("keeps the composer selection when a new conversation has no stored selection yet", () => {
  const store = useChatStore.getState();

  store.setModel("picked-model");

  const conversationId = store.startNewConversation();

  store.setConversationModelSelection(conversationId, {});

  expect(useChatStore.getState().model).toBe("picked-model");
});

it("does not let conversation data overwrite a model picked for that conversation", () => {
  const store = useChatStore.getState();

  store.setCurrentConversationId("open-conversation");
  store.setConversationModelSelection("open-conversation", { model: null, modelTier: null });
  store.setModel("picked-model");
  store.setConversationModelSelection("open-conversation", { model: null, modelTier: null });

  expect(useChatStore.getState().model).toBe("picked-model");
});

it("adopts newer stored selections until a model is picked for the conversation", () => {
  const store = useChatStore.getState();

  store.setCurrentConversationId("open-conversation");
  store.setConversationModelSelection("open-conversation", { model: "cached-model" });
  store.setConversationModelSelection("open-conversation", { model: "stored-model" });

  expect(useChatStore.getState().model).toBe("stored-model");
});

it("adopts the stored selection when opening a conversation after a composer pick", () => {
  const store = useChatStore.getState();

  store.setModel("picked-model");
  store.startNewConversation("first-conversation");
  store.setCurrentConversationId("second-conversation");
  store.setConversationModelSelection("second-conversation", { model: null, modelTier: "high" });

  expect(useChatStore.getState()).toMatchObject({ model: null, modelTier: "high" });
});

it("restores account defaults on leaving a conversation and keeps them through the first send", () => {
  const store = useChatStore.getState();

  store.setUserSettings({
    id: "settings",
    nickname: "",
    job_role: "",
    location: "",
    traits: "",
    preferences: "",
    default_model_id: "account-model",
  });

  store.setCurrentConversationId("open-conversation");
  store.setConversationModelSelection("open-conversation", {
    model: "conversation-model",
    permissionMode: "supervised",
  });
  store.clearCurrentConversation();

  expect(useChatStore.getState()).toMatchObject({
    model: "account-model",
    modelSelectionOrigin: "account",
    permissionMode: "auto_accept_edits",
  });

  useChatStore.getState().setModel("picked-model");
  useChatStore.getState().startNewConversation();

  expect(useChatStore.getState().model).toBe("picked-model");
});

it("keeps a composer pick when leaving a conversation", () => {
  const store = useChatStore.getState();

  store.setCurrentConversationId("open-conversation");
  store.setConversationModelSelection("open-conversation", { model: "conversation-model" });
  store.setModel("picked-model");
  store.clearCurrentConversation();

  expect(useChatStore.getState().model).toBe("picked-model");
});
