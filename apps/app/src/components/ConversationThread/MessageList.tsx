import { MessagesSquare } from "lucide-react";

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

interface MessageListProps {
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

export const MessageList = ({
  messagesEndRef,
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

  return (
    <div
      className="py-4 space-y-4"
      data-conversation-id={currentConversationId || undefined}
      role="log"
      aria-live="polite"
      aria-label="Conversation messages"
      aria-atomic="false"
    >
      {!isSharedView && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <MessagesSquare size={16} />
            <span>{conversation?.title || "New conversation"}</span>
          </h2>
          {currentConversationId && isAuthenticated && (
            <ShareButton
              conversationId={currentConversationId}
              isPublic={conversation?.is_public}
              shareId={conversation?.share_id}
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
            <ChatMessage
              key={`${message.id || index}-${index}`}
              message={message}
              onToolInteraction={onToolInteraction}
              onArtifactOpen={onArtifactOpen}
              isSharedView={isSharedView}
            />
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
        </>
      )}
      {messagesEndRef && <div ref={messagesEndRef} />}
    </div>
  );
};
