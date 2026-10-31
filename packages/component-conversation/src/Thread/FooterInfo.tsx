import {
  useAuthStatus,
  useConversationScope,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { useShallow } from "zustand/react/shallow";

import { ConversationFooterInfo } from "../Composer/ConversationFooterInfo.js";

export const FooterInfo = () => {
  const { currentConversationId } = useConversationScope();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStatus();
  const { isMobile } = useUIStore(useShallow((state) => ({ isMobile: state.isMobile })));

  return (
    <ConversationFooterInfo
      isAuthLoading={isAuthLoading}
      hasConversationContext={isAuthenticated || !!currentConversationId}
      isMobile={isMobile}
    />
  );
};
