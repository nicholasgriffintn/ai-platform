import {
  useAuthStatus,
  useConversationScope,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";

import { ConversationFooterInfo } from "../Composer/ConversationFooterInfo.js";

export const FooterInfo = () => {
  const { currentConversationId } = useConversationScope();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStatus();
  const { isMobile } = useUIStore();

  return (
    <ConversationFooterInfo
      isAuthLoading={isAuthLoading}
      hasConversationContext={isAuthenticated || !!currentConversationId}
      isMobile={isMobile}
    />
  );
};
