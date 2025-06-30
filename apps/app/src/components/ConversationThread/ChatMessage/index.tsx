import { useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { apiService } from "~/lib/api/api-service";
import type { ChatRole, Message } from "~/types";
import type { ArtifactProps } from "~/types/artifact";
import { MessageActions } from "./MessageActions";
import { MessageContent } from "./MessageContent";
import { ToolMessage } from "./ToolMessage";

export const ChatMessage = ({
  conversationId,
  message,
  onToolInteraction,
  onArtifactOpen,
  isSharedView = false,
  onRetry,
  isRetrying = false,
}: {
  conversationId?: string;
  message: Message;
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
  isSharedView?: boolean;
  onRetry?: (messageId: string) => void;
  isRetrying?: boolean;
}) => {
  const { copied, copy } = useCopyToClipboard();
  const [feedbackState, setFeedbackState] = useState<
    "none" | "liked" | "disliked"
  >("none");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const isToolResponse = message.role === ("tool" as ChatRole) && message.name;
  const isExternalFunctionCall =
    message.name === "External Functions" &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0;
  const isSystemMessage =
    message.role === ("system" as ChatRole) ||
    message.role === ("developer" as ChatRole);

  if (isSystemMessage) {
    return null;
  }

  if (!message.content && !message.reasoning && !isToolResponse) {
    return null;
  }

  const copyMessageToClipboard = () => {
    if (message.content) {
      const textContent =
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((item) => item.type === "text")
              .map((item) => (item as any).text)
              .join("\n");

      copy(textContent);
    }
  };

  const submitFeedback = async (value: 1 | -1) => {
    if (!message.log_id || isSubmittingFeedback || isSharedView) {
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      if (!conversationId) {
        return;
      }
      await apiService.submitFeedback(conversationId, message.log_id, value);
      setFeedbackState(value === 1 ? "liked" : "disliked");
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <article
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
      data-role={message.role}
      data-tool-response={isToolResponse}
      data-external-function-call={isExternalFunctionCall}
      data-tool-name={message.name}
      data-tool-status={message.status}
      data-id={message.id}
      aria-roledescription={`${message.role} message`}
    >
      <div
        className={`
					flex flex-col
					${
            message.role === "user"
              ? "max-w-[80%] rounded-2xl border border-zinc-200/10 bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
              : "dark:bg-off-white-highlight dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 w-full"
          }
				`}
      >
        <div
          className={`flex flex-col gap-2 py-2 ${message.role === "user" ? "px-3" : ""}`}
        >
          <div className="flex items-start gap-2">
            {message.role === "assistant" && message.model && (
              <div className="flex-shrink-0 mr-2 mt-1">
                <ModelIcon
                  modelName={message.model}
                  size={24}
                  title={message.model}
                  mono={true}
                />
              </div>
            )}
            <div className="flex-1 overflow-x-auto">
              {isToolResponse ? (
                <ToolMessage
                  message={message}
                  onToolInteraction={onToolInteraction}
                />
              ) : (
                (!isExternalFunctionCall || message?.content) && (
                  <MessageContent
                    message={message}
                    onArtifactOpen={onArtifactOpen}
                  />
                )
              )}
            </div>
          </div>

          {conversationId &&
            message.content &&
            ((message.role !== "user" && message.log_id) ||
              (message.role !== "user" && message.created)) && (
              <MessageActions
                message={message}
                copied={copied}
                copyMessageToClipboard={copyMessageToClipboard}
                feedbackState={feedbackState}
                isSubmittingFeedback={isSubmittingFeedback}
                submitFeedback={submitFeedback}
                isSharedView={isSharedView}
                onRetry={
                  onRetry && message.id ? () => onRetry(message.id!) : undefined
                }
                isRetrying={isRetrying}
              />
            )}
        </div>
      </div>
    </article>
  );
};

export default ChatMessage;
