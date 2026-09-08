import type {
  ArtifactProps,
  ToolInteractionHandler,
} from "@ngriffin_uk/polychat-component-content";
import { collectResolvedToolCallIds } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import type { ConversationRetention } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  getCompactionMessageLabel,
  getCompactionCoverageDetail,
  isCompactionLoadingMessage,
} from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import { getGoalMessageMarker } from "@ngriffin_uk/polychat-library-chat/message-goal-status";
import {
  applyToolInteractionResolutions,
  isHiddenToolResponse,
} from "@ngriffin_uk/polychat-library-chat/tool-results";
import { useChatStore, useStreamActivityStore } from "@ngriffin_uk/polychat-library-client";
import {
  useCanAccessProFeatures,
  useChat,
  useLoadEarlierChatMessages,
  useChatManager,
  useModels,
  useSavedMessages,
  useWebLLMModels,
  useIsLoading,
  useLoadingMessage,
  useLoadingProgress,
  useConversationScope,
} from "@ngriffin_uk/polychat-library-react";
import {
  createModelReferenceMap,
  EMPTY_MODEL_CONFIG,
  getAvailableModels,
  getModelByReference,
} from "@ngriffin_uk/polychat-schemas";
import type { ChatMessageSelection } from "@ngriffin_uk/polychat-schemas";
import { Ghost, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { VList } from "virtua";

import { CompactionStatusRow } from "../CompactionStatusRow.js";
import { GoalStatusRow } from "../GoalStatusRow.js";
import { isRenderableMessage } from "../Message/ChatMessageView.js";
import { MessageSkeleton } from "../Message/MessageSkeleton.js";
import { ResolvedToolCallsProvider } from "../Message/ResolvedToolCalls.js";
import { StreamActivityIndicator } from "../Message/StreamActivityIndicator.js";
import { getMessageListScrollKey } from "../messageListScroll.js";
import { ScrollButton } from "../ScrollButton.js";
import { ChatMessage } from "./ChatMessage/index.js";
import { useStickToBottom } from "./useStickToBottom.js";
import { useStreamAnnouncement } from "./useStreamAnnouncement.js";

const EMPTY_MESSAGES: Message[] = [];
const SKELETON_COUNT = 3;

interface MessageListProps {
  onToolInteraction?: ToolInteractionHandler;
  onConnectorApproval?: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
  onArtifactOpen?: (
    artifact: ArtifactProps,
    combine?: boolean,
    artifacts?: ArtifactProps[],
  ) => void;
  messages?: Message[];
  isSharedView?: boolean;
  onStartThread?: (messageId: string, modelId?: string) => void;
  isStartingThread?: boolean;
  onRequestSecondOpinion?: (messageId: string) => void;
  isRequestingSecondOpinion?: boolean;
  onQuoteSelection?: (selection: ChatMessageSelection) => void;
  hideInlineUserQuestions?: boolean;
  retention?: ConversationRetention;
}

function hasCurrentResponseCompactionMarker(messages: Message[]): boolean {
  for (let index = messages.length - 1; index > 0; index--) {
    if (messages[index]?.role === "assistant") {
      const previousMessage = messages[index - 1];

      return previousMessage ? Boolean(getCompactionMessageLabel(previousMessage)) : false;
    }
  }

  return false;
}

export const MessageList = ({
  onToolInteraction,
  onConnectorApproval,
  onArtifactOpen,
  messages: propMessages,
  isSharedView = false,
  onStartThread,
  isStartingThread = false,
  onRequestSecondOpinion,
  isRequestingSecondOpinion = false,
  onQuoteSelection,
  hideInlineUserQuestions = false,
  retention = "kept",
}: MessageListProps) => {
  const computeSite = useChatStore((state) => state.computeSite);
  const { currentConversationId } = useConversationScope();
  const savedMessages = useSavedMessages(Boolean(currentConversationId));

  const { data: conversation, isLoading: isLoadingConversation } = useChat(
    !isSharedView ? currentConversationId : undefined,
  );
  const earlierMessages = useLoadEarlierChatMessages(
    !isSharedView ? currentConversationId : undefined,
  );
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const webLLMModels = useWebLLMModels({ enabled: computeSite === "browser" });
  const canAccessProFeatures = useCanAccessProFeatures();

  const {
    streamStarted,
    retryMessage,
    updateUserMessage,
    editingMessageId,
    startEditingMessage,
    stopEditingMessage,
  } = useChatManager();

  const sourceMessages = propMessages ?? conversation?.messages ?? EMPTY_MESSAGES;
  const isTemporary = retention === "temporary";
  const messages = useMemo(() => applyToolInteractionResolutions(sourceMessages), [sourceMessages]);
  const resolvedToolCallIds = useMemo(() => collectResolvedToolCallIds(messages), [messages]);
  const availableModels = useMemo(
    () => getAvailableModels(apiModels, computeSite === "browser", webLLMModels),
    [apiModels, computeSite, webLLMModels],
  );
  const modelReferences = useMemo(
    () => createModelReferenceMap(availableModels),
    [availableModels],
  );
  const lastMessageScrollKey = useMemo(
    () => getMessageListScrollKey({ conversationId: currentConversationId, messages }),
    [currentConversationId, messages],
  );

  const currentStream = useStreamActivityStore((state) =>
    currentConversationId ? state.streams[currentConversationId] : undefined,
  );
  const streamActivity = currentStream?.activity ?? null;
  const responseDurations = useStreamActivityStore((state) => state.responseDurations);

  const isStreamLoading = currentStream?.status === "streaming";
  let generatingAssistantMessageIndex = -1;

  if (isStreamLoading || streamStarted) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") {
        generatingAssistantMessageIndex = index;
        break;
      }
    }
  }

  const isModelInitializing = useIsLoading("model-init");

  const streamLoadingMessage = currentStream?.loadingMessage || "Generating response...";
  const modelInitMessage = useLoadingMessage("model-init") || "Initializing model...";
  const modelInitProgress = useLoadingProgress("model-init") || 0;
  const showCompactionLoadingDivider =
    isCompactionLoadingMessage(streamLoadingMessage) &&
    !hasCurrentResponseCompactionMarker(messages);
  const latestCompactionMarkerIndex = useMemo(
    () =>
      messages.reduce(
        (latestIndex, message, index) => (getCompactionMessageLabel(message) ? index : latestIndex),
        -1,
      ),
    [messages],
  );

  const visibleRows = useMemo(
    () =>
      messages
        .map((message, index) => ({
          message,
          index,
          compactionLabel: getCompactionMessageLabel(message),
          compactionDetail: getCompactionCoverageDetail(message),
          goalMarker: getGoalMessageMarker(message),
          goalStarted:
            message.role === "user" && getGoalMessageMarker(messages[index - 1])?.event === "set",
        }))
        .filter(
          ({ message, index, compactionLabel, goalMarker }) =>
            !(
              hideInlineUserQuestions &&
              message.role === "tool" &&
              message.name === "ask_user" &&
              message.status === "pending"
            ) &&
            !(goalMarker?.event === "set" && messages[index + 1]?.role === "user") &&
            (Boolean(compactionLabel) ||
              Boolean(goalMarker) ||
              (!isHiddenToolResponse(message) &&
                isRenderableMessage(message, resolvedToolCallIds))),
        ),
    [hideInlineUserQuestions, messages, resolvedToolCallIds],
  );

  const streamAnnouncement = useStreamAnnouncement({
    messages,
    isStreaming: !isSharedView && (isStreamLoading || streamStarted),
  });

  const showTemporaryNotice = isTemporary && !isSharedView;
  const showLoadEarlier = !isSharedView && Boolean(conversation?.has_more_messages);
  const showSkeletons = !isSharedView && isLoadingConversation;
  const showStreamRow =
    !isSharedView &&
    (isStreamLoading || streamStarted) &&
    (isCompactionLoadingMessage(streamLoadingMessage) ? showCompactionLoadingDivider : true);
  const showModelInitRow = !isSharedView && isModelInitializing;

  const rowCount =
    (showTemporaryNotice ? 1 : 0) +
    (showLoadEarlier ? 1 : 0) +
    (showSkeletons ? SKELETON_COUNT : visibleRows.length) +
    (showStreamRow ? 1 : 0) +
    (showModelInitRow ? 1 : 0);

  const lastUserMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        return messages[index].id;
      }
    }

    return undefined;
  }, [messages]);

  const { listRef, viewportRef, showScrollButton, handleScroll, scrollToBottom } = useStickToBottom(
    {
      enabled: !isSharedView,
      rowCount,
      followKey: `${lastMessageScrollKey}:${showStreamRow ? streamLoadingMessage : ""}:${
        currentStream?.turnActivity?.label ?? ""
      }`,
      resetKey: `${currentConversationId ?? "new"}:${lastUserMessageId ?? ""}`,
    },
  );

  return (
    <ResolvedToolCallsProvider resolvedToolCallIds={resolvedToolCallIds}>
      <section
        className={`relative flex flex-1 flex-col border-l-2 pl-3 ${
          isTemporary ? "border-dotted border-muted-foreground/50" : "border-none"
        }`}
        ref={viewportRef}
        data-conversation-id={currentConversationId || undefined}
        data-retention={retention}
        aria-label="Conversation messages"
      >
        <output className="sr-only" aria-live="polite">
          {streamAnnouncement}
        </output>
        <VList
          ref={listRef}
          data-header-scroll-source
          className="h-full w-full flex-1 overflow-auto pt-4 pr-2"
          onScroll={handleScroll}
        >
          {showTemporaryNotice ? (
            <div
              data-temporary-notice="start"
              className="mb-4 flex items-center gap-2 px-1 text-xs text-muted-foreground"
            >
              <Ghost size={14} aria-hidden="true" />
              <span>Temporary. Nothing here is kept.</span>
            </div>
          ) : null}
          {showLoadEarlier ? (
            <div className="flex justify-center pb-4">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-selection hover:text-foreground disabled:opacity-60"
                disabled={earlierMessages.isPending}
                onClick={() => earlierMessages.mutate()}
              >
                {earlierMessages.isPending ? "Loading earlier messages…" : "Load earlier messages"}
              </button>
            </div>
          ) : null}
          {showSkeletons
            ? [...Array(SKELETON_COUNT)].map((_, i) => (
                <MessageSkeleton key={`skeleton-item-${i}`} />
              ))
            : visibleRows.map(
                ({
                  message,
                  index,
                  compactionLabel,
                  compactionDetail,
                  goalMarker,
                  goalStarted,
                }) => {
                  return (
                    <div key={message.id || `message-${index}`} className="pb-4">
                      {goalMarker ? (
                        <GoalStatusRow label={goalMarker.label} objective={goalMarker.objective} />
                      ) : compactionLabel ? (
                        <CompactionStatusRow label={compactionLabel} detail={compactionDetail} />
                      ) : (
                        <ChatMessage
                          conversationId={currentConversationId}
                          canSubmitFeedback={Boolean(conversation && !conversation.isLocalOnly)}
                          message={message}
                          isTemporary={isTemporary}
                          isGenerating={index === generatingAssistantMessageIndex}
                          modelConfig={getModelByReference(modelReferences, message.model)}
                          onToolInteraction={onToolInteraction}
                          onConnectorApproval={onConnectorApproval}
                          onArtifactOpen={onArtifactOpen}
                          isSharedView={isSharedView}
                          onRetry={(messageId) => void retryMessage(messageId)}
                          isRetrying={streamStarted}
                          onEdit={message.id ? () => startEditingMessage(message.id) : undefined}
                          isEditing={editingMessageId === message.id}
                          onSaveEdit={(newContent) => {
                            if (message.id) {
                              void updateUserMessage(message.id, newContent);
                              stopEditingMessage();
                            }
                          }}
                          onCancelEdit={stopEditingMessage}
                          onStartThread={onStartThread}
                          isStartingThread={isStartingThread}
                          isSaved={savedMessages.savedIds.has(message.id)}
                          onToggleSaved={
                            currentConversationId
                              ? (messageId, isSaved) =>
                                  savedMessages.toggle(currentConversationId, messageId, isSaved)
                              : undefined
                          }
                          onRequestSecondOpinion={
                            canAccessProFeatures ? onRequestSecondOpinion : undefined
                          }
                          onQuoteSelection={onQuoteSelection}
                          isRequestingSecondOpinion={isRequestingSecondOpinion}
                          isArchivedByCompaction={
                            latestCompactionMarkerIndex !== -1 &&
                            index < latestCompactionMarkerIndex
                          }
                          responseDurationMs={responseDurations[message.id]}
                          goalStarted={goalStarted}
                        />
                      )}
                    </div>
                  );
                },
              )}
          {showStreamRow ? (
            isCompactionLoadingMessage(streamLoadingMessage) ? (
              <CompactionStatusRow label={streamLoadingMessage} pending />
            ) : (
              <StreamActivityIndicator
                label={streamLoadingMessage}
                activity={streamActivity}
                turnActivity={currentStream?.turnActivity}
              />
            )
          ) : null}
          {showModelInitRow && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-active-work" />
              <span>
                {modelInitMessage}
                {modelInitProgress !== undefined ? ` ${Math.round(modelInitProgress)}%` : null}
              </span>
            </div>
          )}
        </VList>
        {showTemporaryNotice ? (
          <div
            data-temporary-notice="end"
            className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-surface px-1 py-2 text-xs text-muted-foreground"
          >
            <Ghost size={14} aria-hidden="true" />
            <span>This closes without a trace.</span>
          </div>
        ) : null}
        {showScrollButton && !isSharedView && (
          <div className="absolute right-2 bottom-2 z-10">
            <ScrollButton onClick={scrollToBottom} />
          </div>
        )}
      </section>
    </ResolvedToolCallsProvider>
  );
};
