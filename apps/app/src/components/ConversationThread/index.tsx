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
import { UsageLimitWarning } from "~/components/ConversationThread/UsageLimitWarning";
import { EventCategory, useTrackEvent } from "~/hooks/use-track-event";
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
  const { trackEvent, trackFeatureUsage, trackError } = useTrackEvent();

  const { currentConversationId, model, chatInput, setChatInput } =
    useChatStore();
  const { data: currentConversation } = useChat(currentConversationId);
  const {
    streamStarted,
    controller,
    sendMessage,
    abortStream,
    branchConversation,
    isBranching,
  } = useChatManager();
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

  const handleArtifactOpen = useCallback(
    (
      artifact: ArtifactProps,
      combine?: boolean,
      artifacts?: ArtifactProps[],
    ) => {
      setCurrentArtifact(artifact);
      setIsPanelVisible(true);

      trackFeatureUsage("view_artifact", {
        artifact_type: artifact.type,
        conversation_id: currentConversationId || "none",
        combined_view: Boolean(combine && artifacts && artifacts.length > 1),
      });

      if (combine && artifacts && artifacts.length > 1) {
        setCurrentArtifacts(artifacts);
        setIsCombinedPanel(true);
        return;
      }
    },
    [currentConversationId, trackFeatureUsage],
  );

  const handlePanelClose = useCallback(() => {
    if (currentArtifact) {
      trackFeatureUsage("close_artifact", {
        artifact_type: currentArtifact.type,
        conversation_id: currentConversationId || "none",
      });
    }

    setIsPanelVisible(false);
    setIsCombinedPanel(false);

    setTimeout(() => {
      setCurrentArtifact(null);
      setCurrentArtifacts([]);
    }, 300);
  }, [currentArtifact, currentConversationId, trackFeatureUsage]);

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

  const handleSubmit = useCallback(
    async (
      e: FormEvent,
      attachmentData?: { type: string; data: string; name?: string },
    ) => {
      e.preventDefault();
      if (!chatInput.trim() && !attachmentData) {
        return;
      }

      // For text-to-image models, only allow the first message unless they support image edits
      if (model && apiModels?.[model]) {
        const modelConfig = apiModels[model];
        const isTextToImageModel = modelConfig.type?.includes("text-to-image");
        if (
          isTextToImageModel &&
          !modelConfig.supportsImageEdits &&
          messages.length > 0
        ) {
          toast.error(
            "Text-to-image models only support one message per conversation. Please start a new conversation.",
          );
          return;
        }
      }

      try {
        const originalInput = chatInput;
        setChatInput("");

        trackEvent({
          name: "send_message",
          category: EventCategory.CONVERSATION,
          properties: {
            conversation_id: currentConversationId || "new",
            model_id: model || "unknown",
            message_length: chatInput.length,
            has_attachment: Boolean(attachmentData),
            attachment_type: attachmentData ? attachmentData.type : undefined,
            is_first_message: messages.length === 0,
          },
        });

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
        trackError("message_send_error", error, {
          conversation_id: currentConversationId || "new",
          model_id: model || "unknown",
        });
      }
    },
    [
      chatInput,
      model,
      apiModels,
      messages,
      sendMessage,
      trackEvent,
      trackError,
      currentConversationId,
      setChatInput,
    ],
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
      handleSubmit,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  const handleTranscribe = useCallback(
    async (data: {
      response: {
        content: string;
      };
    }) => {
      setChatInput(data.response.content);
      trackFeatureUsage("transcription_used", {
        conversation_id: currentConversationId || "new",
        content_length: data.response.content.length,
      });
    },
    [currentConversationId, trackFeatureUsage, setChatInput],
  );

  const handleToolInteraction = useCallback(
    (toolName: string, action: "useAsPrompt", data: Record<string, any>) => {
      trackFeatureUsage("tool_interaction", {
        tool_name: toolName,
        action: action,
        conversation_id: currentConversationId || "new",
      });

      switch (toolName) {
        case "web_search":
          if (action === "useAsPrompt") {
            setChatInput(data.question);
          }
          break;
        default:
          break;
      }
    },
    [currentConversationId, trackFeatureUsage, setChatInput],
  );

  const showWelcomeScreen =
    messages.length === 0 &&
    !currentConversationId &&
    !isStreamLoading &&
    !streamStarted;

  const handleBranch = useCallback(
    (messageId: string, modelId?: string) => {
      branchConversation(messageId, modelId);
    },
    [branchConversation],
  );

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
              onBranch={handleBranch}
              isBranching={isBranching}
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
