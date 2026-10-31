import {
  ConversationThread,
  type ThreadModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  ComposerDraftProvider,
  ConversationScopeProvider,
  useLocalComposerDraft,
  useLocalConversationScope,
  useSubjectConversations,
  type ChatSuggestion,
} from "@ngriffin_uk/polychat-library-react";
import { DEFAULT_MODEL_TIER, type ConversationSubject } from "@ngriffin_uk/polychat-schemas";
import { useMemo, useState, type ReactNode, type Ref } from "react";

import { ConversationArtifactOverlay } from "../../../Conversations/ConversationArtifactOverlay.js";
import { useSubjectConversationSync } from "../../../Files/Viewer/useSubjectConversationSync.js";
import { DiscoverItemThumb } from "./DiscoverItemThumb.js";
import type { DiscoverItemSummary } from "./useDiscoverItemSummary.js";

const WIDE_QUERY = "(min-width: 1024px)";
const LINK_READING_TOOLS = ["web_search", "extract_content", "search_conversations"];

export interface DiscoverItemChatProps {
  itemKey: string;
  subject: ConversationSubject;
  summary: DiscoverItemSummary;
  suggestions: ChatSuggestion[];
  placeholder: string;
  readsLink: boolean;
  contentRef: Ref<HTMLDivElement>;
  renderHeader: (conversationId: string | undefined) => ReactNode;
  renderLead: (chatting: boolean) => ReactNode;
}

export function DiscoverItemChat({
  itemKey,
  subject,
  summary,
  suggestions,
  placeholder,
  readsLink,
  contentRef,
  renderHeader,
  renderLead,
}: DiscoverItemChatProps) {
  const conversations = useSubjectConversations(subject);
  const pending = !conversations.isFetchedAfterMount;
  const scope = useLocalConversationScope(undefined);
  const [adopted, setAdopted] = useState(false);

  if (!pending && !adopted) {
    setAdopted(true);

    const existingId = conversations.data?.[0]?.id;

    if (existingId && !scope.currentConversationId) {
      scope.setCurrentConversationId(existingId);
    }
  }

  const draft = useLocalComposerDraft();
  const modelTier = useChatStore((state) => state.modelTier) ?? DEFAULT_MODEL_TIER;
  const [focusOnOpen] = useState(() => window.matchMedia?.(WIDE_QUERY).matches ?? false);
  const [detached, setDetached] = useState(false);
  const chatting = Boolean(scope.currentConversationId);

  useSubjectConversationSync(scope.currentConversationId, subject);

  const requestOptions = useMemo<ThreadModeConfig["requestOptions"]>(
    () =>
      detached
        ? { model_tier: modelTier }
        : {
            model_tier: modelTier,
            conversation_subject: subject,
            ...(readsLink ? { enabled_tools: LINK_READING_TOOLS } : {}),
          },
    [detached, modelTier, readsLink, subject],
  );
  const chip = detached
    ? undefined
    : {
        label: summary.title,
        preview: <DiscoverItemThumb art={summary.art} className="size-5 rounded" />,
        onClear: chatting ? undefined : () => setDetached(true),
      };

  return (
    <ConversationScopeProvider scope={scope}>
      <ComposerDraftProvider draft={draft}>
        <ArtifactWorkbenchProvider>
          {renderHeader(scope.currentConversationId)}
          <div
            ref={contentRef}
            data-discover-panel-item={itemKey}
            className="relative min-h-0 flex-1 overflow-hidden"
          >
            <ConversationThread
              modeConfig={{
                surface: "subject",
                hideModelSelector: false,
                hideInlineResponseControls: false,
                composerDensity: "compact",
                lead: renderLead(chatting),
                welcomeTitle: "Ask about this",
                welcomeSuggestions: detached ? [] : suggestions,
                welcomeCapabilitySuggestions: false,
                submitSuggestions: true,
                focusComposerOnOpen: focusOnOpen && !pending,
                composerPending: pending,
                welcomeLoading: pending,
                composerSubject: chip,
                inputPlaceholder: {
                  newConversation: detached ? "Ask Poly anything" : placeholder,
                  followUp: "Ask a follow-up",
                },
                analyticsSource: "discover",
                requestOptions,
              }}
            />
            <ConversationArtifactOverlay />
          </div>
        </ArtifactWorkbenchProvider>
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}
