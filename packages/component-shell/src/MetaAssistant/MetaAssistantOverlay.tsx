import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { CHATS_QUERY_KEY, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  buildMetaAssistantUiContext,
  type ChatSuggestion,
  ComposerDraftProvider,
  type ConversationScope,
  ConversationScopeProvider,
  getMetaNavigationHref,
  readMetaNavigationTarget,
  useChat,
  useLocalComposerDraft,
  useLocalConversationScope,
  useTrackEvent,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { useQueryClient } from "@tanstack/react-query";
import { Feather, SquarePen } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";

const POLY_PET_PRESET_SLUG = "pip";

const META_SUGGESTIONS: ChatSuggestion[] = [
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

function MetaAssistantThread({
  scope,
  onNavigate,
}: {
  scope: ConversationScope;
  onNavigate: (href: string) => void;
}) {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const openConversationId = useChatStore((state) => state.currentConversationId);
  const draft = useLocalComposerDraft();
  const { data: conversation } = useChat(scope.currentConversationId);
  const handledMessageIdsRef = useRef(new Set<string>());
  const uiContext = useMemo(
    () => buildMetaAssistantUiContext(pathname, openConversationId),
    [openConversationId, pathname],
  );

  useEffect(() => {
    const messages = conversation?.messages ?? [];

    for (const message of messages) {
      if (message.role !== "tool" || !message.id || handledMessageIdsRef.current.has(message.id)) {
        continue;
      }

      handledMessageIdsRef.current.add(message.id);

      if (message.name === "organise_conversation") {
        void queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY] });
      }

      const target = readMetaNavigationTarget(message.data);

      if (target) {
        onNavigate(getMetaNavigationHref(target));
      }
    }
  }, [conversation?.messages, onNavigate, queryClient]);

  return (
    <ConversationScopeProvider scope={scope}>
      <ComposerDraftProvider draft={draft}>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ConversationThread
            modeConfig={{
              requestOptions: { meta_assistant: { ui_context: uiContext } },
              welcomeTitle: "This is Poly.",
              welcomeDescription:
                "Ask it to find, open, tidy or summarise anything in Polychat. It operates the product; it does not do your outside work.",
              welcomeSuggestions: META_SUGGESTIONS,
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
              analyticsSource: "meta-assistant",
            }}
          />
        </div>
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}

export function MetaAssistantOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { trackEvent } = useTrackEvent();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const metaConversationId = useUIStore((state) => state.metaAssistantConversationId);
  const setMetaConversationId = useUIStore((state) => state.setMetaAssistantConversationId);
  const scope = useLocalConversationScope(metaConversationId, setMetaConversationId);
  const canUsePoly = isAuthenticated;
  const handleNavigate = (href: string) => {
    trackEvent({
      name: "meta_assistant_navigate",
      category: "navigation",
      label: "meta_assistant",
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
          <MetaAssistantThread scope={scope} onNavigate={handleNavigate} />
        )}
      </DialogContent>
    </Dialog>
  );
}
