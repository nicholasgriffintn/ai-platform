import { ShareDialog } from "~/components/Content/ShareDialog";
import { apiService } from "~/lib/api/api-service";

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
      collapseLabel={compactOnMobile}
      className={className}
    />
  );
};
