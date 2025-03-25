import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/Dialog";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { apiService } from "~/lib/api/api-service";
import { cn } from "~/lib/utils";
import { useError } from "~/state/contexts/ErrorContext";

interface ShareButtonProps {
  conversationId: string;
  isPublic?: boolean;
  shareId?: string;
}

export const ShareButton = ({
  conversationId,
  isPublic,
  shareId,
}: ShareButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [currentShareId, setCurrentShareId] = useState<string | undefined>(
    shareId,
  );
  const [currentIsPublic, setCurrentIsPublic] = useState<boolean | undefined>(
    isPublic,
  );
  const { addError } = useError();
  const { copied, copy } = useCopyToClipboard();

  const handleShareClick = async () => {
    if (!conversationId) return;

    try {
      setIsSharing(true);
      const result = await apiService.shareConversation(conversationId);
      setCurrentShareId(result.share_id);
      setCurrentIsPublic(true);
      addError("Conversation shared successfully", "info");
    } catch (error) {
      console.error("Error sharing conversation:", error);
      addError("Failed to share conversation", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshareClick = async () => {
    if (!conversationId) return;

    try {
      setIsUnsharing(true);
      await apiService.unshareConversation(conversationId);
      setCurrentIsPublic(false);
      setCurrentShareId(undefined);
      addError("Conversation unshared", "info");
    } catch (error) {
      console.error("Error unsharing conversation:", error);
      addError("Failed to unshare conversation", "error");
    } finally {
      setIsUnsharing(false);
    }
  };

  const copyShareLink = () => {
    if (!currentShareId) return;

    const shareUrl = `${window.location.origin}/s/${currentShareId}`;
    copy(shareUrl);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        title={
          currentIsPublic ? "Manage shared conversation" : "Share conversation"
        }
        icon={<Share2 className="h-3.5 w-3.5" />}
      >
        <span>{currentIsPublic ? "Manage share" : "Share"}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentIsPublic
                ? "Manage Shared Conversation"
                : "Share Conversation"}
            </DialogTitle>
          </DialogHeader>
          <DialogClose onClick={() => setIsOpen(false)} />

          <div className="space-y-4 py-2">
            {currentIsPublic && currentShareId ? (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Your conversation is publicly accessible with the following
                  link:
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/s/${currentShareId}`}
                      className={cn(
                        "w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700",
                        "bg-off-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
                      )}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={copyShareLink}
                    title={copied ? "Copied!" : "Copy link"}
                    aria-label="Copy link"
                    className={
                      copied ? "text-green-500 dark:text-green-400" : ""
                    }
                    icon={
                      copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )
                    }
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleUnshareClick}
                  isLoading={isUnsharing}
                  className="mt-4 w-full"
                >
                  {isUnsharing ? "Removing Share..." : "Stop Sharing"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Share this conversation publicly. Anyone with the link will be
                  able to view it.
                </p>
                <Button
                  onClick={handleShareClick}
                  isLoading={isSharing}
                  variant="primary"
                  className="mt-4 w-full"
                >
                  {isSharing ? "Creating Share..." : "Share Conversation"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
