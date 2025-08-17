import {
  Check,
  Copy,
  Edit,
  GitBranch,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "~/components/ui";
import type { Message } from "~/types";
import { MessageInfo } from "./MessageInfo";
import { BranchModelSelector } from "../BranchModelSelector";

interface MessageActionsProps {
  message: Message;
  copied: boolean;
  copyMessageToClipboard: () => void;
  feedbackState: "none" | "liked" | "disliked";
  isSubmittingFeedback: boolean;
  submitFeedback: (value: 1 | -1) => Promise<void>;
  isSharedView: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
  onEdit?: () => void;
  isEditing?: boolean;
  onBranch?: (messageId: string, modelId?: string) => void;
  isBranching?: boolean;
}

export const MessageActions = ({
  message,
  copied,
  copyMessageToClipboard,
  feedbackState,
  isSubmittingFeedback,
  submitFeedback,
  isSharedView = false,
  onRetry,
  isRetrying = false,
  onEdit,
  isEditing = false,
  onBranch,
  isBranching = false,
}: MessageActionsProps) => {
  const [showBranchModelDialog, setShowBranchModelDialog] = useState(false);
  const didSelectRef = useRef(false);

  const handleOpenBranchDialog = useCallback(() => {
    if (!onBranch) return;
    didSelectRef.current = false;
    setShowBranchModelDialog(true);
  }, [onBranch]);

  const handleModelSelected = useCallback(
    (modelId: string) => {
      didSelectRef.current = true;
      setShowBranchModelDialog(false);
      if (onBranch) {
        onBranch(message.id, modelId);
      }
    },
    [onBranch, message.id],
  );

  const handleDialogClose = useCallback(() => {
    setShowBranchModelDialog(false);
    if (!didSelectRef.current && onBranch) {
      onBranch(message.id);
    }
  }, [onBranch, message.id]);

  return (
    <div className="flex flex-wrap justify-end items-center gap-2">
      <div className="flex items-center space-x-1">
        {message.role !== "user" && message.content && (
          <Button
            type="button"
            variant="icon"
            onClick={copyMessageToClipboard}
            className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center ${
              copied
                ? "text-green-500 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
            title={copied ? "Copied!" : "Copy message"}
            aria-label={copied ? "Copied!" : "Copy message"}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        )}
        {message.role === "user" && onEdit && !isSharedView && (
          <Button
            type="button"
            variant="icon"
            onClick={onEdit}
            disabled={isEditing}
            className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400 ${
              isEditing ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={isEditing ? "Editing..." : "Edit message"}
            aria-label={isEditing ? "Editing..." : "Edit message"}
          >
            <Edit size={14} />
          </Button>
        )}
        {onRetry && !isSharedView && (
          <Button
            type="button"
            variant="icon"
            onClick={onRetry}
            disabled={isRetrying}
            className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400 ${
              isRetrying ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={isRetrying ? "Retrying..." : "Retry message"}
            aria-label={isRetrying ? "Retrying..." : "Retry message"}
          >
            <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
          </Button>
        )}
        {message.role === "user" && onBranch && !isSharedView && (
          <>
            <Button
              type="button"
              variant="icon"
              onClick={handleOpenBranchDialog}
              disabled={isBranching}
              className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400 ${
                isBranching ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title={isBranching ? "Branching..." : "Branch conversation"}
              aria-label={isBranching ? "Branching..." : "Branch conversation"}
            >
              <GitBranch size={14} />
            </Button>
            {showBranchModelDialog && (
              <BranchModelSelector
                isOpen={showBranchModelDialog}
                onClose={handleDialogClose}
                onModelSelect={handleModelSelected}
              />
            )}
          </>
        )}
        {message.role !== "user" && (message.created || message.timestamp) && (
          <MessageInfo
            message={message}
            buttonClassName={
              "cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400"
            }
          />
        )}
      </div>
      {!isSharedView && message.role !== "user" && message.log_id && (
        <div className="flex items-center space-x-1">
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            Helpful?
          </span>
          <Button
            type="button"
            variant="icon"
            onClick={() => submitFeedback(1)}
            disabled={isSubmittingFeedback || feedbackState === "liked"}
            className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 ${
              feedbackState === "liked"
                ? "text-green-500 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20"
                : "text-zinc-500 dark:text-zinc-400"
            } ${
              isSubmittingFeedback || feedbackState === "liked"
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            title={
              feedbackState === "liked" ? "Feedback submitted" : "Thumbs up"
            }
            aria-label={
              feedbackState === "liked" ? "Feedback submitted" : "Thumbs up"
            }
          >
            <ThumbsUp size={14} />
          </Button>
          <Button
            type="button"
            variant="icon"
            onClick={() => submitFeedback(-1)}
            disabled={isSubmittingFeedback || feedbackState === "disliked"}
            className={`cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 ${
              feedbackState === "disliked"
                ? "text-red-500 dark:text-red-400 bg-red-100/50 dark:bg-red-900/20"
                : "text-zinc-500 dark:text-zinc-400"
            } ${
              isSubmittingFeedback || feedbackState === "disliked"
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            title={
              feedbackState === "disliked"
                ? "Feedback submitted"
                : "Thumbs down"
            }
            aria-label={
              feedbackState === "disliked"
                ? "Feedback submitted"
                : "Thumbs down"
            }
          >
            <ThumbsDown size={14} />
          </Button>
        </div>
      )}
    </div>
  );
};
