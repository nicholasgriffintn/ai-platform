import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  buildPolyUiContext,
  type ChatSuggestion,
  ComposerDraftProvider,
  ConversationScopeProvider,
  useChat,
  useConversationAgentApprovals,
  useLocalComposerDraft,
  useLocalConversationScope,
  usePolyStandingApprovals,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { useMemo } from "react";
import { useLocation } from "react-router";

import { usePolyNavigation } from "./usePolyNavigation.js";

const POLY_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "poly-find",
    label: "Find the conversation where we planned the launch",
    prompt: "Find the conversation where we planned the launch",
    category: "Find",
  },
  {
    id: "poly-recent",
    label: "What have I been working on this week?",
    prompt: "List my recent conversations and tell me what I have been working on this week",
    category: "Find",
  },
  {
    id: "poly-research",
    label: "Research three venues for a team offsite in Lisbon",
    prompt:
      "Research three venues for a team offsite in Lisbon and write up the options as a document",
    category: "Do",
  },
  {
    id: "poly-remember",
    label: "Remember that I prefer meetings before noon",
    prompt: "Remember that I prefer meetings before noon",
    category: "Remember",
  },
  {
    id: "poly-attention",
    label: "Take me to what needs my attention",
    prompt: "Open Attention",
    category: "Open",
  },
];

export function PolyThread({
  conversationId,
  onNavigate,
}: {
  conversationId: string;
  onNavigate: (href: string) => void;
}) {
  const scope = useLocalConversationScope(conversationId);
  const standingApprovals = usePolyStandingApprovals();
  const polySpeaks = useUIStore((state) => state.polySpeaks);
  const { pathname } = useLocation();
  const openConversationId = useChatStore((state) => state.currentConversationId);
  const draft = useLocalComposerDraft();
  const { data: conversation } = useChat(scope.currentConversationId);
  const agentApprovals = useConversationAgentApprovals(scope.currentConversationId);
  const uiContext = useMemo(
    () => buildPolyUiContext(pathname, openConversationId),
    [openConversationId, pathname],
  );

  usePolyNavigation(conversation, scope.currentConversationId, onNavigate);

  return (
    <ConversationScopeProvider scope={scope}>
      <ComposerDraftProvider draft={draft}>
        <ArtifactWorkbenchProvider>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <ConversationThread
              modeConfig={{
                agentApprovals,
                requestOptions: { poly: { ui_context: uiContext } },
                welcomeTitle: "This is Poly.",
                welcomeDescription:
                  "Ask it to find or tidy anything in Polychat, look things up, remember what matters, or hand longer work to a teammate. This conversation carries on, so pick up wherever you left off.",
                welcomeSuggestions: POLY_SUGGESTIONS,
                welcomeCapabilitySuggestions: false,
                inputPlaceholder: { newConversation: "Ask Poly…", followUp: "Ask Poly…" },
                hideComposerActionMenu: true,
                hideChatSettings: true,
                hideInlineResponseControls: true,
                hideComposerSuggestions: true,
                hideModelSelector: true,
                isPolyThread: true,
                forceAutoPlayResponses: polySpeaks,
                toolSelectionLocked: true,
                analyticsSource: "poly",
                onToolInteraction: async (_toolName, action, data) => {
                  if (
                    action === "submitPrompt" &&
                    data.standing === true &&
                    typeof data.interactionId === "string"
                  ) {
                    await standingApprovals.grant.mutateAsync(data.interactionId);
                  }

                  return false;
                },
              }}
            />
          </div>
        </ArtifactWorkbenchProvider>
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}
