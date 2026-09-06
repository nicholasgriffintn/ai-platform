import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { isCompactionMarkerMessage } from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import { resolveMessageSpeechAudioSource } from "@ngriffin_uk/polychat-library-chat/message-speech";
import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import { canStartThreadFromMessage } from "@ngriffin_uk/polychat-library-chat/threading";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import {
  Check,
  Copy,
  Edit,
  GitBranch,
  MessageSquareQuote,
  Volume2,
  VolumeX,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { MessageInfo } from "./MessageInfo";
import { MessageStats } from "./MessageStats";

export interface MessageActionsProps {
  message: Message;
  copied: boolean;
  copyMessageToClipboard: () => void;
  feedbackState: "none" | "liked" | "disliked";
  canSubmitFeedback: boolean;
  isSubmittingFeedback: boolean;
  submitFeedback: (value: 1 | -1) => Promise<void>;
  isSharedView: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
  onEdit?: () => void;
  isEditing?: boolean;
  onStartThread?: (messageId: string, modelId?: string) => void;
  isStartingThread?: boolean;
  onRequestSecondOpinion?: (messageId: string) => void;
  isRequestingSecondOpinion?: boolean;
  isArchivedByCompaction?: boolean;
  responseDurationMs?: number;
  modelConfig?: ModelConfigItem;
  renderModelSelector: (props: {
    onModelSelect: (modelId: string) => void;
    onCancel: () => void;
  }) => ReactNode;
}

const messageActionButtonClassName =
  "text-muted-foreground hover:bg-selection hover:text-foreground polychat-motion-micro flex size-8 min-h-0 min-w-0 shrink-0 cursor-pointer items-center justify-center rounded-lg p-1.5 transition-colors";

export const MessageActions = ({
  message,
  copied,
  copyMessageToClipboard,
  feedbackState,
  canSubmitFeedback,
  isSubmittingFeedback,
  submitFeedback,
  isSharedView,
  onRetry,
  isRetrying = false,
  onEdit,
  isEditing = false,
  onStartThread,
  isStartingThread = false,
  onRequestSecondOpinion,
  isRequestingSecondOpinion = false,
  isArchivedByCompaction = false,
  responseDurationMs,
  modelConfig,
  renderModelSelector,
}: MessageActionsProps) => {
  const [showThreadModelSelector, setShowThreadModelSelector] = useState(false);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const isCompactionMarker = isCompactionMarkerMessage(message);
  const hasText = Boolean(getMessageTextContent(message)?.trim());
  const canMutateConversation = !isArchivedByCompaction;
  const canStartThread = Boolean(
    onStartThread && !isSharedView && canMutateConversation && canStartThreadFromMessage(message),
  );
  const canRequestSecondOpinion = Boolean(
    onRequestSecondOpinion &&
    !isSharedView &&
    canMutateConversation &&
    !isCompactionMarker &&
    message.role === "assistant" &&
    hasText,
  );
  const speechAudioSource =
    message.role === "assistant" && !isCompactionMarker
      ? resolveMessageSpeechAudioSource(message)
      : undefined;

  const handleAssistantBranchClick = useCallback(() => {
    if (!onStartThread) {
      return;
    }

    onStartThread(message.id);
  }, [message.id, onStartThread]);

  const handleModelSelected = useCallback(
    (modelId: string) => {
      setShowThreadModelSelector(false);
      if (onStartThread) {
        onStartThread(message.id, modelId);
      }
    },
    [onStartThread, message.id],
  );

  const handleCancelModelSelection = useCallback(() => {
    setShowThreadModelSelector(false);
  }, []);

  const handleSecondOpinionClick = useCallback(() => {
    onRequestSecondOpinion?.(message.id);
  }, [message.id, onRequestSecondOpinion]);

  const stopSpeechPlayback = useCallback(() => {
    const currentAudio = speechAudioRef.current;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.removeAttribute("src");
      currentAudio.load();
    }

    speechAudioRef.current = null;
    setIsPlayingSpeech(false);
  }, []);

  const handleReplaySpeech = useCallback(() => {
    if (!speechAudioSource) {
      return;
    }

    if (isPlayingSpeech) {
      stopSpeechPlayback();

      return;
    }

    stopSpeechPlayback();

    const audio = new Audio(speechAudioSource);

    audio.crossOrigin = "use-credentials";
    speechAudioRef.current = audio;
    audio.onended = () => {
      speechAudioRef.current = null;
      setIsPlayingSpeech(false);
    };

    audio.onerror = () => {
      speechAudioRef.current = null;
      setIsPlayingSpeech(false);
      toast.error("Failed to play generated speech");
    };

    setIsPlayingSpeech(true);
    void audio.play().catch(() => {
      setIsPlayingSpeech(false);
      toast.error("Failed to play generated speech");
    });
  }, [isPlayingSpeech, speechAudioSource, stopSpeechPlayback]);

  return (
    <div className="flex flex-wrap justify-end items-center gap-2">
      <MessageStats
        message={message}
        responseDurationMs={responseDurationMs}
        pricing={modelConfig}
        className="mr-auto"
      />
      <div className="flex items-center space-x-1">
        {message.role !== "user" && hasText && (
          <Button
            type="button"
            variant="icon"
            onClick={copyMessageToClipboard}
            className={cn(
              messageActionButtonClassName,
              copied ? "text-success bg-success/12" : undefined,
            )}
            title={copied ? "Copied!" : "Copy message"}
            aria-label={copied ? "Copied!" : "Copy message"}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        )}
        {speechAudioSource && (
          <Button
            type="button"
            variant="icon"
            onClick={handleReplaySpeech}
            className={cn(
              messageActionButtonClassName,
              isPlayingSpeech ? "text-success bg-success/12" : undefined,
            )}
            title={isPlayingSpeech ? "Stop response audio" : "Replay response audio"}
            aria-label={isPlayingSpeech ? "Stop response audio" : "Replay response audio"}
          >
            {isPlayingSpeech ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>
        )}
        {message.role === "user" && onEdit && !isSharedView && canMutateConversation && (
          <Button
            type="button"
            variant="icon"
            onClick={onEdit}
            disabled={isEditing}
            className={cn(
              messageActionButtonClassName,
              isEditing && "cursor-not-allowed opacity-50",
            )}
            title={isEditing ? "Editing..." : "Edit message"}
            aria-label={isEditing ? "Editing..." : "Edit message"}
          >
            <Edit size={14} />
          </Button>
        )}
        {onRetry && !isSharedView && canMutateConversation && (
          <Button
            type="button"
            variant="icon"
            onClick={onRetry}
            disabled={isRetrying}
            className={cn(
              messageActionButtonClassName,
              isRetrying && "cursor-not-allowed opacity-50",
            )}
            title={isRetrying ? "Retrying..." : "Retry message"}
            aria-label={isRetrying ? "Retrying..." : "Retry message"}
          >
            <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
          </Button>
        )}
        {canRequestSecondOpinion && (
          <Button
            type="button"
            variant="icon"
            onClick={handleSecondOpinionClick}
            disabled={isRequestingSecondOpinion}
            className={cn(
              messageActionButtonClassName,
              isRequestingSecondOpinion && "cursor-not-allowed opacity-50",
            )}
            title={isRequestingSecondOpinion ? "Asking for a second opinion..." : "Second opinion"}
            aria-label={
              isRequestingSecondOpinion ? "Asking for a second opinion..." : "Second opinion"
            }
          >
            <MessageSquareQuote size={14} />
          </Button>
        )}
        {canStartThread && (
          <div className="relative flex items-center">
            {message.role === "user" ? (
              <Popover open={showThreadModelSelector} onOpenChange={setShowThreadModelSelector}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="icon"
                    disabled={isStartingThread}
                    className={cn(
                      messageActionButtonClassName,
                      isStartingThread && "cursor-not-allowed opacity-50",
                    )}
                    title={isStartingThread ? "Starting a thread..." : "Start a thread"}
                    aria-label={isStartingThread ? "Starting a thread..." : "Start a thread"}
                  >
                    <GitBranch size={14} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="end"
                  sideOffset={8}
                  collisionPadding={{ top: 64, right: 8, bottom: 112, left: 8 }}
                  className="border-border bg-surface-elevated w-[calc(100vw-1rem)] max-w-[22rem] overflow-hidden p-0 shadow-[var(--polychat-elevated-shadow)]"
                >
                  {renderModelSelector({
                    onModelSelect: handleModelSelected,
                    onCancel: handleCancelModelSelection,
                  })}
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                type="button"
                variant="icon"
                onClick={handleAssistantBranchClick}
                disabled={isStartingThread}
                className={cn(
                  messageActionButtonClassName,
                  isStartingThread && "cursor-not-allowed opacity-50",
                )}
                title={isStartingThread ? "Starting a thread..." : "Start a thread"}
                aria-label={isStartingThread ? "Starting a thread..." : "Start a thread"}
              >
                <GitBranch size={14} />
              </Button>
            )}
          </div>
        )}
        {message.role !== "user" && (message.created || message.timestamp) && (
          <MessageInfo
            message={message}
            modelConfig={modelConfig}
            responseDurationMs={responseDurationMs}
            buttonClassName={messageActionButtonClassName}
          />
        )}
      </div>
      {canSubmitFeedback && !isSharedView && message.role !== "user" && message.log_id && (
        <div className="flex items-center space-x-1">
          <span className="text-xs text-muted-foreground">Helpful?</span>
          <Button
            type="button"
            variant="icon"
            onClick={() => submitFeedback(1)}
            disabled={isSubmittingFeedback || feedbackState === "liked"}
            className={cn(
              messageActionButtonClassName,
              feedbackState === "liked" ? "text-success bg-success/12" : undefined,
              (isSubmittingFeedback || feedbackState === "liked") &&
                "cursor-not-allowed opacity-50",
            )}
            title={feedbackState === "liked" ? "Feedback submitted" : "Thumbs up"}
            aria-label={feedbackState === "liked" ? "Feedback submitted" : "Thumbs up"}
          >
            <ThumbsUp size={14} />
          </Button>
          <Button
            type="button"
            variant="icon"
            onClick={() => submitFeedback(-1)}
            disabled={isSubmittingFeedback || feedbackState === "disliked"}
            className={cn(
              messageActionButtonClassName,
              feedbackState === "disliked" ? "text-failure bg-failure/12" : undefined,
              (isSubmittingFeedback || feedbackState === "disliked") &&
                "cursor-not-allowed opacity-50",
            )}
            title={feedbackState === "disliked" ? "Feedback submitted" : "Thumbs down"}
            aria-label={feedbackState === "disliked" ? "Feedback submitted" : "Thumbs down"}
          >
            <ThumbsDown size={14} />
          </Button>
        </div>
      )}
    </div>
  );
};
