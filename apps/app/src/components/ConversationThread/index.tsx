import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "~/styles/scrollbar.css";
import "~/styles/github.css";
import "~/styles/github-dark.css";
import { useAutoscroll } from "~/hooks/useAutoscroll";
import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import { useModels } from "~/hooks/useModels";
import { useError } from "~/state/contexts/ErrorContext";
import { useIsLoading } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { ArtifactProps } from "~/types/artifact";
import { ArtifactPanel } from "./Artifacts/ArtifactPanel";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { FooterInfo } from "./FooterInfo";
import { MessageList } from "./MessageList";
import { ScrollButton } from "./ScrollButton";
import { WelcomeScreen } from "./WelcomeScreen";

export const ConversationThread = () => {
  const { currentConversationId, model } = useChatStore();
  const { data: currentConversation } = useChat(currentConversationId);
  const { streamStarted, controller, sendMessage, abortStream } =
    useChatManager();
  const { addError } = useError();
  const { data: apiModels } = useModels();

  const [input, setInput] = useState<string>("");
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactProps | null>(
    null,
  );
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [currentArtifacts, setCurrentArtifacts] = useState<ArtifactProps[]>([]);
  const [isCombinedPanel, setIsCombinedPanel] = useState(false);

  const isStreamLoading = useIsLoading("stream-response");
  const isModelInitializing = useIsLoading("model-init");

  const messages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation?.messages],
  );

  const {
    messagesEndRef,
    messagesContainerRef,
    forceScrollToBottom,
    showScrollButton,
  } = useAutoscroll({
    dependency: currentConversationId,
  });

  const chatInputRef = useRef<ChatInputHandle>(null);

  const handleArtifactOpen = (
    artifact: ArtifactProps,
    combine?: boolean,
    artifacts?: ArtifactProps[],
  ) => {
    setCurrentArtifact(artifact);
    setIsPanelVisible(true);

    if (combine && artifacts && artifacts.length > 1) {
      setCurrentArtifacts(artifacts);
      setIsCombinedPanel(true);
      return;
    }
  };

  const handlePanelClose = useCallback(() => {
    setIsPanelVisible(false);
    setIsCombinedPanel(false);

    setTimeout(() => {
      setCurrentArtifact(null);
      setCurrentArtifacts([]);
    }, 300);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: This is intentional
  useEffect(() => {
    if (isPanelVisible) {
      handlePanelClose();
    }
  }, [currentConversationId]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (input.trim() && !isStreamLoading && !isModelInitializing) {
          handleSubmit(e as unknown as FormEvent);
        }
      }
      if (e.key === "Escape") {
        if (isPanelVisible) {
          handlePanelClose();
        } else if (controller) {
          abortStream();
          setTimeout(() => {
            chatInputRef.current?.focus();
          }, 0);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [
    input,
    isStreamLoading,
    isModelInitializing,
    controller,
    abortStream,
    isPanelVisible,
    handlePanelClose,
  ]);

  const handleSubmit = async (
    e: FormEvent,
    attachmentData?: { type: string; data: string; name?: string },
  ) => {
    e.preventDefault();
    if (!input.trim() && !attachmentData) {
      return;
    }

    // For text-to-image models, only allow the first message
    const isTextToImageModel =
      apiModels?.[model]?.type?.includes("text-to-image");
    if (isTextToImageModel && messages.length > 0) {
      addError(
        "Text-to-image models only support one message per conversation. Please start a new conversation.",
        "error",
      );
      return;
    }

    try {
      const originalInput = input;
      setInput("");

      const result = await sendMessage(input, attachmentData);
      if (result?.status === "error") {
        setInput(originalInput);
      } else {
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 0);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleTranscribe = async (data: {
    response: {
      content: string;
    };
  }) => {
    setInput(data.response.content);
  };

  const handleToolInteraction = (
    toolName: string,
    action: "useAsPrompt",
    data: Record<string, any>,
  ) => {
    switch (toolName) {
      case "web_search":
        if (action === "useAsPrompt") {
          setInput(data.question);
        }
        break;
      default:
        break;
    }
  };

  const showWelcomeScreen =
    messages.length === 0 &&
    !currentConversationId &&
    !isStreamLoading &&
    !streamStarted;

  return (
    <div
      className={`flex flex-col h-[calc(100%-3rem)] w-full ${isPanelVisible ? "pr-[90%] sm:pr-[350px] md:pr-[400px] lg:pr-[650px]" : ""}`}
    >
      <div
        ref={messagesContainerRef}
        className={`relative flex-1 overflow-x-hidden ${showWelcomeScreen ? "flex items-center" : "overflow-y-scroll"}`}
      >
        <div className="mx-auto flex w-full max-w-3xl grow flex-col gap-8 px-4 py-8">
          {showWelcomeScreen ? (
            <WelcomeScreen setInput={setInput} />
          ) : (
            <MessageList
              messagesEndRef={messagesEndRef}
              onToolInteraction={handleToolInteraction}
              onArtifactOpen={handleArtifactOpen}
            />
          )}
        </div>

        {showScrollButton && currentConversationId && (
          <ScrollButton onClick={forceScrollToBottom} />
        )}
      </div>

      <div className="px-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            ref={chatInputRef}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isStreamLoading || isModelInitializing}
            streamStarted={streamStarted}
            controller={controller}
            onTranscribe={handleTranscribe}
          />
        </div>
      </div>

      <FooterInfo isPanelVisible={isPanelVisible} />

      <ArtifactPanel
        artifact={currentArtifact}
        artifacts={currentArtifacts}
        onClose={handlePanelClose}
        isVisible={isPanelVisible}
        isCombined={isCombinedPanel}
      />
    </div>
  );
};
