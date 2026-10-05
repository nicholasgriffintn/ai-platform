import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  buildPolyUiContext,
  type ChatSuggestion,
  ComposerDraftProvider,
  type ConversationScope,
  ConversationScopeProvider,
  useChat,
  useConversationAgentApprovals,
  useLocalComposerDraft,
  useLocalConversationScope,
  useTrackEvent,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { Feather, SquarePen } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { usePolyNavigation } from "./usePolyNavigation.js";

const POLY_PET_PRESET_SLUG = "pip";

const POLY_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "meta-find",
    label: "Find the conversation where we planned the launch",
    prompt: "Find the conversation where we planned the launch",
    category: "Find",
  },
  {
    id: "meta-archive",
    label: "Archive the conversation I have open",
    prompt: "Archive the conversation I have open",
    category: "Tidy",
  },
  {
    id: "meta-recent",
    label: "What have I been working on this week?",
    prompt: "List my recent conversations and tell me what I have been working on this week",
    category: "Find",
  },
  {
    id: "meta-summarise",
    label: "Summarise the thread I have open",
    prompt: "Summarise the conversation I have open",
    category: "Read",
  },
  {
    id: "meta-attention",
    label: "Take me to what needs my attention",
    prompt: "Open Attention",
    category: "Open",
  },
];

function PolyThread({
  scope,
  onNavigate,
}: {
  scope: ConversationScope;
  onNavigate: (href: string) => void;
}) {
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
                  "Ask it to find, open, tidy or summarise anything in Polychat. It operates the product; it does not do your outside work.",
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
              }}
            />
          </div>
        </ArtifactWorkbenchProvider>
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}

export function PolyOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { trackEvent } = useTrackEvent();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const metaConversationId = useUIStore((state) => state.polyConversationId);
  const setMetaConversationId = useUIStore((state) => state.setPolyConversationId);
  const scope = useLocalConversationScope(metaConversationId, setMetaConversationId);
  const canUsePoly = isAuthenticated;
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
              Your home base for everything in Polychat.
            </DialogDescription>
          </div>
          {canUsePoly ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              icon={<SquarePen size={15} />}
              disabled={!scope.currentConversationId}
              onClick={() => scope.clearCurrentConversation()}
            >
              New conversation
            </Button>
          ) : null}
        </div>
        {!isAuthenticated ? (
          <div className="p-6">
            <SignInEmptyState
              title="Sign in to use Poly"
              message="Poly finds, opens and tidies your conversations, so it needs to know whose they are."
            />
          </div>
        ) : (
          <PolyThread scope={scope} onNavigate={handleNavigate} />
        )}
      </DialogContent>
    </Dialog>
  );
}
