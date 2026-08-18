import { ShareDialog } from "~/components/Content/ShareDialog";
import { apiService } from "~/lib/api/api-service";
import { cn } from "~/lib/utils";

interface ShareButtonProps {
  conversationId: string;
  isPublic?: boolean;
  shareId?: string;
  className?: string;
  compactOnMobile?: boolean;
}

export const ShareButton = ({
  conversationId,
  isPublic,
  shareId,
  className,
  compactOnMobile = false,
}: ShareButtonProps) => {
  return (
    <ShareDialog
      type="conversation"
      itemId={conversationId}
      isPublic={isPublic}
      shareId={shareId}
      onShare={async (id) => apiService.shareConversation(id)}
      onUnshare={async (id) => apiService.unshareConversation(id)}
      getShareUrl={(shareId) => `${window.location.origin}/s/${shareId}`}
      className={cn(
        className,
        compactOnMobile &&
          "px-2 [&>div>span:first-child]:mr-0 [&>div>span:last-child]:hidden sm:px-3 sm:[&>div>span:first-child]:mr-2 sm:[&>div>span:last-child]:inline",
      )}
    />
  );
};
