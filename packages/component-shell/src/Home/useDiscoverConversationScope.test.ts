import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDiscoverConversationScope } from "./useDiscoverConversationScope.js";

describe("useDiscoverConversationScope", () => {
  beforeEach(() => {
    useChatStore.getState().clearCurrentConversation();
  });

  it("ignores a conversation left over from the previous page", () => {
    useChatStore.getState().setCurrentConversationId("previous");

    const { result } = renderHook(() => useDiscoverConversationScope());

    expect(result.current.currentConversationId).toBeUndefined();
    expect(result.current.getCurrentConversationId()).toBeUndefined();
  });

  it("does not open a conversation selected elsewhere while the route changes", () => {
    const { result } = renderHook(() => useDiscoverConversationScope());

    act(() => useChatStore.getState().setCurrentConversationId("from-sidebar"));

    expect(result.current.currentConversationId).toBeUndefined();
  });

  it("keeps its own conversation open when another is selected elsewhere", () => {
    const { result } = renderHook(() => useDiscoverConversationScope());

    act(() => {
      result.current.startNewConversation("started-here");
    });
    act(() => useChatStore.getState().setCurrentConversationId("from-sidebar"));

    expect(result.current.currentConversationId).toBe("started-here");
  });

  it("closes its conversation when the shared conversation is cleared", () => {
    const { result } = renderHook(() => useDiscoverConversationScope());

    act(() => {
      result.current.startNewConversation("started-here");
    });
    act(() => useChatStore.getState().clearCurrentConversation());

    expect(result.current.currentConversationId).toBeUndefined();
    expect(result.current.getCurrentConversationId()).toBeUndefined();
  });
});
