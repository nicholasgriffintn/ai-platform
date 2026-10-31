import {
  findLatestArtifactByIdentifier,
  type ToolInteractionHandler,
  UserQuestionView,
} from "@ngriffin_uk/polychat-component-content";
import { Pet, usePetStatus } from "@ngriffin_uk/polychat-component-ui";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import { isCompactConversationCommand } from "@ngriffin_uk/polychat-library-chat/compaction-command";
import type {
  ChatRequestOptions,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { resolveGoalSubmission } from "@ngriffin_uk/polychat-library-chat/goal-command";
import { mergeChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/request-options";
import {
  resolveConnectorOperationApproval,
  useChatStore,
  useStreamActivityStore,
} from "@ngriffin_uk/polychat-library-client";
import {
  EventCategory,
  useTrackEvent,
  useArtifactWorkbench,
  useChat,
  useChatManager,
  useResponseReplay,
  useModels,
  usePetNudgeSources,
  usePetStore,
  useUIStore,
  usePetFollowEnabled,
  useRemoteConversationActivity,
  isModelSubmissionBlocked,
  openExternalUrl,
  useComposerDraft,
  useIsLoading,
  useConversationScope,
  useConversationStorage,
  getSiblingConversationPath,
  useToolApprovalBatch,
} from "@ngriffin_uk/polychat-library-react";
import type { ChatSuggestion, ToolApprovalDecision } from "@ngriffin_uk/polychat-library-react";
import {
  createModelReferenceMap,
  EMPTY_MODEL_CONFIG,
  PET_TEMPORARY_CONVERSATION_STATE,
  getModelByReference,
  isImageGenerationOutputModel,
  isReadinessFresh,
  getModelInteractionCapabilities,
  isTerminalResponseStatus,
} from "@ngriffin_uk/polychat-schemas";
import type {
  ConversationModeMetadata,
  PetConversationState,
  UserQuestionSet,
  ChatMessageSelection,
  ModelSelectionChangeHandler,
  ModelSelectorScope,
  QueuedChatMessage,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import type {
  ComposerActionCatalogConfig,
  ComposerAssistantActionCapability,
  ComposerCommandAction,
} from "@ngriffin_uk/polychat-utility-react";
import { useElementSize } from "@ngriffin_uk/polychat-utility-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import type { ComposerSubjectChip } from "../Composer/ComposerCommandSurface.js";
import type { ComposerShellProps } from "../Composer/ComposerShell.js";
import {
  ConversationComposerDock,
  ConversationMessageColumn,
  ConversationWelcomeStarters,
} from "../ConversationColumn.js";
import { GoalStatusCard } from "../GoalStatusCard.js";
import { PetPerch } from "../PetPerch.js";
import { WELCOME_PET_SIZE, type WelcomeOpening, WelcomeScreen } from "../WelcomeScreen.js";
import { AgentApprovalDock, type ConversationAgentApprovals } from "./AgentApprovalDock.js";
import {
  ChatInput,
  type ChatInputHandle,
  type ConversationRunSteering,
} from "./ChatInput/index.js";
import { QueuedFollowUps } from "./ChatInput/QueuedFollowUps.js";
import { uploadComposerAttachment } from "./ChatInput/uploadAttachment.js";
import { ChatRunStatusBanner } from "./ChatRunStatusBanner.js";
import { ChatSuggestions } from "./ChatSuggestions.js";
import { ComposerBanner } from "./ComposerBanner/index.js";
import { FooterInfo } from "./FooterInfo.js";
import { MessageList } from "./MessageList.js";
import { resolveThreadModeConfig, type ThreadSurface } from "./surface-profiles.js";
import { ToolApprovalBatchBar } from "./ToolApprovalBatchBar.js";
import { useApprovalRules } from "./useApprovalRules.js";
import { useAssistantActionSubmit } from "./useAssistantActionSubmit.js";
import { useAutoPlayResponses } from "./useAutoPlayResponses.js";
import { useGoalCommands } from "./useGoalCommands.js";

const EMPTY_CONTEXT_ATTACHMENTS: AttachmentData[] = [];
const LEAD_CLEARANCE = 32;

export interface ConversationFollowUpQueue {
  messages: readonly QueuedChatMessage[];
  onQueue: (content: string) => Promise<void>;
  onRemove: (queuedId: string) => void;
}

export interface ThreadModeConfig {
  surface?: ThreadSurface;
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
  welcomeOpening?: WelcomeOpening;
  welcomeLoading?: boolean;
  welcomeSuggestions?: ChatSuggestion[] | null;
  welcomeCapabilitySuggestions?: boolean;
  welcomePlacement?: "screen" | "composer";
  lead?: ReactNode;
  composerSubject?: ComposerSubjectChip;
  composerDensity?: ComposerShellProps["density"];
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
  hideComposerActionMenu?: boolean;
  allowedAssistantActionCapabilities?: readonly ComposerAssistantActionCapability[];
  assistantActionCatalog?: ComposerActionCatalogConfig;
  toolSelectionLocked?: boolean;
  hideSubmitButton?: boolean;
  hideTextInput?: boolean;
  hideInlineResponseControls?: boolean;
  hideChatSettings?: boolean;
  hideComposerSuggestions?: boolean;
  hidePetPerch?: boolean;
  submitSuggestions?: boolean;
  hideModelSelector?: boolean;
  hideVoiceControls?: boolean;
  petPresetSlug?: string;
  focusComposerOnOpen?: boolean;
  forceAutoPlayResponses?: boolean;
  analyticsSource?: string;
  contextAttachments?: AttachmentData[];
  contextAttachmentsReady?: boolean;
  onRemoveContextAttachment?: (index: number) => void;
  onClearContextAttachments?: () => void;
  pendingUserQuestions?: UserQuestionSet | null;
  onFileAsTask?: (objective: string) => Promise<boolean>;
  onSaveToNote?: (message: Message) => void;
  composerBanner?: ReactNode;
  agentApprovals?: ConversationAgentApprovals;
  runSteering?: ConversationRunSteering;
  followUpQueue?: ConversationFollowUpQueue;
  onToolInteraction?: (
    toolName: string,
    action: Parameters<ToolInteractionHandler>[1],
    data: Parameters<ToolInteractionHandler>[2],
  ) => boolean | Promise<boolean>;
}

interface ConversationThreadProps {
  modeConfig?: ThreadModeConfig;
}

export const ConversationThread = ({ modeConfig: configuredMode }: ConversationThreadProps) => {
  const modeConfig = useMemo(() => resolveThreadModeConfig(configuredMode), [configuredMode]);
  const {
    currentArtifact,
    isPanelVisible,
    isCombinedPanel,
    openArtifact: handleArtifactOpen,
    replaceArtifact,
    closePanel: handlePanelClose,
    artifactAttachments,
    addArtifactSelection,
    removeArtifactAttachment,
    clearArtifactAttachments,
    registerComposerFocus,
  } = useArtifactWorkbench();
  const modeToolInteraction = modeConfig?.onToolInteraction;

  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent, trackFeatureUsage, trackError } = useTrackEvent();

  const { model, selectedAssistantAction, setSelectedAssistantAction, computeSite } =
    useChatStore();
  const { currentConversationId, startNewConversation } = useConversationScope();
  const { composerInput, setComposerInput } = useComposerDraft();
  const isComposingGoal = useChatStore((state) => state.isComposingGoal);
  const setComposingGoal = useChatStore((state) => state.setComposingGoal);
  const { data: currentConversation, isLoading: isConversationLoading } = useChat(
    currentConversationId,
    { monitorRemoteActivity: true },
  );
  const { determineStorageMode } = useConversationStorage(modeConfig?.requestOptions);
  const storageMode = determineStorageMode(currentConversationId);
  const streamSource = useStreamActivityStore((state) =>
    currentConversationId ? state.streams[currentConversationId]?.source : undefined,
  );
  const conversationState: PetConversationState | undefined =
    storageMode.retention === "temporary" ? PET_TEMPORARY_CONVERSATION_STATE : undefined;

  useResponseReplay(
    currentConversationId,
    currentConversation?.latest_response,
    storageMode.retention === "kept" && computeSite === "hosted" && streamSource !== "local",
  );
  useRemoteConversationActivity(
    currentConversationId,
    currentConversation?.active_operation,
    currentConversation?.latest_response,
  );
  const {
    goalView,
    canUseGoals,
    busy: goalBusy,
    goalState,
    handleGoalCommand,
    setGoalOnConversation,
  } = useGoalCommands(currentConversationId);
  const {
    streamStarted,
    controller,
    compactConversation,
    sendMessage,
    respondToExistingConversation,
    abortStream,
    startConversationThread,
    isStartingThread,
    requestSecondOpinion,
    isRequestingSecondOpinion,
  } = useChatManager(modeConfig?.requestOptions, modeConfig?.conversationMode);
  const {
    data: apiModels = EMPTY_MODEL_CONFIG,
    isLoading: isModelsLoading,
    refetch: refetchModels,
  } = useModels();
  const modelReferences = useMemo(() => createModelReferenceMap(apiModels), [apiModels]);
  const selectedModelConfig = useMemo(
    () => getModelByReference(modelReferences, model),
    [modelReferences, model],
  );

  const [autoPlayResponsesEnabled, setAutoPlayResponsesEnabled] = useState(false);
  const effectiveAutoPlayResponsesEnabled =
    autoPlayResponsesEnabled || Boolean(modeConfig?.forceAutoPlayResponses);

  const isStreamLoading = streamStarted;
  const isModelInitializing = useIsLoading("model-init");
  const followUpQueue = storageMode.retention === "kept" ? modeConfig?.followUpQueue : undefined;
  const latestResponseStatus = currentConversation?.latest_response?.status;
  const isReplyLive =
    isStreamLoading ||
    (latestResponseStatus !== undefined && !isTerminalResponseStatus(latestResponseStatus));
  const runSteering = useMemo<ConversationRunSteering | undefined>(() => {
    if (modeConfig?.runSteering) {
      return modeConfig.runSteering;
    }

    if (!followUpQueue || !isReplyLive) {
      return undefined;
    }

    return {
      placeholder: "Queue a follow-up for when this reply finishes",
      submitLabel: "Queue message",
      help: "Press Enter to queue it. It sends as soon as the reply finishes, even if you close this tab.",
      onSubmit: followUpQueue.onQueue,
    };
  }, [followUpQueue, isReplyLive, modeConfig?.runSteering]);

  const messages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation?.messages],
  );
  const handleConnectorApproval = useCallback(
    async (approvalId: string, resolution: "approved" | "rejected") => {
      await resolveConnectorOperationApproval(approvalId, resolution);

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
        throw new Error(result.response || "The connector action could not continue");
      }
    },
    [currentConversationId, modeConfig?.requestOptions, respondToExistingConversation],
  );

  const submitApprovalBatch = useCallback(
    async (decisions: ToolApprovalDecision[]) => {
      const [first] = decisions;

      if (!currentConversationId || !first) {
        throw new Error("The conversation is no longer available");
      }

      const response = await respondToExistingConversation(currentConversationId, {
        requestOptions: mergeChatRequestOptions(modeConfig?.requestOptions, {
          options: {
            toolInteraction: first,
            ...(decisions.length > 1 ? { toolInteractions: decisions } : {}),
          },
        }),
      });

      if (response.status === "error") {
        throw new Error(response.response || "The approvals could not be submitted");
      }
    },
    [currentConversationId, modeConfig?.requestOptions, respondToExistingConversation],
  );
  const approvalBatch = useToolApprovalBatch({
    messages,
    isStreaming: isStreamLoading || streamStarted,
    submit: submitApprovalBatch,
  });

  const chatInputRef = useRef<ChatInputHandle>(null);
  const autoSubmittedKeyRef = useRef<string | null>(null);
  const prevConversationIdRef = useRef(currentConversationId);
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

  const setPetSpeaking = usePetStore((state) => state.setSpeaking);

  useEffect(() => {
    setPetSpeaking(isPlayingAutoResponse);

    return () => setPetSpeaking(false);
  }, [isPlayingAutoResponse, setPetSpeaking]);

  const handleAutoPlayToggle = useCallback(() => {
    if (autoPlayResponsesEnabled) {
      stopPlayback();
    }

    setAutoPlayResponsesEnabled(!autoPlayResponsesEnabled);
  }, [autoPlayResponsesEnabled, stopPlayback]);

  useEffect(() => {
    registerComposerFocus(() => chatInputRef.current?.focus());
  }, [registerComposerFocus]);

  const focusComposerOnOpen = Boolean(modeConfig?.focusComposerOnOpen);

  useEffect(() => {
    if (!focusComposerOnOpen) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => chatInputRef.current?.focus());

    return () => window.cancelAnimationFrame(frame);
  }, [focusComposerOnOpen]);

  const handleQuoteSelection = useCallback(
    (selection: ChatMessageSelection) => {
      addArtifactSelection({
        type: "selection",
        name: "Quoted response",
        selection,
      });
    },
    [addArtifactSelection],
  );

  const handleRemoveArtifactContextAttachment = useCallback(
    (indexToRemove: number) => {
      removeArtifactAttachment(indexToRemove);
    },
    [removeArtifactAttachment],
  );

  const handleClearArtifactContextAttachments = useCallback(() => {
    clearArtifactAttachments();
  }, [clearArtifactAttachments]);
  const modeContextAttachments = modeConfig?.contextAttachments ?? EMPTY_CONTEXT_ATTACHMENTS;
  const contextAttachments = useMemo(
    () => [...modeContextAttachments, ...artifactAttachments],
    [artifactAttachments, modeContextAttachments],
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
    if (prevConversationIdRef.current !== currentConversationId) {
      prevConversationIdRef.current = currentConversationId;

      if (isPanelVisible) {
        handlePanelClose();
      }
    }
  }, [currentConversationId, handlePanelClose, isPanelVisible]);

  useEffect(() => {
    if (!currentArtifact || !isPanelVisible || isCombinedPanel) {
      return;
    }

    const latestArtifact = findLatestArtifactByIdentifier(messages, currentArtifact.identifier);

    if (latestArtifact && latestArtifact.content !== currentArtifact.content) {
      replaceArtifact(latestArtifact);
    }
  }, [currentArtifact, isCombinedPanel, isPanelVisible, messages, replaceArtifact]);

  const canSubmit = useMemo(
    () =>
      (composerInput.trim() || selectedAssistantAction?.item) &&
      !isStreamLoading &&
      !isModelInitializing,
    [composerInput, isStreamLoading, isModelInitializing, selectedAssistantAction?.item],
  );

  const fileAsTask = modeConfig?.onFileAsTask;
  const handleSubmit = useCallback(
    async (attachments?: AttachmentData[]) => {
      if (!composerInput.trim() && !attachments?.length && !selectedAssistantAction?.item) {
        return false;
      }

      if (runSteering) {
        const instruction = composerInput.trim();

        if (!instruction) {
          return false;
        }

        setComposerInput("");

        try {
          await runSteering.onSubmit(instruction);

          return true;
        } catch (error) {
          setComposerInput(instruction);
          toast.error(getErrorMessage(error, "The instruction could not be sent"));

          return false;
        }
      }

      if (fileAsTask) {
        const objective = composerInput.trim();

        if (!objective) {
          return false;
        }

        const filed = await fileAsTask(objective);

        if (filed) {
          setComposerInput("");
        }

        return filed;
      }

      const goalSubmission = selectedAssistantAction?.item
        ? null
        : resolveGoalSubmission({ input: composerInput, isComposingGoal });
      const messageInput = goalSubmission?.messageInput ?? composerInput;
      const goalToSend =
        goalSubmission?.command?.kind === "set" ? goalSubmission.command.objective : null;

      if (goalSubmission?.command && !goalToSend) {
        setComposingGoal(false);

        const handled = await handleGoalCommand(goalSubmission.command);

        setComposerInput("");

        return handled;
      }

      if (goalToSend) {
        if (!canUseGoals) {
          toast.error("Goals are a Pro feature.");

          return false;
        }

        const conversationId = currentConversationId ?? startNewConversation();

        setComposingGoal(false);

        const goalProjectId = modeConfig?.requestOptions?.metadata?.project_id ?? undefined;

        if (!(await setGoalOnConversation(conversationId, goalToSend, goalProjectId))) {
          setComposingGoal(true);

          return false;
        }
      }

      if (isCompactConversationCommand(messageInput) && !selectedAssistantAction?.item) {
        const originalInput = composerInput;

        setComposerInput("");
        setSelectedAssistantAction(null);

        const result = await compactConversation();

        if (result.status === "error") {
          setComposerInput(originalInput);
          if (result.response) {
            toast.error(result.response);
          }
        }

        return result.status !== "error";
      }

      // For text-to-image models, only allow the first message unless they support image edits
      if (model && computeSite === "hosted") {
        let currentModel = selectedModelConfig;

        if (currentModel?.readiness && !isReadinessFresh(currentModel.readiness)) {
          const refreshResult = await refetchModels();
          const refreshedModels = {
            ...apiModels,
            ...(refreshResult.data ?? EMPTY_MODEL_CONFIG),
          };

          currentModel = getModelByReference(createModelReferenceMap(refreshedModels), model);

          if (
            refreshResult.isError ||
            (currentModel?.readiness && !isReadinessFresh(currentModel.readiness))
          ) {
            toast.error("Model readiness could not be refreshed. Retry before sending.");

            return false;
          }
        }

        if (!currentModel) {
          toast.error(
            "Your selected model is no longer available. Choose another model before sending.",
          );

          return false;
        }

        if (currentModel.readiness?.state && currentModel.readiness.state !== "ready") {
          toast.error(currentModel.readiness.reason);

          return false;
        }

        if (currentModel.isExecutable === false) {
          toast.error("This model cannot run under the current account and provider policy.");

          return false;
        }
      }

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

      const originalInput = composerInput;
      const originalAssistantAction = selectedAssistantAction;

      try {
        const actionSubmit = await resolveAssistantActionSubmit(messageInput);

        setComposerInput("");
        setSelectedAssistantAction(null);

        trackEvent({
          name: "send_message",
          category: EventCategory.CONVERSATION,
          properties: {
            conversation_id: currentConversationId || "new",
            source: modeConfig?.analyticsSource,
            model_id: model || "unknown",
            message_length: messageInput.length,
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
        const result = await sendMessage(
          actionSubmit.input,
          attachments,
          requestOptions,
          goalToSend ? { goalStarted: goalToSend } : undefined,
        );

        if (result?.status === "error") {
          setComposerInput(originalInput);
          setSelectedAssistantAction(originalAssistantAction);
          if (
            result.response &&
            (!("errorPresentation" in result) || result.errorPresentation !== "run")
          ) {
            toast.error(result.response);
          }
        } else {
          setTimeout(() => {
            chatInputRef.current?.focus();
          }, 0);
        }

        return result?.status !== "error";
      } catch (error) {
        setComposerInput(originalInput);
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
      apiModels,
      canUseGoals,
      compactConversation,
      composerInput,
      computeSite,
      currentConversationId,
      fileAsTask,
      handleGoalCommand,
      isComposingGoal,
      messages,
      modeConfig,
      model,
      navigate,
      refetchModels,
      resolveAssistantActionSubmit,
      runSteering,
      selectedAssistantAction,
      selectedModelConfig,
      sendMessage,
      setComposingGoal,
      setComposerInput,
      setGoalOnConversation,
      setSelectedAssistantAction,
      startNewConversation,
      trackError,
      trackEvent,
    ],
  );

  const submitPrompt = useCallback(
    async (input: string) => {
      setComposerInput("");

      const result = await sendMessage(
        input,
        contextAttachments.length > 0 ? contextAttachments : undefined,
        modeConfig?.requestOptions,
      );

      if (result?.status === "error") {
        setComposerInput(input);
      }
    },
    [contextAttachments, modeConfig?.requestOptions, sendMessage, setComposerInput],
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
    void submitPrompt(initialAutoSubmit.input);
  }, [
    isModelInitializing,
    isStreamLoading,
    modeConfig?.contextAttachmentsReady,
    modeConfig?.initialAutoSubmit,
    streamStarted,
    submitPrompt,
  ]);

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if ((isStreamLoading && !runSteering) || isModelInitializing) {
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
      runSteering,
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
      setComposerInput(data.response.content);
      trackFeatureUsage("transcription_used", {
        conversation_id: currentConversationId || "new",
        content_length: data.response.content.length,
      });
    },
    [currentConversationId, trackFeatureUsage, setComposerInput],
  );

  const uploadInteractionFiles = useCallback(
    async (files: unknown): Promise<AttachmentData[]> => {
      if (!Array.isArray(files)) {
        return [];
      }

      const capabilities = getModelInteractionCapabilities(model ? apiModels?.[model] : undefined);
      const results = await Promise.all(
        files
          .filter((file): file is File => file instanceof File)
          .map((file) =>
            uploadComposerAttachment(file, {
              ...capabilities,
              projectId: modeConfig?.requestOptions?.metadata?.project_id ?? undefined,
            }),
          ),
      );
      const failure = results.find((result) => "error" in result);

      if (failure && "error" in failure) {
        throw new Error(failure.error);
      }

      return results.flatMap((result) => ("attachment" in result ? [result.attachment] : []));
    },
    [apiModels, model, modeConfig?.requestOptions?.metadata?.project_id],
  );

  const applyApprovalRule = useApprovalRules();
  const setOpenFile = useUIStore((state) => state.setOpenFile);
  const filesProjectId = modeConfig?.requestOptions?.metadata?.project_id;
  const openOutput = useCallback(
    (outputId: string) =>
      setOpenFile({
        origin: "output",
        id: outputId,
        ...(filesProjectId ? { projectId: filesProjectId } : {}),
      }),
    [filesProjectId, setOpenFile],
  );

  const handleToolInteraction = useCallback<ToolInteractionHandler>(
    async (toolName, action, interactionData) => {
      const data = await applyApprovalRule(toolName, interactionData);

      trackFeatureUsage("tool_interaction", {
        tool_name: toolName,
        action: action,
        conversation_id: currentConversationId || "new",
      });

      if (await modeToolInteraction?.(toolName, action, data)) {
        return;
      }

      if (action === "submitPrompt") {
        const interactionId = typeof data.interactionId === "string" ? data.interactionId : null;
        const resolution = data.resolution;
        const directResolution = data.approvalRequired === true || toolName === "request_approval";

        if (
          directResolution &&
          interactionId &&
          (resolution === "approved" || resolution === "rejected")
        ) {
          if (approvalBatch.record({ toolName, response: data })) {
            return;
          }

          if (!currentConversationId) {
            throw new Error("The conversation is no longer available");
          }

          const interactionRequestOptions = mergeChatRequestOptions(modeConfig?.requestOptions, {
            options: {
              toolInteraction: {
                toolName,
                response: data,
              },
            },
          });
          const response = await respondToExistingConversation(currentConversationId, {
            requestOptions: interactionRequestOptions,
          });

          if (response.status === "error") {
            throw new Error(response.response || "The approval could not be submitted");
          }

          return;
        }

        if (typeof data.input === "string" && data.input.trim()) {
          const requestOptions = mergeChatRequestOptions(modeConfig?.requestOptions, {
            options: {
              toolInteraction: {
                toolName,
                response: data,
              },
            },
          });

          const answerAttachments = await uploadInteractionFiles(data.files);
          const response = await sendMessage(
            data.input,
            answerAttachments.length > 0 ? answerAttachments : undefined,
            requestOptions,
          );

          if (response.status === "error") {
            throw new Error(response.response || "The approval could not be submitted");
          }
        }

        return;
      }

      if (action === "openFile" && typeof data.outputId === "string") {
        openOutput(data.outputId);

        return;
      }

      switch (toolName) {
        case "delegate":
          if (data.action === "open" && typeof data.childConversationId === "string") {
            void navigate(getSiblingConversationPath(location.pathname, data.childConversationId));
          } else if (data.action === "output" && typeof data.outputId === "string") {
            openOutput(data.outputId);
          } else if (
            (data.action === "resume" || data.action === "fresh") &&
            typeof data.input === "string"
          ) {
            setComposerInput(data.input);
            chatInputRef.current?.focus();
          }

          break;
        case "web_search":
          setComposerInput(data.question);

          break;
        default:
          break;
      }
    },
    [
      applyApprovalRule,
      approvalBatch,
      currentConversationId,
      trackFeatureUsage,
      uploadInteractionFiles,
      setComposerInput,
      sendMessage,
      respondToExistingConversation,
      modeConfig?.requestOptions,
      modeToolInteraction,
      location.pathname,
      navigate,
      openOutput,
    ],
  );

  const { ref: dockRef, height: dockHeight } = useElementSize<HTMLDivElement>();
  const petStatus = usePetStatus(currentConversationId);
  const petFollows = usePetFollowEnabled();
  const polyIsOpen = useUIStore((state) => state.showPoly);
  const setShowPoly = useUIStore((state) => state.setShowPoly);
  const isPolySurface = modeConfig?.surface === "poly";
  const showPetPerch = petFollows && !isPolySurface && !polyIsOpen && !modeConfig?.hidePetPerch;
  const openPolyFromPet = isPolySurface ? undefined : () => setShowPoly(true);

  usePetNudgeSources({
    conversationId: currentConversationId,
    goalStatus: goalView?.status,
    goalStoppedReason: goalView?.stoppedReason,
    hasPendingQuestion: Boolean(modeConfig?.pendingUserQuestions),
    hasPendingApproval: Boolean(modeConfig?.agentApprovals?.pending.length),
  });

  const showWelcomeScreen =
    messages.length === 0 && !currentConversationId && !isStreamLoading && !streamStarted;
  const welcomeInComposer = showWelcomeScreen && modeConfig?.welcomePlacement === "composer";
  const composerPlaceholder =
    welcomeInComposer && modeConfig?.welcomeTitle && !modeConfig.welcomeLoading
      ? {
          newConversation: modeConfig.welcomeTitle,
          followUp: modeConfig.inputPlaceholder?.followUp ?? "Ask a follow-up",
        }
      : modeConfig?.inputPlaceholder;

  const handleStartThread = useCallback(
    (messageId: string, modelId?: string) => {
      void startConversationThread(messageId, modelId);
    },
    [startConversationThread],
  );

  const lead = modeConfig?.lead;
  const floatingDock = lead !== undefined && showWelcomeScreen;
  const hasWelcomeStarters =
    modeConfig?.welcomeSuggestions !== null && modeConfig?.welcomeSuggestions?.length !== 0;
  const welcomeSuggestions = (
    <ChatSuggestions
      setInput={setComposerInput}
      onSubmitPrompt={
        modeConfig?.submitSuggestions ? (prompt) => void submitPrompt(prompt) : undefined
      }
      suggestionsOverride={modeConfig?.welcomeSuggestions}
      isLoading={modeConfig?.welcomeLoading}
      modeCommands={modeConfig?.modeControls?.commands}
      modelConfig={selectedModelConfig}
      includeCapabilities={modeConfig?.welcomeCapabilitySuggestions !== false}
      layout={lead !== undefined ? "list" : welcomeInComposer ? "pills" : "grid"}
    />
  );

  const messageColumn = (
    <ConversationMessageColumn>
      <MessageList
        messages={messages}
        retention={storageMode.retention}
        hideInlineUserQuestions={Boolean(modeConfig?.pendingUserQuestions)}
        onToolInteraction={handleToolInteraction}
        onConnectorApproval={handleConnectorApproval}
        onArtifactOpen={handleArtifactOpen}
        onStartThread={handleStartThread}
        isStartingThread={isStartingThread}
        onRequestSecondOpinion={(messageId) => void requestSecondOpinion(messageId)}
        isRequestingSecondOpinion={isRequestingSecondOpinion}
        onQuoteSelection={handleQuoteSelection}
        onSaveToNote={modeConfig?.onSaveToNote}
      />
    </ConversationMessageColumn>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      {lead !== undefined ? (
        <>
          <div
            data-header-scroll-source={showWelcomeScreen ? "" : undefined}
            className={
              showWelcomeScreen
                ? "min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto"
                : "relative z-10 shrink-0"
            }
            style={
              floatingDock && dockHeight
                ? { paddingBottom: dockHeight + LEAD_CLEARANCE }
                : undefined
            }
          >
            {lead}
            {showWelcomeScreen && hasWelcomeStarters ? (
              <ConversationWelcomeStarters title={modeConfig?.welcomeTitle}>
                {welcomeSuggestions}
              </ConversationWelcomeStarters>
            ) : null}
          </div>
          {showWelcomeScreen ? null : messageColumn}
        </>
      ) : welcomeInComposer ? null : showWelcomeScreen ? (
        <div
          data-header-scroll-source
          className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-0 py-6 sm:py-8"
        >
          <div className="my-auto w-full">
            <WelcomeScreen
              title={modeConfig?.welcomeTitle}
              description={modeConfig?.welcomeDescription}
              opening={modeConfig?.welcomeOpening}
              isLoading={modeConfig?.welcomeLoading}
              pet={
                <Pet
                  size={WELCOME_PET_SIZE}
                  placement="top"
                  model={selectedModelConfig}
                  modelReady={!model || !isModelsLoading}
                  conversationState={conversationState}
                  conversationId={currentConversationId}
                  presetSlug={modeConfig?.petPresetSlug}
                  onActivate={openPolyFromPet}
                  activateLabel="Ask Poly about this page"
                />
              }
              suggestions={welcomeSuggestions}
            />
          </div>
        </div>
      ) : (
        messageColumn
      )}

      <ConversationComposerDock
        floating={floatingDock}
        ref={lead !== undefined ? dockRef : undefined}
      >
        {welcomeInComposer ? welcomeSuggestions : null}
        {!showPetPerch || showWelcomeScreen ? null : (
          <PetPerch
            pet={
              <Pet
                size={44}
                facing="left"
                placement="left"
                model={selectedModelConfig}
                modelReady={!model || !isModelsLoading}
                conversationState={conversationState}
                conversationId={currentConversationId}
                presetSlug={modeConfig?.petPresetSlug}
                onActivate={openPolyFromPet}
                activateLabel="Ask Poly about this conversation"
              />
            }
            status={petStatus}
          />
        )}
        <ComposerBanner
          model={selectedModelConfig}
          requestedModelId={model}
          isModelsLoading={isModelsLoading}
          hideSuggestions={modeConfig?.hideComposerSuggestions}
        />
        {modeConfig?.pendingUserQuestions ? (
          <UserQuestionView
            data={modeConfig.pendingUserQuestions}
            embedded
            onToolInteraction={handleToolInteraction}
          />
        ) : null}
        {goalView ? (
          <GoalStatusCard
            objective={goalView.objective}
            status={goalView.status}
            statusLabel={goalView.statusLabel}
            iterationCount={goalView.iterationCount}
            stoppedReason={goalView.stoppedReason}
            busy={goalBusy}
            onPause={() => void handleGoalCommand({ kind: "pause" })}
            onResume={() => void handleGoalCommand({ kind: "resume" })}
            onClear={() => void handleGoalCommand({ kind: "clear" })}
          />
        ) : null}
        {currentConversation?.latest_response &&
        (currentConversation.latest_response.status === "failed" ||
          currentConversation.latest_response.status === "cancelled" ||
          currentConversation.latest_response.status === "incomplete") ? (
          <ChatRunStatusBanner response={currentConversation.latest_response} />
        ) : null}
        {modeConfig?.agentApprovals ? <AgentApprovalDock {...modeConfig.agentApprovals} /> : null}
        <ToolApprovalBatchBar batch={approvalBatch} />
        {modeConfig?.composerBanner}
        {followUpQueue ? (
          <QueuedFollowUps messages={followUpQueue.messages} onRemove={followUpQueue.onRemove} />
        ) : null}
        <ChatInput
          goalState={goalState}
          ref={chatInputRef}
          handleSubmit={handleSubmit}
          isLoading={isStreamLoading || isModelInitializing || isConversationLoading}
          isSubmissionBlocked={
            computeSite === "hosted" &&
            isModelSubmissionBlocked(model, selectedModelConfig, isModelsLoading)
          }
          streamStarted={streamStarted}
          controller={controller}
          onStopResponse={abortStream}
          onTranscribe={(data) => void handleTranscribe(data)}
          placeholder={composerPlaceholder}
          controls={modeConfig?.inputControls}
          modeControls={modeConfig?.modeControls}
          modelProviderFilter={modeConfig?.modelProviderFilter}
          modelScope={modeConfig?.modelScope}
          onModelChange={modeConfig?.onModelChange}
          activeRunStatus={currentConversation?.latest_response?.status}
          runSteering={runSteering}
          hasConversationHistory={messages.length > 0}
          hideComposerActionMenu={modeConfig?.hideComposerActionMenu}
          allowedAssistantActionCapabilities={modeConfig?.allowedAssistantActionCapabilities}
          assistantActionCatalog={modeConfig?.assistantActionCatalog}
          toolSelectionLocked={modeConfig?.toolSelectionLocked}
          hideSubmitButton={modeConfig?.hideSubmitButton}
          hideTextInput={modeConfig?.hideTextInput}
          hideInlineResponseControls={modeConfig?.hideInlineResponseControls}
          hideChatSettings={modeConfig?.hideChatSettings}
          hideModelSelector={modeConfig?.hideModelSelector}
          hideVoiceControls={modeConfig?.hideVoiceControls}
          density={modeConfig?.composerDensity}
          subject={modeConfig?.composerSubject}
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
        {lead !== undefined ? <FooterInfo /> : null}
      </ConversationComposerDock>

      {welcomeInComposer || lead !== undefined ? null : <FooterInfo />}
    </div>
  );
};
