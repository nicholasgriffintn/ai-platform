import { apiService } from "@ngriffin_uk/polychat-library-client";

import { ShareDialog } from "../Content/ShareDialog.js";
import { useShellHost } from "../Host/ShellHostContext.js";

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
      allowUpdate
      labels={{
        description:
          "Share this conversation as it stands now. Messages you send later stay private until you update the link.",
        sharedDescription:
          "Anyone with this link sees the conversation up to when you last shared it. Update the link to include newer messages; stopping sharing retires the link for good.",
      }}
      getShareUrl={(id) => `${webBaseUrl}/s/${id}`}
      collapseLabel={compactOnMobile ? "container" : false}
      className={className}
    />
  );
}
