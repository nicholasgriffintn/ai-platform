import { GitBranch, Loader2, MessagesSquare } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { VList, type VListHandle } from "virtua";

import { useChat } from "~/hooks/useChat";
import { useChatManager } from "~/hooks/useChatManager";
import {
  useIsLoading,
  useLoadingMessage,
  useLoadingProgress,
} from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { Message } from "~/types";
import type { ArtifactProps } from "~/types/artifact";
import { ChatMessage } from "./ChatMessage";
import { MessageSkeleton } from "./MessageSkeleton";
import { ScrollButton } from "./ScrollButton";
import { ShareButton } from "./ShareButton";

interface MessageListProps {
  onToolInteraction?: (
    toolName: string,
    action: "useAsPrompt",
    data: Record<string, any>,
  ) => void;
  onArtifactOpen?: (
    artifact: ArtifactProps,
    combine?: boolean,
    artifacts?: ArtifactProps[],
  ) => void;
  messages?: Message[];
  isSharedView?: boolean;
  onBranch?: (messageId: string) => void;
  isBranching?: boolean;
}

export const MessageList = memo<MessageListProps>(({
  onToolInteraction,
  onArtifactOpen,
  messages: propMessages,
  isSharedView = false,
  onBranch,
  isBranching = false,
}) => {
  const { currentConversationId, isAuthenticated, setCurrentConversationId } =
    useChatStore();

  const { data: conversation, isLoading: isLoadingConversation } = useChat(
    !isSharedView ? currentConversationId : undefined,
  );

  const {
    streamStarted,
    retryMessage,
    updateUserMessage,
    editingMessageId,
    startEditingMessage,
    stopEditingMessage,
  } = useChatManager();

  const messages = useMemo(() => 
    propMessages || conversation?.messages || [],
    [propMessages, conversation?.messages]
  );

  const isStreamLoading = useIsLoading("stream-response");
  const isModelInitializing = useIsLoading("model-init");

  const streamLoadingMessage =
    useLoadingMessage("stream-response") || "Generating response...";
  const modelInitMessage =
    useLoadingMessage("model-init") || "Initializing model...";
  const modelInitProgress = useLoadingProgress("model-init") || 0;

  const virtualRef = useRef<VListHandle>(null);
  const prevCount = useRef(0);

  // scroll-to-bottom on mount and when new messages arrive, except in shared view
  useEffect(() => {
    if (isSharedView) {
      prevCount.current = messages.length;
      return;
    }
    const lastIndex = messages.length - 1;
    if (
      virtualRef.current &&
      (prevCount.current === 0 || messages.length > prevCount.current)
    ) {
      virtualRef.current.scrollToIndex(lastIndex, { align: "end" });
    }
    prevCount.current = messages.length;
  }, [messages.length, isSharedView]);

  // show/hide the "scroll to bottom" button when user scrolls up
  const [showScroll, setShowScroll] = useState(false);
  const handleScroll = useCallback(() => {
    const v = virtualRef.current;
    if (!v) return;
    const scrollTop = v.scrollOffset;
    const scrollHeight = v.scrollSize;
    const clientHeight = v.viewportSize;
    setShowScroll(scrollTop < scrollHeight - clientHeight - 100);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (virtualRef.current && messages.length > 0) {
      virtualRef.current.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length]);

  const handleRetryMessage = useCallback((messageId: string) => {
    retryMessage(messageId);
  }, [retryMessage]);

  const handleUpdateUserMessage = useCallback((messageId: string, content: string) => {
    updateUserMessage(messageId, content);
  }, [updateUserMessage]);

  const handleStartEditingMessage = useCallback((messageId: string) => {
    startEditingMessage(messageId);
  }, [startEditingMessage]);

  const handleStopEditingMessage = useCallback(() => {
    stopEditingMessage();
  }, [stopEditingMessage]);

  const handleBranch = useCallback((messageId: string) => {
    onBranch?.(messageId);
  }, [onBranch]);

  const renderMessage = useCallback((index: number) => {
    const message = messages[index];
    if (!message) return null;

    return (
      <ChatMessage
        key={message.id}
        conversationId={currentConversationId}
        message={message}
        onToolInteraction={onToolInteraction}
        onArtifactOpen={onArtifactOpen}
        onRetry={handleRetryMessage}
        isRetrying={streamStarted}
        onEdit={
          message.id
            ? () => handleStartEditingMessage(message.id!)
            : undefined
        }
        isEditing={editingMessageId === message.id}
        onSaveEdit={(newContent) => {
          if (message.id) {
            handleUpdateUserMessage(message.id, newContent);
            handleStopEditingMessage();
          }
        }}
        onCancelEdit={handleStopEditingMessage}
        onBranch={handleBranch}
        isBranching={isBranching}
      />
    );
  }, [
    messages,
    onToolInteraction,
    onArtifactOpen,
    handleRetryMessage,
    handleUpdateUserMessage,
    handleStartEditingMessage,
    handleStopEditingMessage,
    handleBranch,
    editingMessageId,
    isBranching,
    isSharedView,
    isAuthenticated,
    setCurrentConversationId,
  ]);

  return (
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
        className="flex-1 pt-4 pr-2 h-full overflow-auto w-full"
        onScroll={handleScroll}
      >
        {!isSharedView && (
          <div className="flex items-center mb-3">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 min-w-0 truncate flex-grow">
              {conversation?.parent_conversation_id && (
                <GitBranch
                  size={16}
                  className="flex-shrink-0 text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  aria-label="Go to original conversation"
                  onClick={() =>
                    setCurrentConversationId(
                      conversation.parent_conversation_id!,
                    )
                  }
                />
              )}
              <MessagesSquare size={16} className="flex-shrink-0" />
              <span className="truncate">
                {conversation?.title || "New conversation"}
              </span>
            </h2>
            {!conversation?.isLocalOnly &&
              !isLoadingConversation &&
              currentConversationId &&
              isAuthenticated && (
                <ShareButton
                  conversationId={currentConversationId}
                  isPublic={conversation?.is_public}
                  shareId={conversation?.share_id}
                  className="flex-shrink-0"
                />
              )}
          </div>
        )}
        {!isSharedView && isLoadingConversation ? (
          <div className="py-4 space-y-4">
            {[...Array(3)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: It's a key for the skeleton
              <MessageSkeleton key={`skeleton-item-${i}`} />
            ))}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={`${message.id || index}-${index}`}
                className={index > 0 ? "mt-4" : ""}
              >
                {renderMessage(index)}
              </div>
            ))}
            {!isSharedView && (isStreamLoading || streamStarted) && (
              <div className="flex items-center gap-2 py-2 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                <span>{streamLoadingMessage}</span>
              </div>
            )}
            {!isSharedView && isModelInitializing && (
              <div className="flex items-center gap-2 py-2 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                <span>
                  {modelInitMessage}
                  {modelInitProgress !== undefined
                    ? ` ${Math.round(modelInitProgress)}%`
                    : null}
                </span>
              </div>
            )}
          </>
        )}
      </VList>
      {showScroll && !isSharedView && (
        <div className="absolute bottom-2 right-2 z-10">
          <ScrollButton
            onClick={scrollToBottom}
          />
        </div>
      )}
    </div>
  );
});
