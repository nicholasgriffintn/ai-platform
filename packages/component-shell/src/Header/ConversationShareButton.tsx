import { apiService } from "@ngriffin_uk/polychat-library-client";

import { ShareDialog } from "../Content/ShareDialog";
import { useShellHost } from "../Host/ShellHostContext";

export interface ConversationShareButtonProps {
  conversationId: string;
  isPublic?: boolean;
  shareId?: string;
  className?: string;
  compactOnMobile?: boolean;
}

export function ConversationShareButton({
  conversationId,
  isPublic,
  shareId,
  className,
  compactOnMobile = false,
}: ConversationShareButtonProps) {
  const { webBaseUrl } = useShellHost();

  return (
    <ShareDialog
      type="conversation"
      itemId={conversationId}
      isPublic={isPublic}
      shareId={shareId}
      onShare={async (id) => apiService.shareConversation(id)}
      onUnshare={async (id) => apiService.unshareConversation(id)}
      getShareUrl={(id) => `${webBaseUrl}/s/${id}`}
      collapseLabel={compactOnMobile ? "container" : false}
      className={className}
    />
  );
}
