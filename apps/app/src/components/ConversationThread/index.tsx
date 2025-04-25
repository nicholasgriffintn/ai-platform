import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import "~/styles/scrollbar.css";
import "~/styles/github.css";
import "~/styles/github-dark.css";
import { UsageLimitWarning } from "~/components/UsageLimitWarning";
import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import { useModels } from "~/hooks/useModels";
import { useIsLoading } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { ArtifactProps } from "~/types/artifact";
import { ArtifactPanel } from "./Artifacts/ArtifactPanel";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { FooterInfo } from "./FooterInfo";
import { MessageList } from "./MessageList";
import { WelcomeScreen } from "./WelcomeScreen";

export const ConversationThread = () => {
  const { currentConversationId, model, chatInput, setChatInput } =
    useChatStore();
  const { data: currentConversation } = useChat(currentConversationId);
  const { streamStarted, controller, sendMessage, abortStream } =
    useChatManager();
  const { data: apiModels } = useModels();

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

  const canSubmit = useMemo(
    () => chatInput.trim() && !isStreamLoading && !isModelInitializing,
    [chatInput, isStreamLoading, isModelInitializing],
  );

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (isStreamLoading || isModelInitializing) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canSubmit) {
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
    },
    [
      canSubmit,
      controller,
      abortStream,
      isPanelVisible,
      handlePanelClose,
      isStreamLoading,
      isModelInitializing,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  const handleSubmit = async (
    e: FormEvent,
    attachmentData?: { type: string; data: string; name?: string },
  ) => {
    e.preventDefault();
    if (!chatInput.trim() && !attachmentData) {
      return;
    }

    // For text-to-image models, only allow the first message
    const isTextToImageModel =
      model !== null && apiModels?.[model]?.type?.includes("text-to-image");
    if (isTextToImageModel && messages.length > 0) {
      toast.error(
        "Text-to-image models only support one message per conversation. Please start a new conversation.",
      );
      return;
    }

    try {
      const originalInput = chatInput;
      setChatInput("");

      const result = await sendMessage(chatInput, attachmentData);
      if (result?.status === "error") {
        setChatInput(originalInput);
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
    setChatInput(data.response.content);
  };

  const handleToolInteraction = (
    toolName: string,
    action: "useAsPrompt",
    data: Record<string, any>,
  ) => {
    switch (toolName) {
      case "web_search":
        if (action === "useAsPrompt") {
          setChatInput(data.question);
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
      {showWelcomeScreen ? (
        <div className="flex-1 flex items-center justify-center">
          <WelcomeScreen setInput={setChatInput} />
        </div>
      ) : (
        <div className="flex-1 px-4">
          <div className="mx-auto w-full max-w-3xl h-full flex flex-col gap-8">
            <MessageList
              messages={messages}
              onToolInteraction={handleToolInteraction}
              onArtifactOpen={handleArtifactOpen}
            />
          </div>
        </div>
      )}

      <div className="px-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <UsageLimitWarning />
          <ChatInput
            ref={chatInputRef}
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
