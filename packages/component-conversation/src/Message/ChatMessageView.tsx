import type {
  ArtifactProps,
  ToolInteractionHandler,
} from "@ngriffin_uk/polychat-component-content";
import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import { isHiddenToolResponse } from "@ngriffin_uk/polychat-library-chat/tool-results";
import { getModelDisplayName } from "@ngriffin_uk/polychat-schemas";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";
import { useState } from "react";

import { EditableMessageContent } from "./EditableMessageContent";
import { MessageActions } from "./MessageActions";
import { MessageContent } from "./MessageContent";
import { ToolMessage } from "./ToolMessage";

/**
 * Whether the view will produce anything. The list uses this to skip the row entirely — returning
 * null from inside the view still leaves the caller's wrapper behind as an unexplained gap.
 */
export const isRenderableMessage = (message: Message): boolean => {
  if (message.role === "system" || message.role === "developer") {
    return false;
  }

  if (isHiddenToolResponse(message)) {
    return false;
  }

  const hasParts = Array.isArray(message.parts) && message.parts.length > 0;
  const isToolResponse = message.role === "tool" && Boolean(message.name);

  return Boolean(
    message.content ||
    message.reasoning ||
    hasParts ||
    isToolResponse ||
    (message.role === "assistant" && message.model),
  );
};

export const ChatMessageView = ({
  conversationId,
  canSubmitFeedback = false,
  message,
  modelConfig,
  onToolInteraction,
  onConnectorApproval,
  onArtifactOpen,
  isSharedView = false,
  onRetry,
  isRetrying = false,
  onEdit,
  isEditing = false,
  onSaveEdit,
  onCancelEdit,
  onBranch,
  isBranching = false,
  onRequestSecondOpinion,
  isRequestingSecondOpinion = false,
  isArchivedByCompaction = false,
  responseDurationMs,
  copied,
  onCopy,
  onSubmitFeedback,
  renderModelSelector,
}: {
  conversationId?: string;
  canSubmitFeedback?: boolean;
  message: Message;
  modelConfig?: ModelConfigItem;
  onToolInteraction?: ToolInteractionHandler;
  onConnectorApproval?: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
  onArtifactOpen?: (
    artifact: ArtifactProps,
    combine?: boolean,
    artifacts?: ArtifactProps[],
  ) => void;
  isSharedView?: boolean;
  onRetry?: (messageId: string) => void;
  isRetrying?: boolean;
  onEdit?: () => void;
  isEditing?: boolean;
  onSaveEdit?: (newContent: string) => void;
  onCancelEdit?: () => void;
  onBranch?: (messageId: string, modelId?: string) => void;
  isBranching?: boolean;
  onRequestSecondOpinion?: (messageId: string) => void;
  isRequestingSecondOpinion?: boolean;
  isArchivedByCompaction?: boolean;
  responseDurationMs?: number;
  copied: boolean;
  onCopy: (value: string) => void;
  onSubmitFeedback?: (value: 1 | -1) => Promise<void>;
  renderModelSelector: (args: {
    onModelSelect: (modelId: string) => void;
    onCancel: () => void;
  }) => ReactNode;
}) => {
  const [feedbackState, setFeedbackState] = useState<"none" | "liked" | "disliked">("none");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const assistantModelName =
    message.role === "assistant" && message.model
      ? modelConfig
        ? getModelDisplayName(modelConfig)
        : message.model
      : undefined;

  const isToolResponse = message.role === "tool" && message.name;
  const isSystemMessage = message.role === "system" || message.role === "developer";
  const hasPartContent = Array.isArray(message.parts) && message.parts.length > 0;

  if (isSystemMessage || isHiddenToolResponse(message)) {
    return null;
  }

  if (
    !message.content &&
    !message.reasoning &&
    !hasPartContent &&
    !isToolResponse &&
    !assistantModelName
  ) {
    return null;
  }

  const copyMessageToClipboard = () => {
    const copyText = getMessageTextContent(message);

    if (copyText) {
      onCopy(copyText);
    }
  };

  const submitFeedback = async (value: 1 | -1) => {
    if (!canSubmitFeedback || !message.log_id || isSubmittingFeedback || isSharedView) {
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      if (!conversationId) {
        return;
      }

      await onSubmitFeedback?.(value);
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
      data-tool-name={message.name}
      data-tool-status={message.status}
      data-id={message.id}
      aria-roledescription={`${message.role} message`}
    >
      <div
        className={`flex flex-col ${
          message.role === "user"
            ? "max-w-[80%] rounded-2xl border border-zinc-200/10 bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
            : "w-full text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
        } `}
      >
        <div className={`flex flex-col gap-2 py-2 ${message.role === "user" ? "px-3" : ""}`}>
          <div className="flex items-start gap-2">
            {assistantModelName && (
              <div className="flex-shrink-0 mr-2 mt-1">
                <ModelIcon
                  modelName={assistantModelName}
                  provider={modelConfig?.provider ?? message.provider}
                  url={modelConfig?.avatarUrl}
                  size={24}
                  title={assistantModelName}
                  mono
                />
              </div>
            )}
            <div className="flex-1 overflow-x-auto">
              {isToolResponse ? (
                <ToolMessage
                  message={message}
                  onToolInteraction={onToolInteraction}
                  onConnectorApproval={onConnectorApproval}
                />
              ) : isEditing && message.role === "user" && onSaveEdit && onCancelEdit ? (
                <EditableMessageContent
                  message={message}
                  onSave={onSaveEdit}
                  onCancel={onCancelEdit}
                  isUpdating={isRetrying}
                />
              ) : (
                <MessageContent
                  message={message}
                  onArtifactOpen={onArtifactOpen}
                  onToolInteraction={onToolInteraction}
                />
              )}
            </div>
          </div>

          {conversationId &&
            (message.content || hasPartContent) &&
            (message.log_id || message.created) && (
              <MessageActions
                renderModelSelector={renderModelSelector}
                message={message}
                copied={copied}
                copyMessageToClipboard={copyMessageToClipboard}
                feedbackState={feedbackState}
                canSubmitFeedback={canSubmitFeedback}
                isSubmittingFeedback={isSubmittingFeedback}
                submitFeedback={submitFeedback}
                isSharedView={isSharedView}
                onRetry={onRetry && message.id ? () => onRetry(message.id) : undefined}
                isRetrying={isRetrying}
                onEdit={onEdit}
                isEditing={isEditing}
                onBranch={onBranch}
                isBranching={isBranching}
                onRequestSecondOpinion={onRequestSecondOpinion}
                isRequestingSecondOpinion={isRequestingSecondOpinion}
                isArchivedByCompaction={isArchivedByCompaction}
                responseDurationMs={responseDurationMs}
                modelConfig={modelConfig}
              />
            )}
        </div>
      </div>
    </article>
  );
};
