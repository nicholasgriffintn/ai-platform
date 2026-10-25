import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import {
  ArtifactWorkbenchProvider,
  ConversationScopeProvider,
  useConversationAgentApprovals,
  useLocalConversationScope,
} from "@ngriffin_uk/polychat-library-react";

import { ConversationArtifactOverlay } from "../Conversations/ConversationArtifactOverlay.js";

export function DelegatePanel({ conversationId }: { conversationId: string }) {
  const scope = useLocalConversationScope(conversationId);
  const agentApprovals = useConversationAgentApprovals(scope.currentConversationId);

  return (
    <ConversationScopeProvider scope={scope}>
      <ArtifactWorkbenchProvider>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ConversationThread modeConfig={{ surface: "watch", agentApprovals }} />
          <ConversationArtifactOverlay />
        </div>
      </ArtifactWorkbenchProvider>
    </ConversationScopeProvider>
  );
}
