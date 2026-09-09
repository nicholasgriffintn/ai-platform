import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import {
  ConversationScopeProvider,
  useConversationAgentApprovals,
  useLocalConversationScope,
} from "@ngriffin_uk/polychat-library-react";

export function DelegatePanel({
  conversationId,
  canControl = true,
}: {
  conversationId: string;
  canControl?: boolean;
}) {
  const scope = useLocalConversationScope(conversationId);
  const agentApprovals = useConversationAgentApprovals(scope.currentConversationId);

  return (
    <ConversationScopeProvider scope={scope}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ConversationThread
          modeConfig={{
            agentApprovals,
            hideModelSelector: true,
            hideChatSettings: true,
            hideComposerActionMenu: true,
            hideInlineResponseControls: true,
            hideVoiceControls: true,
            toolSelectionLocked: true,
            hideTextInput: !canControl,
            hideSubmitButton: !canControl,
            inputPlaceholder: {
              newConversation: canControl
                ? "Read this delegate"
                : "Only the starter can steer this delegate",
              followUp: canControl
                ? "Message delegate"
                : "Only the starter can steer this delegate",
            },
          }}
        />
      </div>
    </ConversationScopeProvider>
  );
}
