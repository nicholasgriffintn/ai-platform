import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useShareItem } from "~/hooks/useAppsSharing";
import { Button } from "./ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/Dialog";
import { Input } from "./ui/input";

interface ShareButtonProps {
  appId: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

export function ShareButton({
  appId,
  className,
  variant = "outline",
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const { mutate: shareItem, isPending } = useShareItem();
  const { trackFeatureUsage, trackError } = useTrackEvent();

  const handleShare = () => {
    trackFeatureUsage("share_initiated", {
      content_type: "app",
      content_id: appId,
    });

    shareItem(
      { app_id: appId },
      {
        onSuccess: (data) => {
          if (data.share_id) {
            const url = `${window.location.origin}/s/apps/${data.share_id}`;
            setShareUrl(url);

            trackFeatureUsage("share_link_created", {
              content_type: "app",
              content_id: appId,
              share_id: data.share_id,
            });
          }
        },
        onError: (error) => {
          toast.error("Failed to share item", {
            description: error.message,
          });

          trackError("share_failed", error, {
            content_type: "app",
            content_id: appId,
          });
        },
      },
    );
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");

    trackFeatureUsage("share_link_copied", {
      content_type: "app",
      content_id: appId,
      share_method: "clipboard",
    });
  };

  const handleOpenInNewTab = () => {
    window.open(shareUrl, "_blank");

    trackFeatureUsage("share_link_opened", {
      content_type: "app",
      content_id: appId,
      share_method: "new_tab",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          className={className}
          onClick={() => setIsOpen(true)}
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>
            Create a shareable link to this content
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-4 py-4">
          {!shareUrl ? (
            <Button onClick={handleShare} disabled={isPending}>
              {isPending ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin">◌</span>
                  Generating link...
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Generate shareable link
                </>
              )}
            </Button>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <Input value={shareUrl} readOnly className="flex-1" />
                <Button size="icon" variant="outline" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleOpenInNewTab}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <Check className="mr-1 h-4 w-4" />
                Link ready to share
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
