import { apiService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { localChatService } from "@ngriffin_uk/polychat-library-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { useChat } from "./useChat";

vi.mock("@ngriffin_uk/polychat-library-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-client")>()),
  apiService: { getChat: vi.fn() },
}));

vi.mock("@ngriffin_uk/polychat-library-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-react")>()),
  localChatService: { getLocalChat: vi.fn() },
}));

it("waits for account resolution before loading an existing conversation", async () => {
  const conversation = {
    id: "restored-chat",
    title: "Saved conversation",
    messages: [{ id: "saved-message", role: "user" as const, content: "Keep this earlier turn" }],
    active_operation: null,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  useChatStore.setState(useChatStore.getInitialState());
  vi.mocked(localChatService.getLocalChat).mockResolvedValue(null);
  vi.mocked(apiService.getChat).mockResolvedValue(conversation);
  const { result, unmount } = renderHook(() => useChat(conversation.id), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  expect(localChatService.getLocalChat).not.toHaveBeenCalled();
  expect(apiService.getChat).not.toHaveBeenCalled();
  await act(async () => {
    useChatStore.setState({
      isAuthenticationLoading: false,
      isAuthenticated: true,
      isPro: true,
    });
  });
  await waitFor(() => expect(result.current.data?.messages).toEqual(conversation.messages));
  expect(apiService.getChat).toHaveBeenCalledWith(conversation.id, { refreshPending: true });

  unmount();
  queryClient.clear();
});
