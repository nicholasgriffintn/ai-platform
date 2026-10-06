import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
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
  usePolyHome,
  usePolyStandingApprovals,
  useTrackEvent,
} from "@ngriffin_uk/polychat-library-react";
import { Feather, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PolyAgendaStrip } from "./PolyAgendaStrip.js";
import { PolyAutonomyMenu } from "./PolyAutonomyMenu.js";
import { usePolyNavigation } from "./usePolyNavigation.js";

const POLY_PET_PRESET_SLUG = "pip";

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

function PolyThread({
  conversationId,
  onNavigate,
}: {
  conversationId: string;
  onNavigate: (href: string) => void;
}) {
  const scope = useLocalConversationScope(conversationId);
  const standingApprovals = usePolyStandingApprovals();
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
                petPresetSlug: POLY_PET_PRESET_SLUG,
                hideComposerActionMenu: true,
                hideChatSettings: true,
                hideInlineResponseControls: true,
                hideComposerSuggestions: true,
                hideModelSelector: true,
                hideVoiceControls: true,
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

function PolyHomeThread({ onNavigate }: { onNavigate: (href: string) => void }) {
  const home = usePolyHome(true);

  if (home.isError) {
    return (
      <div className="p-6">
        <EmptyState
          title="Poly is not available right now"
          message="Its conversation could not be opened. Close this and try again in a moment."
        />
      </div>
    );
  }

  if (!home.data) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status">
        <Loader2 size={20} aria-hidden="true" className="animate-spin text-muted-foreground" />
        <span className="sr-only">Opening Poly</span>
      </div>
    );
  }

  return (
    <>
      <PolyAgendaStrip />
      <PolyThread
        key={home.data.conversation_id}
        conversationId={home.data.conversation_id}
        onNavigate={onNavigate}
      />
    </>
  );
}

export function PolyOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { trackEvent } = useTrackEvent();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const handleNavigate = (href: string) => {
    trackEvent({
      name: "poly_navigate",
      category: "navigation",
      label: "poly",
      value: 1,
    });
    void navigate(href);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} width="min(56rem, 96vw)">
      <DialogContent className="flex h-[min(44rem,92dvh)] flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 pr-14">
          <Feather size={18} aria-hidden="true" className="shrink-0 text-active-work" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold">Poly</DialogTitle>
            <DialogDescription className="truncate text-xs">
              One conversation that carries on wherever you are in Polychat.
            </DialogDescription>
          </div>
          {isAuthenticated ? <PolyAutonomyMenu /> : null}
        </div>
        {!isAuthenticated ? (
          <div className="p-6">
            <SignInEmptyState
              title="Sign in to use Poly"
              message="Poly finds, opens and tidies your conversations, so it needs to know whose they are."
            />
          </div>
        ) : (
          <PolyHomeThread onNavigate={handleNavigate} />
        )}
      </DialogContent>
    </Dialog>
  );
}
