"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { MessagesSquare } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

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
import { ShareButton } from "./ShareButton";

interface VirtualisedMessageListProps {
  messagesEndRef?: React.RefObject<HTMLDivElement | null>;
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

export const VirtualisedMessageList = ({
  messagesEndRef,
  onToolInteraction,
  onArtifactOpen,
  messages: propMessages,
  isSharedView = false,
}: VirtualisedMessageListProps) => {
  const { currentConversationId, isAuthenticated } = useChatStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const [messageHeights, setMessageHeights] = useState<Record<number, number>>(
    {},
  );

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

  // Function to get size for an item
  const getSize = (index: number) => {
    return messageHeights[index] || 150; // Default height if not measured yet
  };

  // Set up virtualizer
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getSize,
    overscan: 5, // Number of items to render before and after the visible area
  });

  // Handle measuring a message element
  const measureMessage = (index: number, element: HTMLElement | null) => {
    if (!element) return;

    try {
      // Use requestAnimationFrame to ensure the element is rendered
      requestAnimationFrame(() => {
        const height = element.getBoundingClientRect().height;
        if (height > 0 && messageHeights[index] !== height) {
          setMessageHeights((prev) => ({
            ...prev,
            [index]: height,
          }));
        }
      });
    } catch (error) {
      console.error("Error measuring message:", error);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && parentRef.current) {
      rowVirtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, rowVirtualizer]);

  return (
    <div
      ref={parentRef}
      className="py-4 space-y-4 h-full overflow-auto px-4"
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
            // biome-ignore lint/suspicious/noArrayIndexKey: It's just a skeleton
            <MessageSkeleton key={`skeleton-item-${i}`} />
          ))}
        </div>
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={(el) => {
                // Measure the element when it's rendered
                measureMessage(virtualItem.index, el);

                // Set the messagesEndRef if this is the last message
                if (
                  virtualItem.index === messages.length - 1 &&
                  messagesEndRef &&
                  "current" in messagesEndRef
                ) {
                  messagesEndRef.current = el;
                }
              }}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChatMessage
                message={messages[virtualItem.index]}
                onToolInteraction={onToolInteraction}
                onArtifactOpen={onArtifactOpen}
                isSharedView={isSharedView}
              />
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
};
