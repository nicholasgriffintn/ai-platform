import { useCallback } from "react";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useShareItem } from "~/hooks/useAppsSharing";

type ShareItemResponse = {
  status: "success" | "error";
  share_id?: string;
  message?: string;
};
import { ShareDialog } from "./ShareDialog";

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
  const { mutateAsync: shareItem } = useShareItem();
  const { trackFeatureUsage, trackError } = useTrackEvent();

  const handleShare = useCallback(
    async (id: string): Promise<{ share_id: string }> => {
      trackFeatureUsage("share_initiated", {
        content_type: "app",
        content_id: id,
      });

      try {
        const data: ShareItemResponse = await shareItem({ app_id: id });

        trackFeatureUsage("share_link_created", {
          content_type: "app",
          content_id: id,
          share_id: data.share_id,
        });

        if (!data.share_id) {
          throw new Error("No share_id returned from API");
        }

        return { share_id: data.share_id };
      } catch (error) {
        trackError("share_failed", error as Error, {
          content_type: "app",
          content_id: id,
        });
        throw error;
      }
    },
    [shareItem, trackFeatureUsage, trackError],
  );

  const handleUnshare = useCallback(
    async (id: string) => {
      // Apps don't currently support unsharing, so this is a no-op
      // In the future, implement this when the API supports it
      trackFeatureUsage("share_removed", {
        content_type: "app",
        content_id: id,
      });
    },
    [trackFeatureUsage],
  );

  return (
    <ShareDialog
      type="app"
      itemId={appId}
      onShare={handleShare}
      onUnshare={handleUnshare}
      getShareUrl={(shareId) => `${window.location.origin}/s/apps/${shareId}`}
      variant={variant}
      className={className}
    />
  );
}
