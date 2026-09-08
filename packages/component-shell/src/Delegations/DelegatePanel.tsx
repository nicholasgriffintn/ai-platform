import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import {
  ConversationScopeProvider,
  useLocalConversationScope,
} from "@ngriffin_uk/polychat-library-react";

export function DelegatePanel({ conversationId }: { conversationId: string }) {
  const scope = useLocalConversationScope(conversationId);

  return (
    <ConversationScopeProvider scope={scope}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ConversationThread
          modeConfig={{
            hideModelSelector: true,
            hideChatSettings: true,
            hideComposerActionMenu: true,
            hideInlineResponseControls: true,
            hideVoiceControls: true,
            toolSelectionLocked: true,
            inputPlaceholder: {
              newConversation: "Read this delegate",
              followUp: "Message delegate",
            },
          }}
        />
      </div>
    </ConversationScopeProvider>
  );
}
