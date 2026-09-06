import {
  useAuthStatus,
  useConversationScope,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";

import { ConversationFooterInfo } from "../Composer/ConversationFooterInfo";

interface FooterInfoProps {
  isPanelVisible: boolean;
}

export const FooterInfo = ({ isPanelVisible }: FooterInfoProps) => {
  const { currentConversationId } = useConversationScope();
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
