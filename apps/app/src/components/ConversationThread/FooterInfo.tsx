import { ConversationFooterInfo } from "@ngriffin_uk/polychat-component-conversation";

import { useAuthStatus } from "~/hooks/useAuth";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

interface FooterInfoProps {
  isPanelVisible: boolean;
}

export const FooterInfo = ({ isPanelVisible }: FooterInfoProps) => {
  const { currentConversationId } = useChatStore();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStatus();
  const { isMobile } = useUIStore();

  return (
    <ConversationFooterInfo
      isPanelVisible={isPanelVisible}
      isAuthLoading={isAuthLoading}
      hasConversationContext={isAuthenticated || !!currentConversationId}
      isMobile={isMobile}
    />
  );
};
