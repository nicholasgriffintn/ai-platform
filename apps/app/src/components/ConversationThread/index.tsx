import {
  type ArtifactProps,
  findLatestArtifactByIdentifier,
  ArtifactPanel,
  type ToolInteractionHandler,
} from "@ngriffin_uk/polychat-component-content";
import type {
  ComposerActionCatalogConfig,
  ComposerAssistantActionCapability,
  ComposerCommandAction,
} from "@ngriffin_uk/polychat-component-conversation";
import {
  ConversationComposerDock,
  ConversationMessageColumn,
  WelcomeScreen,
} from "@ngriffin_uk/polychat-component-conversation";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import { isCompactConversationCommand } from "@ngriffin_uk/polychat-library-chat/compaction-command";

import "~/styles/scrollbar.css";
import "~/styles/github.css";
import "~/styles/github-dark.css";
import { mergeChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/request-options";
import {
  createModelReferenceMap,
  EMPTY_MODEL_CONFIG,
  getModelByReference,
  isImageGenerationOutputModel,
} from "@ngriffin_uk/polychat-schemas";
import type { ConversationModeMetadata } from "@ngriffin_uk/polychat-schemas";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ComposerBanner } from "~/components/ConversationThread/ComposerBanner";
import { Logo } from "~/components/Core/Logo";
import { EventCategory, useTrackEvent } from "~/hooks/use-track-event";
import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useModels } from "~/hooks/useModels";
import { resolveConnectorOperationApproval } from "~/lib/api/connectors";
import { openExternalUrl } from "~/lib/external-navigation";
import { useIsLoading } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatRequestOptions, ModelSelectionChangeHandler, ModelSelectorScope } from "~/types";

import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { FooterInfo } from "./FooterInfo";
import { MessageList } from "./MessageList";
import { SampleQuestions } from "./SampleQuestions";
import { useAssistantActionSubmit } from "./useAssistantActionSubmit";
import { useAutoPlayResponses } from "./useAutoPlayResponses";

export interface ConversationThreadModeConfig {
  assistantActionRoutes?: {
    recipes?: string;
  };
  requestOptions?: ChatRequestOptions;
  initialAutoSubmit?: {
    key: string;
    input: string;
  };
  conversationMode?: ConversationModeMetadata;
  welcomeTitle?: string;
  welcomeDescription?: string;
  welcomeLoading?: boolean;
  welcomeSampleQuestions?: Array<{
    id: string;
    text: string;
    question: string;
    category: string;
  }> | null;
  inputPlaceholder?: {
    newConversation: string;
    followUp: string;
  };
  inputControls?: ReactNode;
  modeControls?: {
    activeModeControls?: ReactNode;
    commands?: ComposerCommandAction[];
    includeSettingCommands?: boolean;
    onClearActive?: () => void;
  };
  modelProviderFilter?: string;
  modelScope?: ModelSelectorScope;
  onModelChange?: ModelSelectionChangeHandler;
  hideDefaultControls?: boolean;
  hideComposerActionMenu?: boolean;
  allowedAssistantActionCapabilities?: readonly ComposerAssistantActionCapability[];
  assistantActionCatalog?: ComposerActionCatalogConfig;
  toolSelectionLocked?: boolean;
  hideSubmitButton?: boolean;
  hideTextInput?: boolean;
  hideInlineResponseControls?: boolean;
  hideChatSettings?: boolean;
  hideComposerSuggestions?: boolean;
  forceAutoPlayResponses?: boolean;
  analyticsSource?: string;
  contextAttachments?: AttachmentData[];
  contextAttachmentsReady?: boolean;
  onRemoveContextAttachment?: (index: number) => void;
  onClearContextAttachments?: () => void;
}

interface ConversationThreadProps {
  modeConfig?: ConversationThreadModeConfig;
}

export const ConversationThread = ({ modeConfig }: ConversationThreadProps) => {
  const { copied: artifactCopied, copy: copyArtifact } = useCopyToClipboard();

  const navigate = useNavigate();
  const { trackEvent, trackFeatureUsage, trackError } = useTrackEvent();

  const {
    currentConversationId,
    model,
    chatInput,
    setChatInput,
    selectedAssistantAction,
    setSelectedAssistantAction,
  } = useChatStore();
  const { data: currentConversation } = useChat(currentConversationId);
  const {
    streamStarted,
    controller,
    compactConversation,
    sendMessage,
    respondToExistingConversation,
    abortStream,
    branchConversation,
    isBranching,
    requestOpinion,
    isRequestingOpinion,
  } = useChatManager(modeConfig?.requestOptions, modeConfig?.conversationMode);
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const modelReferences = useMemo(() => createModelReferenceMap(apiModels), [apiModels]);
  const selectedModelConfig = useMemo(
    () => getModelByReference(modelReferences, model),
    [modelReferences, model],
  );

  const [currentArtifact, setCurrentArtifact] = useState<ArtifactProps | null>(null);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [currentArtifacts, setCurrentArtifacts] = useState<ArtifactProps[]>([]);
  const [isCombinedPanel, setIsCombinedPanel] = useState(false);
  const [artifactContextAttachments, setArtifactContextAttachments] = useState<AttachmentData[]>(
    [],
  );
  const [autoPlayResponsesEnabled, setAutoPlayResponsesEnabled] = useState(false);
  const effectiveAutoPlayResponsesEnabled =
    autoPlayResponsesEnabled || Boolean(modeConfig?.forceAutoPlayResponses);

  const isStreamLoading = useIsLoading("stream-response");
  const isModelInitializing = useIsLoading("model-init");

  const messages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation?.messages],
  );
  const handleConnectorApproval = useCallback(
    async (approvalId: string, resolution: "approved" | "rejected") => {
      await resolveConnectorOperationApproval(approvalId, resolution);
      if (resolution === "rejected") {
        return;
      }

      if (!currentConversationId) {
        throw new Error("The conversation is no longer available");
      }

      const result = await respondToExistingConversation(currentConversationId, {
        requestOptions: {
          ...modeConfig?.requestOptions,
          connector_approval_id: approvalId,
        },
      });

      if (result.status === "error") {
        throw new Error(result.response || "The approved action could not continue");
      }
    },
    [currentConversationId, modeConfig?.requestOptions, respondToExistingConversation],
  );

  const chatInputRef = useRef<ChatInputHandle>(null);
  const autoSubmittedKeyRef = useRef<string | null>(null);
  const { resolveAssistantActionSubmit } = useAssistantActionSubmit({
    ...(modeConfig?.requestOptions?.metadata?.project_id
      ? { projectId: modeConfig.requestOptions.metadata.project_id }
      : {}),
    recipeManagementPath: modeConfig?.assistantActionRoutes?.recipes,
  });
  const {
    isGeneratingSpeech: isGeneratingAutoResponseSpeech,
    isPlaying: isPlayingAutoResponse,
    stopPlayback,
  } = useAutoPlayResponses({
    conversationId: currentConversationId,
    messages,
    isEnabled: effectiveAutoPlayResponsesEnabled,
    isStreaming: isStreamLoading || streamStarted,
  });

  const handleAutoPlayToggle = useCallback(() => {
    if (autoPlayResponsesEnabled) {
      stopPlayback();
    }

    setAutoPlayResponsesEnabled(!autoPlayResponsesEnabled);
  }, [autoPlayResponsesEnabled, stopPlayback]);

  const handleArtifactOpen = useCallback(
    (artifact: ArtifactProps, combine?: boolean, artifacts?: ArtifactProps[]) => {
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

      setCurrentArtifacts([]);
      setIsCombinedPanel(false);
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

  const handleAddArtifactSelectionToChat = useCallback(
    (attachment: AttachmentData) => {
      setArtifactContextAttachments((currentAttachments) => [...currentAttachments, attachment]);
      chatInputRef.current?.focus();

      trackFeatureUsage("add_artifact_selection_to_chat", {
        conversation_id: currentConversationId || "none",
        artifact_type: currentArtifact?.type || "unknown",
      });
    },
    [currentArtifact?.type, currentConversationId, trackFeatureUsage],
  );

  const handleRemoveArtifactContextAttachment = useCallback((indexToRemove: number) => {
    setArtifactContextAttachments((currentAttachments) =>
      currentAttachments.filter((_, index) => index !== indexToRemove),
    );
  }, []);

  const handleClearArtifactContextAttachments = useCallback(() => {
    setArtifactContextAttachments([]);
  }, []);
  const modeContextAttachments = modeConfig?.contextAttachments ?? [];
  const contextAttachments = useMemo(
    () => [...modeContextAttachments, ...artifactContextAttachments],
    [artifactContextAttachments, modeContextAttachments],
  );
  const handleRemoveContextAttachment = useCallback(
    (indexToRemove: number) => {
      if (indexToRemove < modeContextAttachments.length) {
        modeConfig?.onRemoveContextAttachment?.(indexToRemove);

        return;
      }

      handleRemoveArtifactContextAttachment(indexToRemove - modeContextAttachments.length);
    },
    [handleRemoveArtifactContextAttachment, modeConfig, modeContextAttachments.length],
  );
  const handleClearContextAttachments = useCallback(() => {
    modeConfig?.onClearContextAttachments?.();
    handleClearArtifactContextAttachments();
  }, [handleClearArtifactContextAttachments, modeConfig]);

  useEffect(() => {
    if (isPanelVisible) {
      handlePanelClose();
    }
  }, [currentConversationId]);

  useEffect(() => {
    if (!currentArtifact || !isPanelVisible || isCombinedPanel) {
      return;
    }

    const latestArtifact = findLatestArtifactByIdentifier(messages, currentArtifact.identifier);

    if (latestArtifact && latestArtifact.content !== currentArtifact.content) {
      setCurrentArtifact(latestArtifact);
    }
  }, [currentArtifact, isCombinedPanel, isPanelVisible, messages]);

  const canSubmit = useMemo(
    () =>
      (chatInput.trim() || selectedAssistantAction?.item) &&
      !isStreamLoading &&
      !isModelInitializing,
    [chatInput, isStreamLoading, isModelInitializing, selectedAssistantAction?.item],
  );

  const handleSubmit = useCallback(
    async (attachments?: AttachmentData[]) => {
      if (!chatInput.trim() && !attachments?.length && !selectedAssistantAction?.item) {
        return false;
      }

      if (isCompactConversationCommand(chatInput) && !selectedAssistantAction?.item) {
        const originalInput = chatInput;

        setChatInput("");
        setSelectedAssistantAction(null);

        const result = await compactConversation();

        if (result.status === "error") {
          setChatInput(originalInput);
          if (result.response) {
            toast.error(result.response);
          }
        }

        return result.status !== "error";
      }

      // For text-to-image models, only allow the first message unless they support image edits
      if (selectedModelConfig) {
        if (
          isImageGenerationOutputModel(selectedModelConfig) &&
          !selectedModelConfig.supportsImageEdits &&
          messages.length > 0
        ) {
          toast.error(
            "Text-to-image models only support one message per conversation. Please start a new conversation.",
          );

          return false;
        }
      }

      const originalInput = chatInput;
      const originalAssistantAction = selectedAssistantAction;

      try {
        const actionSubmit = await resolveAssistantActionSubmit(chatInput);

        setChatInput("");
        setSelectedAssistantAction(null);

        trackEvent({
          name: "send_message",
          category: EventCategory.CONVERSATION,
          properties: {
            conversation_id: currentConversationId || "new",
            source: modeConfig?.analyticsSource,
            model_id: model || "unknown",
            message_length: chatInput.length,
            has_attachment: Boolean(attachments?.length),
            attachment_count: attachments?.length ?? 0,
            attachment_type: attachments?.[0]?.type,
            attachment_types: attachments?.map((attachment) => attachment.type).join(","),
            is_first_message: messages.length === 0,
          },
        });

        if (actionSubmit.kind === "external") {
          openExternalUrl(actionSubmit.url);

          return true;
        }

        if (actionSubmit.kind === "navigation") {
          void navigate(actionSubmit.path);

          return true;
        }

        const requestOptions = mergeChatRequestOptions(
          modeConfig?.requestOptions,
          actionSubmit.requestOptions,
        );
        const result = await sendMessage(actionSubmit.input, attachments, requestOptions);

        if (result?.status === "error") {
          setChatInput(originalInput);
          setSelectedAssistantAction(originalAssistantAction);
          if (result.response) {
            toast.error(result.response);
          }
        } else {
          setTimeout(() => {
            chatInputRef.current?.focus();
          }, 0);
        }

        return result?.status !== "error";
      } catch (error) {
        setChatInput(originalInput);
        setSelectedAssistantAction(originalAssistantAction);
        toast.error(error instanceof Error ? error.message : "Failed to send message");
        console.error("Failed to send message:", error);
        trackError("message_send_error", error, {
          conversation_id: currentConversationId || "new",
          model_id: model || "unknown",
        });

        return false;
      }
    },
    [
      chatInput,
      model,
      messages,
      compactConversation,
      sendMessage,
      resolveAssistantActionSubmit,
      trackEvent,
      trackError,
      currentConversationId,
      setChatInput,
      setSelectedAssistantAction,
      selectedAssistantAction,
      selectedAssistantAction?.item,
      selectedModelConfig,
      modeConfig?.analyticsSource,
      navigate,
    ],
  );

  useEffect(() => {
    const initialAutoSubmit = modeConfig?.initialAutoSubmit;

    if (
      !initialAutoSubmit ||
      modeConfig?.contextAttachmentsReady === false ||
      isModelInitializing ||
      isStreamLoading ||
      streamStarted ||
      autoSubmittedKeyRef.current === initialAutoSubmit.key
    ) {
      return;
    }

    autoSubmittedKeyRef.current = initialAutoSubmit.key;
    setChatInput("");
    void sendMessage(
      initialAutoSubmit.input,
      contextAttachments.length > 0 ? contextAttachments : undefined,
      modeConfig?.requestOptions,
    ).then((result) => {
      if (result?.status === "error") {
        setChatInput(initialAutoSubmit.input);
      }
    });
  }, [
    contextAttachments,
    isModelInitializing,
    isStreamLoading,
    modeConfig?.contextAttachmentsReady,
    modeConfig?.initialAutoSubmit,
    modeConfig?.requestOptions,
    sendMessage,
    setChatInput,
    streamStarted,
  ]);

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (isStreamLoading || isModelInitializing) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canSubmit) {
          void handleSubmit();
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

  const handleToolInteraction = useCallback<ToolInteractionHandler>(
    (toolName, action, data) => {
      trackFeatureUsage("tool_interaction", {
        tool_name: toolName,
        action: action,
        conversation_id: currentConversationId || "new",
      });

      if (action === "submitPrompt") {
        if (typeof data.input === "string" && data.input.trim()) {
          void sendMessage(data.input, undefined, modeConfig?.requestOptions);
        }

        return;
      }

      switch (toolName) {
        case "web_search":
          setChatInput(data.question);

          break;
        default:
          break;
      }
    },
    [
      currentConversationId,
      trackFeatureUsage,
      setChatInput,
      sendMessage,
      modeConfig?.requestOptions,
    ],
  );

  const showWelcomeScreen =
    messages.length === 0 && !currentConversationId && !isStreamLoading && !streamStarted;

  const handleBranch = useCallback(
    (messageId: string, modelId?: string) => {
      void branchConversation(messageId, modelId);
    },
    [branchConversation],
  );

  return (
    <div
      className={`relative flex h-full min-h-0 w-full flex-col ${isPanelVisible ? "pr-[90%] sm:pr-[350px] md:pr-[400px] lg:pr-[650px]" : ""}`}
    >
      {showWelcomeScreen ? (
        <div
          data-header-scroll-source
          className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-0 py-6 sm:py-8"
        >
          <div className="my-auto w-full">
            <WelcomeScreen
              title={modeConfig?.welcomeTitle}
              description={modeConfig?.welcomeDescription}
              isLoading={modeConfig?.welcomeLoading}
              logo={<Logo variant="logo_control" />}
              sampleQuestions={
                <SampleQuestions
                  setInput={setChatInput}
                  questionsOverride={modeConfig?.welcomeSampleQuestions}
                  isLoading={modeConfig?.welcomeLoading}
                />
              }
            />
          </div>
        </div>
      ) : (
        <ConversationMessageColumn>
          <MessageList
            messages={messages}
            onToolInteraction={handleToolInteraction}
            onConnectorApproval={handleConnectorApproval}
            onArtifactOpen={handleArtifactOpen}
            onBranch={handleBranch}
            isBranching={isBranching}
            onRequestOpinion={requestOpinion}
            isRequestingOpinion={isRequestingOpinion}
          />
        </ConversationMessageColumn>
      )}

      <ConversationComposerDock>
        <ComposerBanner
          model={selectedModelConfig}
          hideSuggestions={modeConfig?.hideComposerSuggestions}
        />
        <ChatInput
          ref={chatInputRef}
          handleSubmit={handleSubmit}
          isLoading={isStreamLoading || isModelInitializing}
          streamStarted={streamStarted}
          controller={controller}
          onTranscribe={handleTranscribe}
          placeholder={modeConfig?.inputPlaceholder}
          controls={modeConfig?.inputControls}
          modeControls={modeConfig?.modeControls}
          modelProviderFilter={modeConfig?.modelProviderFilter}
          modelScope={modeConfig?.modelScope}
          onModelChange={modeConfig?.onModelChange}
          hideDefaultControls={modeConfig?.hideDefaultControls}
          hideComposerActionMenu={modeConfig?.hideComposerActionMenu}
          allowedAssistantActionCapabilities={modeConfig?.allowedAssistantActionCapabilities}
          assistantActionCatalog={modeConfig?.assistantActionCatalog}
          toolSelectionLocked={modeConfig?.toolSelectionLocked}
          hideSubmitButton={modeConfig?.hideSubmitButton}
          hideTextInput={modeConfig?.hideTextInput}
          hideInlineResponseControls={modeConfig?.hideInlineResponseControls}
          hideChatSettings={modeConfig?.hideChatSettings}
          contextAttachments={contextAttachments}
          readonlyContextAttachmentCount={modeContextAttachments.length}
          attachmentProjectId={modeConfig?.requestOptions?.metadata?.project_id ?? undefined}
          onRemoveContextAttachment={handleRemoveContextAttachment}
          onClearContextAttachments={handleClearContextAttachments}
          autoPlayResponses={{
            enabled: effectiveAutoPlayResponsesEnabled,
            isGenerating: isGeneratingAutoResponseSpeech,
            isPlaying: isPlayingAutoResponse,
            onToggle: handleAutoPlayToggle,
          }}
        />
      </ConversationComposerDock>

      <FooterInfo isPanelVisible={isPanelVisible} />

      <ArtifactPanel
        copied={artifactCopied}
        onCopy={copyArtifact}
        artifact={currentArtifact}
        artifacts={currentArtifacts}
        onClose={handlePanelClose}
        onAddSelectionToChat={handleAddArtifactSelectionToChat}
        isVisible={isPanelVisible}
        isCombined={isCombinedPanel}
      />
    </div>
  );
};
