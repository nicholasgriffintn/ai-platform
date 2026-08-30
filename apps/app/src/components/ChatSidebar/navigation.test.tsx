import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSidebar } from ".";

const setCurrentConversationId = vi.fn();
const clearCurrentConversation = vi.fn();
const setShowSearch = vi.fn();

const chatState = {
  currentConversationId: "conversation-1" as string | undefined,
  setCurrentConversationId,
  clearCurrentConversation,
  setShowSearch,
  isAuthenticated: true,
  isAuthenticationLoading: false,
  isPro: true,
  localOnlyMode: false,
};

vi.mock("~/state/stores/chatStore", () => ({
  useChatStore: (selector?: (state: typeof chatState) => unknown) =>
    selector ? selector(chatState) : chatState,
}));

vi.mock("~/state/stores/uiStore", () => ({
  useUIStore: () => ({
    sidebarVisible: true,
    setSidebarVisible: vi.fn(),
    isMobile: false,
    chatConversationListFilters: {
      activity: "all",
      archiveFilter: "active",
      groupBy: "date",
      sortBy: "updated",
    },
    setChatConversationListFilters: vi.fn(),
    resetChatConversationListFilters: vi.fn(),
  }),
}));

vi.mock("~/hooks/useChat", () => ({
  useChats: () => ({
    data: [{ id: "conversation-1", title: "Roadmap chat", updated_at: new Date().toISOString() }],
    total: 1,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useDeleteChat: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateChatTitle: () => ({ mutateAsync: vi.fn() }),
  useSetAllChatsArchived: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("~/hooks/use-track-event", () => ({ useTrackEvent: () => ({ trackEvent: vi.fn() }) }));

vi.mock("../Sidebar/SidebarFooter", () => ({ SidebarFooter: () => null }));

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="*" element={<ChatSidebar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChatSidebar navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns to the conversation when a chat is opened from a capability page", () => {
    renderAt("/chat/capabilities");

    fireEvent.click(screen.getByText("Roadmap chat"));

    expect(setCurrentConversationId).toHaveBeenCalledWith("conversation-1");
    expect(screen.getByTestId("location")).toHaveTextContent("/chat?completion_id=conversation-1");
  });

  it("returns to the conversation when a new chat starts from a capability page", () => {
    renderAt("/chat/experiences");

    fireEvent.click(screen.getByRole("button", { name: /New Chat/i }));

    expect(clearCurrentConversation).toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/chat");
  });

  it("stops marking a conversation active once you leave the conversation", () => {
    renderAt("/chat/capabilities");

    expect(screen.getByText("Roadmap chat").closest("[data-id]")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks the open conversation active while you are on it", () => {
    renderAt("/chat");

    expect(screen.getByText("Roadmap chat").closest("[data-id]")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("stays put when already on the conversation, so the URL is not rewritten", () => {
    renderAt("/");

    fireEvent.click(screen.getByText("Roadmap chat"));

    expect(setCurrentConversationId).toHaveBeenCalledWith("conversation-1");
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });
});
