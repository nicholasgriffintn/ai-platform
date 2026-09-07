// @vitest-environment jsdom

import { beforeEach, expect, it, vi } from "vitest";

import { apiKeyService } from "./api-key";
import { useChatStore } from "./chatStore";

vi.mock("./api-key", () => ({
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
