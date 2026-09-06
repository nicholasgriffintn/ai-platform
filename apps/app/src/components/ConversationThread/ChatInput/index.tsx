import { Image } from "@ngriffin_uk/polychat-component-content";
import {
  type ComposerActionCatalogConfig,
  ComposerActionMenu,
  type ComposerAssistantActionCapability,
  type ComposerCommandAction,
  type ComposerInputToken,
  type ComposerInputTokenPosition,
  TokenizedComposerInput,
  type TokenizedComposerInputHandle,
  ComposerCommandActionsProvider,
  ComposerCommandChips,
  ComposerDirectiveMenu,
  ComposerVoiceControls,
  ComposerShell,
} from "@ngriffin_uk/polychat-component-conversation";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import type { GoalCommand } from "@ngriffin_uk/polychat-library-chat/goal-command";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  evaluateModelContinuity,
  getModelInteractionCapabilities,
  isTerminalChatRunStatus,
  type ChatRunStatus,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { File, FileText, Paperclip, Pause, Send, Volume2 } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useModels } from "~/hooks/useModels";
import { SOURCE_QUERY_KEYS } from "~/hooks/useSources";
import { useVoiceRecorder } from "~/hooks/useVoiceRecorder";
import { useComposerDraft } from "~/state/composer-draft";
import { useConversationScope } from "~/state/conversation-scope";
import { useUIStore } from "~/state/stores/uiStore";
import type { ModelSelectionChangeHandler, ModelSelectorScope } from "~/types";

import { ChatSettings as ChatSettingsComponent } from "./ChatSettings";
import { ToolToggles } from "./ChatSettings/ToolToggles";
import { InlineResponseControls } from "./InlineResponseControls";
import { ModelSelector } from "./ModelSelector";
import { uploadComposerAttachment } from "./uploadAttachment";
import { useComposerCommandController } from "./useComposerCommandController";
import { useComposerShortcuts } from "./useComposerShortcuts";
import { useComposerSources } from "./useComposerSources";

export interface ChatInputHandle {
  focus: () => void;
}

const NEW_CONVERSATION_PLACEHOLDERS = [
  "Ask me anything...",
  "Say the word...",
  "Start with the messy version...",
  "Type it the way you’d say it...",
];

const FOLLOW_UP_PLACEHOLDERS = [
  "Ask follow-up questions...",
  "Keep the thread going...",
  "Push back, dig deeper, or change tack...",
];
const EMPTY_ATTACHMENTS: AttachmentData[] = [];

function getAttachmentIconAndLabel(attachment: AttachmentData) {
  if (attachment.type === "image") {
    return {
      preview: (
        <Image
          src={attachment.data}
          alt="Selected"
          className="h-4 w-4 rounded object-cover"
          crossOrigin="use-credentials"
        />
      ),
      label: "Image attached",
    };
  }

  if (attachment.type === "document" || attachment.type === "markdown_document") {
    return {
      preview: <File className="h-3.5 w-3.5" aria-hidden="true" />,
      label:
        attachment.type === "markdown_document"
          ? `${attachment.name || "Document"} (converted to text)`
          : attachment.name || "Document attached",
    };
  }

  if (attachment.type === "artifact_selection") {
    return {
      preview: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
      label: attachment.name,
    };
  }

  if (attachment.type === "audio") {
    return {
      preview: <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />,
      label: attachment.name || "Audio attached",
    };
  }

  return { preview: null, label: "" };
}

export interface ConversationRunSteering {
  placeholder: string;
  disabledReason?: string;
  isSubmitting?: boolean;
  onSubmit: (content: string) => Promise<void>;
}

interface ChatInputProps {
  goalState?: {
    canUseGoals: boolean;
    goal: { status: string } | null;
    onCommand?: (command: GoalCommand) => void;
  };
  handleSubmit: (attachments?: AttachmentData[]) => void | Promise<boolean>;
  isLoading: boolean;
  isSubmissionBlocked?: boolean;
  streamStarted: boolean;
  controller?: AbortController;
  onStopResponse?: () => void;
  onTranscribe: (data: { response: { content: string } }) => void;
  placeholder?: {
    newConversation: string;
    followUp: string;
  };
  controls?: ReactNode;
  modeControls?: {
    activeModeControls?: ReactNode;
    commands?: ComposerCommandAction[];
    includeSettingCommands?: boolean;
    onClearActive?: () => void;
  };
  modelProviderFilter?: string;
  modelScope?: ModelSelectorScope;
  onModelChange?: ModelSelectionChangeHandler;
  activeRunStatus?: ChatRunStatus | null;
  runSteering?: ConversationRunSteering;
  hasConversationHistory?: boolean;
  disableAttachments?: boolean;
  hideComposerActionMenu?: boolean;
  allowedAssistantActionCapabilities?: readonly ComposerAssistantActionCapability[];
  assistantActionCatalog?: ComposerActionCatalogConfig;
  toolSelectionLocked?: boolean;
  hideSubmitButton?: boolean;
  hideTextInput?: boolean;
  hideInlineResponseControls?: boolean;
  hideChatSettings?: boolean;
  hideModelSelector?: boolean;
  hideVoiceControls?: boolean;
  autoPlayResponses?: {
    enabled: boolean;
    isGenerating: boolean;
    isPlaying: boolean;
    onToggle: () => void;
  };
  contextAttachments?: AttachmentData[];
  readonlyContextAttachmentCount?: number;
  onRemoveContextAttachment?: (index: number) => void;
  onClearContextAttachments?: () => void;
  attachmentProjectId?: string;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  (
    {
      handleSubmit,
      goalState,
      isLoading,
      isSubmissionBlocked = false,
      streamStarted,
      controller,
      onStopResponse,
      onTranscribe,
      placeholder,
      controls,
      modeControls,
      modelProviderFilter,
      modelScope = "default",
      onModelChange,
      activeRunStatus,
      runSteering,
      hasConversationHistory = false,
      disableAttachments = false,
      hideComposerActionMenu = false,
      allowedAssistantActionCapabilities,
      assistantActionCatalog,
      toolSelectionLocked = false,
      hideSubmitButton = false,
      hideTextInput = false,
      hideInlineResponseControls = false,
      hideChatSettings = false,
      hideModelSelector = false,
      hideVoiceControls = false,
      autoPlayResponses,
      contextAttachments = EMPTY_ATTACHMENTS,
      readonlyContextAttachmentCount = 0,
      onRemoveContextAttachment,
      onClearContextAttachments,
      attachmentProjectId,
    },
    ref,
  ) => {
    const { isMobile } = useUIStore();
    const queryClient = useQueryClient();
    const {
      model,
      chatMode,
      isAuthenticationLoading,
      selectedTeammateId,
      selectedTeammateTokenPosition,
      selectedAssistantAction,
      setSelectedTeammateTokenPosition,
      setSelectedAssistantAction,
    } = useChatStore();
    const isPro = useChatStore((state) => state.isPro);
    const { currentConversationId } = useConversationScope();
    const { composerInput, setComposerInput } = useComposerDraft();
    const isComposingGoal = useChatStore((state) => state.isComposingGoal);
    const setComposingGoal = useChatStore((state) => state.setComposingGoal);
    const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecorder({
      onTranscribe,
    });
    const [selectedAttachments, setSelectedAttachments] = useState<AttachmentData[]>([]);
    const [placeholderSeed, setPlaceholderSeed] = useState(0);

    useEffect(() => {
      setPlaceholderSeed(Math.floor(Math.random() * 12));
    }, []);
    const { data: apiModels } = useModels();
    const [isUploading, setIsUploading] = useState(false);
    const modelCapabilities = useMemo(
      () => getModelInteractionCapabilities(model ? apiModels?.[model] : undefined),
      [apiModels, model],
    );
    const {
      isImageModel,
      isMultimodalModel,
      isTextToImageOnlyModel,
      supportsAudio,
      supportsDocuments,
      supportsToolCalls,
    } = modelCapabilities;
    const composerSources = useComposerSources({
      enabled: isPro,
      projectId: attachmentProjectId,
      capabilities: {
        supportsAudio,
        supportsDocuments,
        supportsImages: isImageModel || isMultimodalModel,
      },
    });
    const modelSelectionBlocked = Boolean(
      activeRunStatus && !isTerminalChatRunStatus(activeRunStatus),
    );
    const handleBeforeModelChange = useCallback(
      (_modelId: string, nextModel: ModelConfigItem) => {
        const attachmentTypes = [
          ...contextAttachments,
          ...composerSources.attachments,
          ...selectedAttachments,
        ].map((attachment) => attachment.type);
        const decision = evaluateModelContinuity({
          activeRunStatus,
          attachmentTypes,
          hasConversationHistory,
          nextModel,
        });

        if (decision.state !== "next_run") {
          toast.error(decision.reason);

          return false;
        }

        return true;
      },
      [
        activeRunStatus,
        composerSources.attachments,
        contextAttachments,
        hasConversationHistory,
        selectedAttachments,
      ],
    );

    const composerInputRef = useRef<TokenizedComposerInputHandle>(null);
    const [requestedComposerCursorPosition, setRequestedComposerCursorPosition] = useState<
      number | null
    >(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInputId = useId();
    const {
      applyDirectiveSelection,
      commandActions,
      commandState,
      directiveQuery,
      moveActiveSuggestion,
      setTextareaCursorPosition,
    } = useComposerCommandController({
      goalState,
      isLoading,
      allowedAssistantActionCapabilities,
      assistantActionCatalog,
      modeControls: {
        ...modeControls,
        includeSettingCommands: modeControls?.includeSettingCommands ?? !hideChatSettings,
      },
      onCursorPositionRequest: setRequestedComposerCursorPosition,
      toolSelectionLocked,
    });

    useLayoutEffect(() => {
      if (requestedComposerCursorPosition === null) {
        return;
      }

      composerInputRef.current?.setCursorPosition(requestedComposerCursorPosition);
      setTextareaCursorPosition(requestedComposerCursorPosition);
      setRequestedComposerCursorPosition(null);
    }, [requestedComposerCursorPosition, setTextareaCursorPosition]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (!hideTextInput) {
            composerInputRef.current?.focus();
          }
        },
      }),
      [hideTextInput],
    );

    const composerTokens = useMemo<ComposerInputToken[]>(() => {
      const tokens: ComposerInputToken[] = [];

      if (
        selectedAssistantAction?.item &&
        typeof selectedAssistantAction.tokenPosition === "number"
      ) {
        tokens.push({
          id: `action:${selectedAssistantAction.item.id}`,
          kind: "action",
          label: selectedAssistantAction.item.label,
          position: selectedAssistantAction.tokenPosition,
          text: selectedAssistantAction.tokenText,
        });
      }

      if (commandState.selectedTeammate && typeof selectedTeammateTokenPosition === "number") {
        tokens.push({
          id: `teammate:${commandState.selectedTeammate.id}`,
          kind: "teammate",
          label: commandState.selectedTeammate.name,
          position: selectedTeammateTokenPosition,
        });
      }

      return tokens;
    }, [commandState.selectedTeammate, selectedTeammateTokenPosition, selectedAssistantAction]);
    const hasInlineTeammateToken = composerTokens.some((token) => token.kind === "teammate");

    const handleComposerTokenPositionsChange = (positions: ComposerInputTokenPosition[]) => {
      const nextPositions = new Map(positions.map((position) => [position.id, position.position]));

      if (selectedAssistantAction?.item) {
        const tokenId = `action:${selectedAssistantAction.item.id}`;
        const nextPosition = nextPositions.get(tokenId);

        if (typeof nextPosition === "number") {
          if (selectedAssistantAction.tokenPosition !== nextPosition) {
            setSelectedAssistantAction({
              ...selectedAssistantAction,
              tokenPosition: nextPosition,
            });
          }
        } else if (typeof selectedAssistantAction.tokenPosition === "number") {
          setSelectedAssistantAction(null);
        }
      }

      if (selectedTeammateId) {
        const nextPosition = nextPositions.get(`teammate:${selectedTeammateId}`);

        if (typeof nextPosition === "number") {
          if (selectedTeammateTokenPosition !== nextPosition) {
            setSelectedTeammateTokenPosition(nextPosition);
          }
        } else if (typeof selectedTeammateTokenPosition === "number") {
          commandState.clearTeammate();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && directiveQuery) {
        const didMove = moveActiveSuggestion(e.key === "ArrowDown" ? 1 : -1);

        if (didMove) {
          e.preventDefault();

          return;
        }
      }

      if ((e.key === "Enter" || e.key === "Tab") && directiveQuery) {
        const didApplyDirective = applyDirectiveSelection();

        if (didApplyDirective) {
          e.preventDefault();

          return;
        }
      }

      if (
        e.key === "Backspace" &&
        composerInputRef.current?.getCursorPosition() === 0 &&
        modeControls?.onClearActive
      ) {
        e.preventDefault();
        modeControls.onClearActive();

        return;
      }

      if (isMobile && e.key === "Enter") {
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isComposerSubmitDisabled) {
          return;
        }

        void submitSelectedAttachments();
      }

      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        const cursorPosition =
          composerInputRef.current?.getCursorPosition() ?? composerInput.length;
        const textBeforeCursor = composerInput.substring(0, cursorPosition);
        const textAfterCursor = composerInput.substring(cursorPosition);

        setComposerInput(`${textBeforeCursor}\n${textAfterCursor}`);

        setTimeout(() => {
          composerInputRef.current?.setCursorPosition(cursorPosition + 1);
        }, 0);
      }
    };

    const handleComposerInput = (value: string) => setComposerInput(value);

    const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);

      if (files.length === 0) {
        return;
      }

      try {
        setIsUploading(true);
        const uploadedAttachments: AttachmentData[] = [];
        const uploadResults = await Promise.allSettled(
          files.map((file) =>
            uploadComposerAttachment(file, {
              isImageModel,
              isMultimodalModel,
              isTextToImageOnlyModel,
              supportsAudio,
              supportsDocuments,
              projectId: attachmentProjectId,
            }),
          ),
        );

        for (const result of uploadResults) {
          if (result.status === "rejected") {
            alert(
              `Failed to upload file: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`,
            );
            continue;
          }

          if ("error" in result.value) {
            alert(result.value.error);
          } else {
            uploadedAttachments.push(result.value.attachment);
          }
        }

        if (uploadedAttachments.length > 0) {
          setSelectedAttachments((currentAttachments) => [
            ...currentAttachments,
            ...uploadedAttachments,
          ]);
          await queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all });
        }
      } catch (error) {
        console.error("Failed to upload file:", error);
        alert(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    const clearSelectedAttachments = () => {
      setSelectedAttachments([]);
      composerSources.clearAttachments();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    const removeSelectedAttachment = (indexToRemove: number) => {
      setSelectedAttachments((currentAttachments) =>
        currentAttachments.filter((_, index) => index !== indexToRemove),
      );
    };

    const submitSelectedAttachments = async () => {
      const combinedAttachments = [
        ...contextAttachments,
        ...composerSources.attachments,
        ...selectedAttachments,
      ];
      const attachments = combinedAttachments.length > 0 ? combinedAttachments : undefined;
      const submitResult = handleSubmit(attachments);

      if (submitResult && typeof submitResult.then === "function") {
        const didSubmit = await submitResult;

        if (!didSubmit) {
          return;
        }
      }

      clearSelectedAttachments();
      onClearContextAttachments?.();
    };

    const getFileTypeAccept = () => {
      if (isImageModel) {
        return "image/*";
      }

      const fileTypes = [
        "text/markdown",
        "text/html",
        "application/xml",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel.sheet.macroenabled.12",
        "application/vnd.ms-excel.sheet.binary.macroenabled.12",
        "application/vnd.ms-excel",
        "application/vnd.oasis.opendocument.spreadsheet",
        "text/csv",
        "application/vnd.apple.numbers",
        "application/pdf",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".py",
        ".go",
        ".java",
        ".rb",
        ".php",
        ".rs",
        ".cs",
        ".kt",
        ".swift",
        ".scala",
        ".sh",
        ".yml",
        ".yaml",
        ".sql",
        ".toml",
        ".c",
        ".cc",
        ".cpp",
        ".cxx",
        ".hpp",
        ".h",
        "text/javascript",
        "application/javascript",
        "text/typescript",
        "application/typescript",
        "text/plain",
        "application/json",
      ];

      if (isMultimodalModel) {
        fileTypes.push("image/*");
      }

      if (supportsAudio) {
        fileTypes.push("audio/*");
      }

      return fileTypes.join(",");
    };

    const canUploadFiles = !disableAttachments && !isTextToImageOnlyModel;

    const contextAttachmentChips = contextAttachments.flatMap((attachment, index) => {
      const { preview, label } = getAttachmentIconAndLabel(attachment);

      return preview
        ? [
            {
              id: `context-${index}-${attachment.type}`,
              label,
              onClear:
                index < readonlyContextAttachmentCount
                  ? undefined
                  : () => onRemoveContextAttachment?.(index),
              preview,
            },
          ]
        : [];
    });

    const selectedAttachmentChips = selectedAttachments.flatMap((attachment, index) => {
      const { preview, label } = getAttachmentIconAndLabel(attachment);

      return preview
        ? [
            {
              id: `selected-${index}-${attachment.type}`,
              label,
              onClear: () => removeSelectedAttachment(index),
              preview,
            },
          ]
        : [];
    });
    const sourceAttachmentChips = composerSources.attachments.flatMap((attachment, index) => {
      const { preview, label } = getAttachmentIconAndLabel(attachment);

      return preview
        ? [
            {
              id: `source-${index}-${attachment.type}`,
              label,
              onClear: () => composerSources.removeAttachment(index),
              preview,
            },
          ]
        : [];
    });
    const attachmentChips = [
      ...contextAttachmentChips,
      ...sourceAttachmentChips,
      ...selectedAttachmentChips,
    ];

    const isToolSelectionLocked =
      toolSelectionLocked || (chatMode === "agent" && selectedTeammateId !== null);
    const canUseProComposerActions = isPro;
    const showInlineMultiModelToggle = isPro && !model && chatMode === "remote";
    const canShowToolMenu =
      !isToolSelectionLocked && (showInlineMultiModelToggle || supportsToolCalls);
    const canShowActionMenu =
      Boolean(directiveQuery) ||
      canUseProComposerActions ||
      canShowToolMenu ||
      commandActions.actionItems.length > 0;
    const liveModeCommand = commandActions.modeCommands.find(
      (command) => command.command === "live",
    );
    const chatModeCommand = commandActions.modeCommands.find(
      (command) => command.command === "chat",
    );
    const handleLiveToggle = useCallback(() => {
      const command = liveModeCommand?.isActive ? chatModeCommand : liveModeCommand;

      if (command && !command.disabled) {
        commandActions.selectSlashCommand(command);
      }
    }, [chatModeCommand, commandActions, liveModeCommand]);
    const canUseDictation = canUseProComposerActions && !liveModeCommand?.isActive;
    const shouldRenderInputControls = hideTextInput && controls;
    const isSteering = Boolean(runSteering);
    const isSteeringBlocked = Boolean(runSteering?.disabledReason);
    const isInputDisabled = isSteering ? isSteeringBlocked : isLoading;
    const isStoppable =
      !isSteering && isLoading && streamStarted && Boolean(onStopResponse || controller);
    const showComposerActionMenu = !hideComposerActionMenu && canShowActionMenu;
    const showVoiceControls = !hideVoiceControls && Boolean(canUseDictation || liveModeCommand);
    const hasComposerActions =
      isStoppable || showComposerActionMenu || showVoiceControls || !hideSubmitButton;
    const showFooterControls = Boolean(!hideTextInput && controls);
    const hasFooterStart = !hideModelSelector || !hideInlineResponseControls || showFooterControls;
    const isComposerSubmitDisabled =
      (!composerInput?.trim() &&
        !selectedAssistantAction?.item &&
        selectedAttachments.length === 0 &&
        composerSources.attachments.length === 0) ||
      isInputDisabled ||
      Boolean(runSteering?.isSubmitting) ||
      isUploading ||
      isAuthenticationLoading ||
      isSubmissionBlocked;

    useComposerShortcuts({
      dictate: canUseDictation
        ? {
            enabled: !isLoading && !isAuthenticationLoading && !isTranscribing,
            isRecording,
            onStart: startRecording,
            onStop: stopRecording,
          }
        : undefined,
      live: liveModeCommand
        ? {
            enabled: !isLoading && !liveModeCommand.disabled,
            onToggle: handleLiveToggle,
          }
        : undefined,
    });

    return (
      <ComposerCommandActionsProvider actions={commandActions}>
        <ComposerShell
          isGeneratingAudio={!!autoPlayResponses?.isGenerating}
          chips={
            <ComposerCommandChips
              {...commandState}
              attachments={attachmentChips}
              goal={
                isComposingGoal
                  ? {
                      label: goalState?.goal ? "Replacing goal" : "Setting a goal",
                      onClear: () => setComposingGoal(false),
                    }
                  : undefined
              }
              hideTeammateChip={hasInlineTeammateToken}
              onClearMode={modeControls?.onClearActive}
            />
          }
          fileInput={
            canUploadFiles ? (
              <input
                type="file"
                ref={fileInputRef}
                accept={getFileTypeAccept()}
                onChange={(event) => void handleFileUpload(event)}
                className="hidden"
                id={fileInputId}
                aria-label="Upload a file (images, documents, audio, and code)"
                multiple
              />
            ) : undefined
          }
          suggestions={
            <ComposerDirectiveMenu
              activeSuggestionIndex={commandState.activeSuggestionIndex}
              directive={directiveQuery}
              isDisabled={commandState.isDisabled}
              onActiveSuggestionIndexChange={commandState.onActiveSuggestionIndexChange}
              onActionItemSelect={commandState.onActionItemSelect}
              onSlashCommandBack={commandState.onSlashCommandBack}
              onSlashCommandSelect={commandState.onSlashCommandSelect}
            />
          }
          leadingControls={shouldRenderInputControls ? controls : undefined}
          inputHelp={
            hideTextInput
              ? undefined
              : isSteering
                ? "Type an instruction and press Enter to send it. The run picks it up at the next safe boundary."
                : "Type your message and press Enter to send. Use Shift+Enter for a new line."
          }
          input={
            hideTextInput ? undefined : (
              <TokenizedComposerInput
                id="message-input"
                ref={composerInputRef}
                value={composerInput}
                tokens={composerTokens}
                onChange={handleComposerInput}
                onCursorPositionChange={setTextareaCursorPosition}
                onTokenPositionsChange={handleComposerTokenPositionsChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  runSteering
                    ? (runSteering.disabledReason ?? runSteering.placeholder)
                    : isComposingGoal
                      ? "Describe what done looks like..."
                      : !currentConversationId
                        ? (placeholder?.newConversation ??
                          NEW_CONVERSATION_PLACEHOLDERS[
                            placeholderSeed % NEW_CONVERSATION_PLACEHOLDERS.length
                          ])
                        : (placeholder?.followUp ??
                          FOLLOW_UP_PLACEHOLDERS[placeholderSeed % FOLLOW_UP_PLACEHOLDERS.length])
                }
                disabled={
                  isRecording || isTranscribing || isInputDisabled || isAuthenticationLoading
                }
                ariaLabel="Message input"
                ariaDescribedBy="message-input-help"
              />
            )
          }
          actions={
            !hasComposerActions ? undefined : isStoppable ? (
              <Button
                type="button"
                onClick={() => (onStopResponse ? onStopResponse() : controller?.abort())}
                variant="icon"
                className="cursor-pointer rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Pause className="h-5 w-5" />
              </Button>
            ) : (
              <>
                {showComposerActionMenu && (
                  <ComposerActionMenu
                    autoPlayResponses={canUseProComposerActions ? autoPlayResponses : undefined}
                    attachingSourceId={composerSources.attachingSourceId}
                    canAttachSources={canUseProComposerActions}
                    canUploadFiles={canUseProComposerActions && canUploadFiles}
                    directive={directiveQuery}
                    isDisabled={isLoading}
                    isLoadingSources={composerSources.isLoading}
                    isUploading={isUploading}
                    onUploadClick={() => fileInputRef.current?.click()}
                    onAttachSource={composerSources.attachSource}
                    sourceScopeLabel={attachmentProjectId ? "Project sources" : "Personal sources"}
                    sources={composerSources.availableSources}
                    tools={
                      canShowToolMenu ? (
                        <ToolToggles
                          isDisabled={isLoading || isToolSelectionLocked}
                          showHeading={false}
                        />
                      ) : undefined
                    }
                    uploadIcon={<Paperclip className="h-4 w-4" aria-hidden="true" />}
                    uploadLabel={`Upload ${isMultimodalModel || supportsAudio ? "files (images, audio, documents, code)" : "a Document or Code file"}`}
                  />
                )}
                {showVoiceControls && (
                  <ComposerVoiceControls
                    className={liveModeCommand?.isActive ? "-ml-2" : undefined}
                    dictate={
                      canUseDictation
                        ? {
                            disabled: isLoading || isAuthenticationLoading,
                            isRecording,
                            isTranscribing,
                            onStart: startRecording,
                            onStop: stopRecording,
                          }
                        : undefined
                    }
                    live={
                      liveModeCommand
                        ? {
                            disabled: isLoading || Boolean(liveModeCommand.disabled),
                            isActive: liveModeCommand.isActive,
                            onToggle: handleLiveToggle,
                          }
                        : undefined
                    }
                  />
                )}
                {!hideSubmitButton && (
                  <Button
                    type="submit"
                    onClick={() => void submitSelectedAttachments()}
                    disabled={isComposerSubmitDisabled}
                    className="cursor-pointer rounded-md bg-human-action p-2.5 text-human-action-foreground shadow-sm transition-colors hover:bg-human-action/90 disabled:cursor-not-allowed disabled:opacity-50"
                    title={isSteering ? "Send instruction" : "Send message"}
                    aria-label={isSteering ? "Send instruction" : "Send message"}
                  >
                    <Send className="h-5 w-5" />
                    <span className="sr-only">
                      {isSteering ? "Send instruction" : "Send message"}
                    </span>
                  </Button>
                )}
              </>
            )
          }
          footerStart={
            hasFooterStart ? (
              <>
                {!hideModelSelector && (
                  <div className="min-w-0 flex-shrink">
                    <ModelSelector
                      isDisabled={isLoading || modelSelectionBlocked}
                      mono
                      modelProviderFilter={modelProviderFilter}
                      modelScope={modelScope}
                      onModelChange={onModelChange}
                      onBeforeModelChange={handleBeforeModelChange}
                    />
                  </div>
                )}
                {!hideInlineResponseControls && <InlineResponseControls isDisabled={isLoading} />}
                {showFooterControls && <div className="shrink-0">{controls}</div>}
              </>
            ) : undefined
          }
          footerEnd={
            hideChatSettings ? undefined : <ChatSettingsComponent isDisabled={isLoading} />
          }
        />
      </ComposerCommandActionsProvider>
    );
  },
);
