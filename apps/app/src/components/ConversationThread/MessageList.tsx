import type {
  ArtifactProps,
  ToolInteractionHandler,
} from "@ngriffin_uk/polychat-component-content";
import {
  getMessageListScrollKey,
  CompactionStatusRow,
  GoalStatusRow,
  isRenderableMessage,
  MessageSkeleton,
  ResolvedToolCallsProvider,
  ScrollButton,
  StreamActivityIndicator,
} from "@ngriffin_uk/polychat-component-conversation";
import { collectResolvedToolCallIds } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import {
  getCompactionMessageLabel,
  isCompactionLoadingMessage,
} from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import { getGoalMessageMarker } from "@ngriffin_uk/polychat-library-chat/message-goal-status";
import { isHiddenToolResponse } from "@ngriffin_uk/polychat-library-chat/tool-results";
import {
  createModelReferenceMap,
  EMPTY_MODEL_CONFIG,
  getAvailableModels,
  getModelByReference,
} from "@ngriffin_uk/polychat-schemas";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { VList, type VListHandle } from "virtua";

import { useCanAccessProFeatures } from "~/hooks/useCanAccessProFeatures";
import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import {
  useIsLoading,
  useLoadingMessage,
  useLoadingProgress,
} from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import { useStreamActivityStore } from "~/state/stores/streamActivityStore";
import type { Message } from "~/types";

import { ChatMessage } from "./ChatMessage";

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
  onBranch?: (messageId: string, modelId?: string) => void;
  isBranching?: boolean;
  onRequestSecondOpinion?: (messageId: string) => void;
  isRequestingSecondOpinion?: boolean;
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
  onBranch,
  isBranching = false,
  onRequestSecondOpinion,
  isRequestingSecondOpinion = false,
}: MessageListProps) => {
  const { chatMode, currentConversationId } = useChatStore();

  const { data: conversation, isLoading: isLoadingConversation } = useChat(
    !isSharedView ? currentConversationId : undefined,
  );
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const webLLMModels = useWebLLMModels({ enabled: chatMode === "local" });
  const canAccessProFeatures = useCanAccessProFeatures();

  const {
    streamStarted,
    retryMessage,
    updateUserMessage,
    editingMessageId,
    startEditingMessage,
    stopEditingMessage,
  } = useChatManager();

  const messages = propMessages || conversation?.messages || [];
  const resolvedToolCallIds = useMemo(() => collectResolvedToolCallIds(messages), [messages]);
  const availableModels = useMemo(
    () => getAvailableModels(apiModels, chatMode === "local", webLLMModels),
    [apiModels, chatMode, webLLMModels],
  );
  const modelReferences = useMemo(
    () => createModelReferenceMap(availableModels),
    [availableModels],
  );
  const lastMessageScrollKey = useMemo(
    () => getMessageListScrollKey({ conversationId: currentConversationId, messages }),
    [currentConversationId, messages],
  );

  const streamActivity = useStreamActivityStore((state) => state.activity);
  const responseDurations = useStreamActivityStore((state) => state.responseDurations);

  const isStreamLoading = useIsLoading("stream-response");
  const isModelInitializing = useIsLoading("model-init");

  const streamLoadingMessage = useLoadingMessage("stream-response") || "Generating response...";
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
          goalMarker: getGoalMessageMarker(message),
        }))
        .filter(
          ({ message, compactionLabel, goalMarker }) =>
            Boolean(compactionLabel) ||
            Boolean(goalMarker) ||
            (!isHiddenToolResponse(message) && isRenderableMessage(message)),
        ),
    [messages],
  );

  const virtualRef = useRef<VListHandle>(null);
  const prevCount = useRef(0);
  const isNearBottomRef = useRef(true);

  // scroll-to-bottom on mount and when new messages arrive, except in shared view
  useEffect(() => {
    if (isSharedView) {
      prevCount.current = messages.length;

      return;
    }

    const lastIndex = messages.length - 1;
    const shouldFollowNewMessages = prevCount.current === 0 || isNearBottomRef.current;

    if (virtualRef.current && shouldFollowNewMessages) {
      virtualRef.current.scrollToIndex(lastIndex, { align: "end" });
      isNearBottomRef.current = true;
    }

    prevCount.current = messages.length;
  }, [lastMessageScrollKey, messages.length, isSharedView]);

  // show/hide the "scroll to bottom" button when user scrolls up
  const [showScroll, setShowScroll] = useState(false);
  const handleScroll = () => {
    const v = virtualRef.current;

    if (!v) {
      setShowScroll(false);

      return;
    }

    const { scrollSize, scrollOffset, viewportSize } = v;
    const distance = scrollSize - (scrollOffset + viewportSize);

    isNearBottomRef.current = distance <= 100;
    setShowScroll(distance > 100);
  };

  return (
    <ResolvedToolCallsProvider resolvedToolCallIds={resolvedToolCallIds}>
      <div
        className="flex flex-col flex-1 relative"
        data-conversation-id={currentConversationId || undefined}
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
        aria-atomic="false"
      >
        <VList
          ref={virtualRef}
          data-header-scroll-source
          className="flex-1 pt-4 pr-2 h-full overflow-auto w-full"
          onScroll={handleScroll}
        >
          {!isSharedView && isLoadingConversation
            ? [...Array(3)].map((_, i) => <MessageSkeleton key={`skeleton-item-${i}`} />)
            : visibleRows.map(({ message, index, compactionLabel, goalMarker }) => {
                return (
                  <div key={message.id || `message-${index}`} className="pb-4">
                    {goalMarker ? (
                      <GoalStatusRow label={goalMarker.label} objective={goalMarker.objective} />
                    ) : compactionLabel ? (
                      <CompactionStatusRow label={compactionLabel} />
                    ) : (
                      <ChatMessage
                        conversationId={currentConversationId}
                        canSubmitFeedback={Boolean(conversation && !conversation.isLocalOnly)}
                        message={message}
                        modelConfig={getModelByReference(modelReferences, message.model)}
                        onToolInteraction={onToolInteraction}
                        onConnectorApproval={onConnectorApproval}
                        onArtifactOpen={onArtifactOpen}
                        isSharedView={isSharedView}
                        onRetry={retryMessage}
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
                        onBranch={onBranch}
                        isBranching={isBranching}
                        onRequestSecondOpinion={
                          canAccessProFeatures ? onRequestSecondOpinion : undefined
                        }
                        isRequestingSecondOpinion={isRequestingSecondOpinion}
                        isArchivedByCompaction={
                          latestCompactionMarkerIndex !== -1 && index < latestCompactionMarkerIndex
                        }
                        responseDurationMs={responseDurations[message.id]}
                      />
                    )}
                  </div>
                );
              })}
          {!isSharedView && (isStreamLoading || streamStarted) ? (
            isCompactionLoadingMessage(streamLoadingMessage) ? (
              showCompactionLoadingDivider ? (
                <CompactionStatusRow label={streamLoadingMessage} pending />
              ) : null
            ) : (
              <StreamActivityIndicator label={streamLoadingMessage} activity={streamActivity} />
            )
          ) : null}
          {!isSharedView && isModelInitializing && (
            <div className="flex items-center gap-2 py-2 px-4 text-sm text-zinc-600 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
              <span>
                {modelInitMessage}
                {modelInitProgress !== undefined ? ` ${Math.round(modelInitProgress)}%` : null}
              </span>
            </div>
          )}
        </VList>
        {showScroll && !isSharedView && (
          <div className="absolute bottom-2 right-2 z-10">
            <ScrollButton
              onClick={() => {
                isNearBottomRef.current = true;
                virtualRef.current?.scrollToIndex(messages.length - 1, {
                  align: "end",
                });
              }}
            />
          </div>
        )}
      </div>
    </ResolvedToolCallsProvider>
  );
};
