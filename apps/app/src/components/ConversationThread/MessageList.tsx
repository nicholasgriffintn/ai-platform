import { MessagesSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VList, type VListHandle } from "virtua";

import { LoadingSpinner } from "~/components/LoadingSpinner";
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
}

export const MessageList = ({
  onToolInteraction,
  onArtifactOpen,
  messages: propMessages,
  isSharedView = false,
}: MessageListProps) => {
  const { currentConversationId, isAuthenticated } = useChatStore();

  const { data: conversation, isLoading: isLoadingConversation } = useChat(
    !isSharedView ? currentConversationId : undefined,
  );

  const { streamStarted } = useChatManager();

  const messages = propMessages || conversation?.messages || [];

  const isStreamLoading = useIsLoading("stream-response");
  const isModelInitializing = useIsLoading("model-init");

  const streamLoadingMessage =
    useLoadingMessage("stream-response") || "Generating response...";
  const modelInitMessage =
    useLoadingMessage("model-init") || "Initializing model...";
  const modelInitProgress = useLoadingProgress("model-init") || 0;

  const virtualRef = useRef<VListHandle>(null);
  const prevCount = useRef(0);

  // scroll-to-bottom on mount and when new messages arrive
  useEffect(() => {
    const lastIndex = messages.length - 1;
    if (
      virtualRef.current &&
      (prevCount.current === 0 || messages.length > prevCount.current)
    ) {
      virtualRef.current.scrollToIndex(lastIndex, { align: "end" });
    }
    prevCount.current = messages.length;
  }, [messages.length]);

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
    setShowScroll(distance > 100);
  };

  return (
    <div
      className="flex flex-col flex-1"
      data-conversation-id={currentConversationId || undefined}
      role="log"
      aria-live="polite"
      aria-label="Conversation messages"
      aria-atomic="false"
    >
      {!isSharedView && (
        <div className="flex items-center mb-3">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 min-w-0 truncate flex-grow">
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
        <div className="relative flex-1">
          <VList
            ref={virtualRef}
            className="flex-1 pt-4 pr-2 h-full overflow-auto w-full"
            onScroll={handleScroll}
          >
            {messages.map((message, index) => (
              <div
                key={`${message.id || index}-${index}`}
                className={index > 0 ? "mt-4" : ""}
              >
                <ChatMessage
                  message={message}
                  onToolInteraction={onToolInteraction}
                  onArtifactOpen={onArtifactOpen}
                  isSharedView={isSharedView}
                />
              </div>
            ))}
            {!isSharedView && (isStreamLoading || streamStarted) && (
              <div className="flex justify-center py-4">
                <LoadingSpinner message={streamLoadingMessage} />
              </div>
            )}
            {!isSharedView && isModelInitializing && (
              <div className="flex justify-center py-4">
                <LoadingSpinner
                  message={modelInitMessage}
                  progress={modelInitProgress}
                />
              </div>
            )}
          </VList>
          {showScroll && !isSharedView && (
            <div className="absolute bottom-6 right-4 z-10">
              <ScrollButton
                onClick={() =>
                  virtualRef.current?.scrollToIndex(messages.length - 1, {
                    align: "end",
                  })
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
