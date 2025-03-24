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
import type { ArtifactProps } from "~/types/artifact";
import { ChatMessage } from "./ChatMessage";
import { MessageSkeleton } from "./MessageSkeleton";

interface MessageListProps {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onToolInteraction: (
    toolName: string,
    action: "useAsPrompt",
    data: Record<string, any>,
  ) => void;
  onArtifactOpen: (
    artifact: ArtifactProps,
    combine?: boolean,
    artifacts?: ArtifactProps[],
  ) => void;
}

export const MessageList = ({
  messagesEndRef,
  onToolInteraction,
  onArtifactOpen,
}: MessageListProps) => {
  const { currentConversationId } = useChatStore();

  const { data: conversation, isLoading: isLoadingConversation } = useChat(
    currentConversationId,
  );

  const { streamStarted } = useChatManager();

  const messages = conversation?.messages || [];

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <MessagesSquare size={16} />
          <span>{conversation?.title || "New conversation"}</span>
        </h2>
      </div>

      {isLoadingConversation ? (
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
            />
          ))}
          {(isStreamLoading || streamStarted) && (
            <div className="flex justify-center py-4">
              <LoadingSpinner message={streamLoadingMessage} />
            </div>
          )}
          {isModelInitializing && (
            <div className="flex justify-center py-4">
              <LoadingSpinner
                message={modelInitMessage}
                progress={modelInitProgress}
              />
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
