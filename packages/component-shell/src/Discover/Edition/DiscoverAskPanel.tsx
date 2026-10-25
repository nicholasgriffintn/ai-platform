import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  ComposerDraftProvider,
  ConversationScopeProvider,
  useLocalComposerDraft,
  useLocalConversationScope,
} from "@ngriffin_uk/polychat-library-react";
import {
  DEFAULT_MODEL_TIER,
  type ConversationSubject,
  type DiscoverCard,
} from "@ngriffin_uk/polychat-schemas";

import { discoverCardSuggestions } from "./discover-card-drafts.js";

export function DiscoverAskPanel({ editionId, card }: { editionId: string; card: DiscoverCard }) {
  const scope = useLocalConversationScope(undefined);
  const modelTier = useChatStore((state) => state.modelTier);
  const draft = useLocalComposerDraft();
  const subject: ConversationSubject =
    card.kind === "read" && card.sourceId
      ? { type: "source", id: card.sourceId }
      : { type: "output", id: editionId };

  return (
    <ConversationScopeProvider scope={scope}>
      <ComposerDraftProvider draft={draft}>
        <ArtifactWorkbenchProvider>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <ConversationThread
              modeConfig={{
                surface: "subject",
                welcomeTitle: "Take it further",
                welcomeDescription: "Ask Poly anything about this, or pick a place to start.",
                welcomeSuggestions: discoverCardSuggestions(card),
                welcomeCapabilitySuggestions: false,
                inputPlaceholder: {
                  newConversation: "Ask about this",
                  followUp: "Ask a follow-up",
                },
                analyticsSource: "discover",
                requestOptions: {
                  conversation_subject: subject,
                  model_tier: modelTier ?? DEFAULT_MODEL_TIER,
                  ...(card.kind === "read" && !card.sourceId
                    ? { enabled_tools: ["web_search", "extract_content", "search_conversations"] }
                    : {}),
                },
              }}
            />
          </div>
        </ArtifactWorkbenchProvider>
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}
