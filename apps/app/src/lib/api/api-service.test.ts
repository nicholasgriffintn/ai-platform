import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import type { Message } from "~/types";

import { apiService } from "./api-service";
import { ChatService } from "./services/chat-service";

describe("ApiService chat tool selection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useChatStore.setState({ isAuthenticated: false, isPro: false });
    useToolsStore.setState({ selectedTools: [] });
  });

  it("forwards selected tools when the client entitlement state is stale", async () => {
    useChatStore.setState({ isAuthenticated: true, isPro: false });
    useToolsStore.setState({ selectedTools: ["load_skill", "code_execution", "tool_search"] });
    const response = { role: "assistant", content: "done" } as Message;
    const stream = vi
      .spyOn(ChatService.prototype, "streamChatCompletions")
      .mockResolvedValue(response);

    await apiService.streamChatCompletions({
      chatSettings: {},
      completionId: "conversation-1",
      messages: [{ role: "user", content: "Run this code." } as Message],
      mode: "remote",
      model: "gpt-5.6-luna",
      onProgress: () => {},
      onStateChange: () => {},
      signal: new AbortController().signal,
    });

    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        allowTools: true,
        selectedTools: ["load_skill", "code_execution", "tool_search"],
      }),
    );
  });

  it("does not forward persisted tool selections for an anonymous request", async () => {
    useChatStore.setState({ isAuthenticated: false, isPro: false });
    useToolsStore.setState({ selectedTools: ["code_execution"] });
    const stream = vi
      .spyOn(ChatService.prototype, "streamChatCompletions")
      .mockResolvedValue({ role: "assistant", content: "done" } as Message);

    await apiService.streamChatCompletions({
      chatSettings: {},
      completionId: "conversation-1",
      messages: [{ role: "user", content: "Hello." } as Message],
      mode: "remote",
      model: "gpt-5.6-luna",
      onProgress: () => {},
      onStateChange: () => {},
      signal: new AbortController().signal,
    });

    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        allowTools: false,
        selectedTools: ["code_execution"],
      }),
    );
  });
});
