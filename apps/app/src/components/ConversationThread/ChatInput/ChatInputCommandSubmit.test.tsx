import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";

import { ChatInput } from ".";

const assistantActionCatalogMock = vi.hoisted(() => vi.fn());

vi.mock("~/hooks/useAgentToolDefaults", () => ({
  useAgentToolDefaults: () => undefined,
}));

vi.mock("~/hooks/useAgents", () => ({
  useAgents: () => ({
    chatAgents: [],
    isLoadingAgents: false,
  }),
}));

vi.mock("~/hooks/useAssistantActionCatalog", () => ({
  useAssistantActionCatalog: assistantActionCatalogMock,
}));

vi.mock("~/hooks/useModels", () => ({
  useModels: () => ({
    data: {
      "deepseek-v4-pro": {
        id: "deepseek-v4-pro",
        matchingModel: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        provider: "deepseek",
        supportsToolCalls: false,
      },
    },
  }),
}));

vi.mock("~/hooks/useModelTools", () => ({
  useModelToolOptions: () => [],
}));

vi.mock("~/hooks/useVoiceRecorder", () => ({
  useVoiceRecorder: () => ({
    isRecording: false,
    isTranscribing: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
  useWebLLMModels: () => ({}),
}));

vi.mock("~/state/stores/toolsStore", () => ({
  useToolsStore: (
    selector: (state: { selectedTools: string[]; setSelectedTools: () => void }) => unknown,
  ) =>
    selector({
      selectedTools: [],
      setSelectedTools: vi.fn(),
    }),
}));

vi.mock("~/state/stores/uiStore", () => ({
  useUIStore: () => ({ isMobile: false }),
}));

vi.mock("./useComposerSources", () => ({
  useComposerSources: () => ({
    attachments: [],
    attachingSourceId: null,
    attachSource: vi.fn(),
    availableSources: [],
    clearAttachments: vi.fn(),
    isLoading: false,
    removeAttachment: vi.fn(),
  }),
}));

function setTextSelection(element: HTMLElement, offset: number) {
  const textNode = element.firstChild;

  if (!textNode) {
    throw new Error("Expected editable text content");
  }

  const range = document.createRange();

  range.setStart(textNode, offset);
  range.collapse(true);

  const selection = window.getSelection();

  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("ChatInput command submission", () => {
  beforeEach(() => {
    assistantActionCatalogMock.mockReturnValue({ verbs: [], items: [] });
    useChatStore.setState({
      chatInput: "/compact",
      chatMode: "remote",
      currentConversationId: "conversation-1",
      isAuthenticationLoading: false,
      isPro: true,
      model: "deepseek-v4-pro",
      selectedAgentId: null,
      selectedAgentTokenPosition: null,
      selectedAssistantAction: null,
    });
  });

  it("submits /compact on Enter even when cursor state still points at a partial command", () => {
    const handleSubmit = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ChatInput
          controller={new AbortController()}
          handleSubmit={handleSubmit}
          isLoading={false}
          onTranscribe={vi.fn()}
          streamStarted={false}
          hideDefaultControls
        />
      </QueryClientProvider>,
    );

    const input = screen.getByRole("textbox", { name: "Message input" });

    setTextSelection(input, 4);
    fireEvent.keyUp(input);
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("inserts a selected skill slash command as an action token on Enter", () => {
    assistantActionCatalogMock.mockReturnValue({
      verbs: [],
      items: [
        {
          id: "skill:artifacts",
          kind: "skill",
          label: "Artifacts",
          description: "Create reusable deliverables.",
          searchText: ["Artifacts"],
          capability: { id: "artifacts" },
          launch: { kind: "tool_toggle", toolId: "load_skill" },
        },
      ],
    });
    useChatStore.setState({ chatInput: "/artifacts" });
    const handleSubmit = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ChatInput
          controller={new AbortController()}
          handleSubmit={handleSubmit}
          isLoading={false}
          onTranscribe={vi.fn()}
          streamStarted={false}
          hideDefaultControls
        />
      </QueryClientProvider>,
    );

    const input = screen.getByRole("textbox", { name: "Message input" });

    setTextSelection(input, 10);
    fireEvent.keyUp(input);
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("composer-token-part")).toHaveTextContent("/artifacts");
    expect(useChatStore.getState().selectedAssistantAction?.item?.id).toBe("skill:artifacts");
    expect(useChatStore.getState().selectedAssistantAction?.tokenText).toBe("/artifacts");
  });
});
