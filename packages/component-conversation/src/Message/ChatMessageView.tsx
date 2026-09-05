import type {
  ArtifactProps,
  ToolInteractionHandler,
} from "@ngriffin_uk/polychat-component-content";
import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import {
  isHiddenToolResponse,
  isHiddenToolResultPart,
} from "@ngriffin_uk/polychat-library-chat/tool-results";
import { getModelDisplayName } from "@ngriffin_uk/polychat-schemas";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { Target } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { EditableMessageContent } from "./EditableMessageContent";
import { MessageActions } from "./MessageActions";
import { MessageContent } from "./MessageContent";
import { useResolvedToolCallIds } from "./ResolvedToolCalls";
import { ToolMessage } from "./ToolMessage";

const EMPTY_RESOLVED_TOOL_CALL_IDS: ReadonlySet<string> = new Set();

const hasRenderableContentItem = (
  item: Extract<Message["content"], unknown[]>[number],
): boolean => {
  if (!item || typeof item !== "object" || !("type" in item)) {
    return false;
  }

  if (item.type === "text") {
    return typeof item.text === "string" && item.text.trim().length > 0;
  }

  return (
    (item.type === "image_url" && Boolean(item.image_url?.url)) ||
    (item.type === "audio_url" && Boolean(item.audio_url?.url)) ||
    (item.type === "input_audio" && Boolean(item.input_audio?.data)) ||
    (item.type === "artifact" && Boolean(item.artifact)) ||
    (item.type === "artifact_selection" && Boolean(item.artifact_selection))
  );
};

export const isRenderableMessage = (
  message: Message,
  resolvedToolCallIds: ReadonlySet<string> = EMPTY_RESOLVED_TOOL_CALL_IDS,
): boolean => {
  if (message.role === "system" || message.role === "developer") {
    return false;
  }

  if (isHiddenToolResponse(message)) {
    return false;
  }

  if (message.role === "tool") {
    return Boolean(message.name && message.data);
  }

  const hasTextContent =
    typeof message.content === "string"
      ? message.content.trim().length > 0
      : Array.isArray(message.content) && message.content.some(hasRenderableContentItem);
  const hasReasoning = Boolean(message.reasoning?.content.trim());
  const hasSupportingContent =
    Boolean(message.citations?.length) ||
    Boolean(message.data?.searchGrounding) ||
    Boolean(
      message.data?.attachments?.some(
        (attachment: unknown) =>
          typeof attachment === "object" &&
          attachment !== null &&
          "url" in attachment &&
          Boolean(attachment.url),
      ),
    );
  const hasRenderablePart = message.parts?.some((part) => {
    if (part.type === "text" || part.type === "reasoning") {
      return part.text.trim().length > 0;
    }

    if (part.type === "tool_use") {
      return !part.toolCallId || !resolvedToolCallIds.has(part.toolCallId);
    }

    if (part.type === "tool_result") {
      return !isHiddenToolResultPart(part);
    }

    return part.type === "snapshot" || part.type === "file";
  });

  return Boolean(hasTextContent || hasReasoning || hasSupportingContent || hasRenderablePart);
};

export const ChatMessageView = ({
  conversationId,
  canSubmitFeedback = false,
  message,
  isGenerating = false,
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
  goalStarted = false,
  copied,
  onCopy,
  onSubmitFeedback,
  renderModelSelector,
}: {
  conversationId?: string;
  canSubmitFeedback?: boolean;
  message: Message;
  isGenerating?: boolean;
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
  goalStarted?: boolean;
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
  const resolvedToolCallIds = useResolvedToolCallIds();
  const assistantModelName =
    message.role === "assistant" && message.model
      ? modelConfig
        ? getModelDisplayName(modelConfig)
        : message.model
      : undefined;

  const isToolResponse = message.role === "tool" && message.name;
  const hasPartContent = Array.isArray(message.parts) && message.parts.length > 0;

  if (!isRenderableMessage(message, resolvedToolCallIds)) {
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
      className={`flex ${message.role === "user" ? "flex-col items-end" : "justify-start"}`}
      data-role={message.role}
      data-tool-response={isToolResponse}
      data-tool-name={message.name}
      data-tool-status={message.status}
      data-id={message.id}
      aria-roledescription={`${message.role} message`}
    >
      {message.role === "user" && goalStarted ? (
        <output
          aria-label="Goal started"
          className="text-muted-foreground mr-2 mb-1.5 flex items-center gap-1.5 text-xs font-medium"
        >
          <Target className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Goal started</span>
        </output>
      ) : null}
      <div
        className={`flex flex-col ${
          message.role === "user"
            ? "border-human-action/25 bg-human-action/12 text-foreground max-w-[80%] rounded-2xl border"
            : "text-foreground w-full"
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
                  isGenerating={isGenerating}
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
