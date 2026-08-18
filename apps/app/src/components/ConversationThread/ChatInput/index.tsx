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
  ComposerCommandButton,
  ComposerCommandChips,
  ComposerShell,
  ComposerCommandSuggestions,
} from "@ngriffin_uk/polychat-component-conversation";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import { getModelInteractionCapabilities } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { File, FileText, Paperclip, Pause, Send, Volume2 } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { useModels } from "~/hooks/useModels";
import { SOURCE_QUERY_KEYS } from "~/hooks/useSources";
import { useVoiceRecorder } from "~/hooks/useVoiceRecorder";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import type { ModelSelectionChangeHandler, ModelSelectorScope } from "~/types";

import { ChatSettings as ChatSettingsComponent } from "./ChatSettings";
import { ToolToggles } from "./ChatSettings/ToolToggles";
import { InlineResponseControls } from "./InlineResponseControls";
import { ModelSelector } from "./ModelSelector";
import { uploadComposerAttachment } from "./uploadAttachment";
import { useComposerCommandController } from "./useComposerCommandController";
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

interface ChatInputProps {
  handleSubmit: (attachments?: AttachmentData[]) => void | Promise<boolean>;
  isLoading: boolean;
  streamStarted: boolean;
  controller: AbortController;
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
  disableAttachments?: boolean;
  hideDefaultControls?: boolean;
  hideComposerActionMenu?: boolean;
  allowedAssistantActionCapabilities?: readonly ComposerAssistantActionCapability[];
  assistantActionCatalog?: ComposerActionCatalogConfig;
  toolSelectionLocked?: boolean;
  hideSubmitButton?: boolean;
  hideTextInput?: boolean;
  hideInlineResponseControls?: boolean;
  hideChatSettings?: boolean;
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
      isLoading,
      streamStarted,
      controller,
      onTranscribe,
      placeholder,
      controls,
      modeControls,
      modelProviderFilter,
      modelScope = "default",
      onModelChange,
      disableAttachments = false,
      hideDefaultControls = false,
      hideComposerActionMenu = false,
      allowedAssistantActionCapabilities,
      assistantActionCatalog,
      toolSelectionLocked = false,
      hideSubmitButton = false,
      hideTextInput = false,
      hideInlineResponseControls = false,
      hideChatSettings = false,
      autoPlayResponses,
      contextAttachments = [],
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
      chatInput,
      setChatInput,
      chatMode,
      isAuthenticationLoading,
      selectedAgentId,
      selectedAgentTokenPosition,
      selectedAssistantAction,
      setSelectedAgentTokenPosition,
      setSelectedAssistantAction,
    } = useChatStore();
    const { isPro, currentConversationId } = useChatStore();
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

    const composerInputRef = useRef<TokenizedComposerInputHandle>(null);
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
      isLoading,
      allowedAssistantActionCapabilities,
      assistantActionCatalog,
      modeControls: {
        ...modeControls,
        includeSettingCommands: modeControls?.includeSettingCommands ?? !hideChatSettings,
      },
      toolSelectionLocked,
    });

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

      if (commandState.selectedAgent && typeof selectedAgentTokenPosition === "number") {
        tokens.push({
          id: `agent:${commandState.selectedAgent.id}`,
          kind: "agent",
          label: commandState.selectedAgent.name,
          position: selectedAgentTokenPosition,
        });
      }

      return tokens;
    }, [commandState.selectedAgent, selectedAgentTokenPosition, selectedAssistantAction]);
    const hasInlineAgentToken = composerTokens.some((token) => token.kind === "agent");

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

      if (selectedAgentId) {
        const nextPosition = nextPositions.get(`agent:${selectedAgentId}`);

        if (typeof nextPosition === "number") {
          if (selectedAgentTokenPosition !== nextPosition) {
            setSelectedAgentTokenPosition(nextPosition);
          }
        } else if (typeof selectedAgentTokenPosition === "number") {
          commandState.clearAgent();
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
        const cursorPosition = composerInputRef.current?.getCursorPosition() ?? chatInput.length;
        const textBeforeCursor = chatInput.substring(0, cursorPosition);
        const textAfterCursor = chatInput.substring(cursorPosition);

        setChatInput(`${textBeforeCursor}\n${textAfterCursor}`);

        setTimeout(() => {
          composerInputRef.current?.setCursorPosition(cursorPosition + 1);
        }, 0);
      }
    };

    const handleComposerInput = (value: string) => setChatInput(value);

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

    const getAttachmentIconAndLabel = (attachment: AttachmentData) => {
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
    };

    const canUploadFiles = !disableAttachments && !isTextToImageOnlyModel;

    const contextAttachmentChips = contextAttachments.flatMap((attachment, index) => {
      const { preview, label } = getAttachmentIconAndLabel(attachment);

      return preview
        ? [
            {
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
      toolSelectionLocked || (chatMode === "agent" && selectedAgentId !== null);
    const canUseProComposerActions = isPro;
    const showInlineMultiModelToggle = isPro && !model && chatMode === "remote";
    const canShowToolMenu =
      !isToolSelectionLocked && (showInlineMultiModelToggle || supportsToolCalls);
    const canShowActionMenu = canUseProComposerActions || canShowToolMenu;
    const shouldRenderInputControls = hideTextInput && controls;
    const isComposerSubmitDisabled =
      (!chatInput?.trim() &&
        !selectedAssistantAction?.item &&
        selectedAttachments.length === 0 &&
        composerSources.attachments.length === 0) ||
      isLoading ||
      isUploading ||
      isAuthenticationLoading;

    return (
      <ComposerCommandActionsProvider actions={commandActions}>
        <ComposerShell
          isGeneratingAudio={!!autoPlayResponses?.isGenerating}
          chips={
            <ComposerCommandChips
              {...commandState}
              attachments={attachmentChips}
              hideAgentChip={hasInlineAgentToken}
              onClearMode={modeControls?.onClearActive}
            />
          }
          fileInput={
            canUploadFiles ? (
              <input
                type="file"
                ref={fileInputRef}
                accept={getFileTypeAccept()}
                onChange={handleFileUpload}
                className="hidden"
                id={fileInputId}
                aria-label="Upload a file (images, documents, audio, and code)"
                multiple
              />
            ) : undefined
          }
          suggestions={<ComposerCommandSuggestions {...commandState} />}
          leadingControls={shouldRenderInputControls ? controls : undefined}
          inputHelp={
            hideTextInput
              ? undefined
              : "Type your message and press Enter to send. Use Shift+Enter for a new line."
          }
          input={
            hideTextInput ? undefined : (
              <TokenizedComposerInput
                id="message-input"
                ref={composerInputRef}
                value={chatInput}
                tokens={composerTokens}
                onChange={handleComposerInput}
                onCursorPositionChange={setTextareaCursorPosition}
                onTokenPositionsChange={handleComposerTokenPositionsChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  !currentConversationId
                    ? (placeholder?.newConversation ??
                      NEW_CONVERSATION_PLACEHOLDERS[
                        placeholderSeed % NEW_CONVERSATION_PLACEHOLDERS.length
                      ])
                    : (placeholder?.followUp ??
                      FOLLOW_UP_PLACEHOLDERS[placeholderSeed % FOLLOW_UP_PLACEHOLDERS.length])
                }
                disabled={isRecording || isTranscribing || isLoading || isAuthenticationLoading}
                ariaLabel="Message input"
                ariaDescribedBy="message-input-help"
              />
            )
          }
          actions={
            hideDefaultControls ? undefined : (
              <>
                {isLoading && streamStarted ? (
                  <Button
                    type="button"
                    onClick={() => controller.abort()}
                    variant="icon"
                    className="cursor-pointer p-2 hover:bg-off-white-highlight dark:hover:bg-zinc-800 rounded-md text-zinc-600 dark:text-zinc-400"
                    title="Stop generating"
                    aria-label="Stop generating"
                  >
                    <Pause className="h-5 w-5" />
                  </Button>
                ) : (
                  <>
                    {!hideComposerActionMenu && canShowActionMenu && (
                      <ComposerActionMenu
                        autoPlayResponses={canUseProComposerActions ? autoPlayResponses : undefined}
                        attachingSourceId={composerSources.attachingSourceId}
                        canAttachSources={canUseProComposerActions}
                        canUseVoice={canUseProComposerActions}
                        canUploadFiles={canUseProComposerActions && canUploadFiles}
                        isDisabled={isLoading}
                        isLoadingSources={composerSources.isLoading}
                        isRecording={isRecording}
                        isTranscribing={isTranscribing}
                        isUploading={isUploading}
                        onStartRecording={startRecording}
                        onStopRecording={stopRecording}
                        onUploadClick={() => fileInputRef.current?.click()}
                        onAttachSource={composerSources.attachSource}
                        sourceScopeLabel={
                          attachmentProjectId ? "Project sources" : "Personal sources"
                        }
                        sources={composerSources.availableSources}
                        tools={
                          canShowToolMenu ? (
                            <ToolToggles isDisabled={isLoading || isToolSelectionLocked} />
                          ) : undefined
                        }
                        uploadIcon={<Paperclip className="h-4 w-4" aria-hidden="true" />}
                        uploadLabel={`Upload ${isMultimodalModel || supportsAudio ? "files (images, audio, documents, code)" : "a Document or Code file"}`}
                      />
                    )}
                    <ComposerCommandButton {...commandState} />
                    {!hideSubmitButton && (
                      <Button
                        type="submit"
                        onClick={submitSelectedAttachments}
                        disabled={isComposerSubmitDisabled}
                        className="cursor-pointer p-2.5 bg-black hover:bg-zinc-800 dark:bg-off-white dark:hover:bg-zinc-200 rounded-md text-white dark:text-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Send message"
                        aria-label="Send message"
                      >
                        <Send className="h-5 w-5" />
                        <span className="sr-only">Send message</span>
                      </Button>
                    )}
                  </>
                )}
              </>
            )
          }
          footerOverride={
            hideDefaultControls && controls && !shouldRenderInputControls ? (
              <div>{controls}</div>
            ) : undefined
          }
          footerStart={
            hideDefaultControls ? undefined : (
              <>
                <div className="min-w-0 flex-shrink">
                  <ModelSelector
                    isDisabled={isLoading}
                    mono
                    modelProviderFilter={modelProviderFilter}
                    modelScope={modelScope}
                    onModelChange={onModelChange}
                  />
                </div>
                {!hideInlineResponseControls && <InlineResponseControls isDisabled={isLoading} />}
                {!hideTextInput && controls && <div className="shrink-0">{controls}</div>}
              </>
            )
          }
          footerEnd={
            hideDefaultControls || hideChatSettings ? undefined : (
              <ChatSettingsComponent
                isDisabled={isLoading}
                toolSelectionLocked={isToolSelectionLocked}
                supportsToolCalls={supportsToolCalls}
              />
            )
          }
        />
      </ComposerCommandActionsProvider>
    );
  },
);
