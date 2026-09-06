import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useQueryClient } from "@tanstack/react-query";
import { Feather, SquarePen } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

import { ConversationThread } from "~/components/ConversationThread";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { CHATS_QUERY_KEY } from "~/constants";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useChat } from "~/hooks/useChat";
import type { ChatSuggestion } from "~/lib/chat-suggestions";
import {
  buildMetaAssistantUiContext,
  getMetaNavigationHref,
  readMetaNavigationTarget,
} from "~/lib/meta-assistant";
import { ConversationScopeProvider, useLocalConversationScope } from "~/state/conversation-scope";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

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

function MetaAssistantThread({ onNavigate }: { onNavigate: (href: string) => void }) {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const metaConversationId = useUIStore((state) => state.metaAssistantConversationId);
  const setMetaConversationId = useUIStore((state) => state.setMetaAssistantConversationId);
  const openConversationId = useChatStore((state) => state.currentConversationId);
  const scope = useLocalConversationScope(metaConversationId, setMetaConversationId);
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
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-end px-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<SquarePen size={15} />}
            disabled={!scope.currentConversationId}
            onClick={() => scope.clearCurrentConversation()}
          >
            New conversation
          </Button>
        </div>
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
              hideDefaultControls: true,
              hideComposerActionMenu: true,
              hideChatSettings: true,
              hideInlineResponseControls: true,
              hideComposerSuggestions: true,
              toolSelectionLocked: true,
              analyticsSource: "meta-assistant",
            }}
          />
        </div>
      </div>
    </ConversationScopeProvider>
  );
}

export function MetaAssistantOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { trackEvent } = useTrackEvent();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const localOnlyMode = useChatStore((state) => state.localOnlyMode);
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
        <div className="border-border flex items-center gap-3 border-b px-4 py-3 pr-14">
          <Feather size={18} aria-hidden="true" className="text-active-work shrink-0" />
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold">Poly</DialogTitle>
            <DialogDescription className="truncate text-xs">
              Your home base for everything in Polychat.
            </DialogDescription>
          </div>
        </div>
        {!isAuthenticated ? (
          <div className="p-6">
            <SignInEmptyState
              title="Sign in to use Poly"
              message="Poly finds, opens and tidies your conversations, so it needs to know whose they are."
            />
          </div>
        ) : localOnlyMode ? (
          <div className="text-muted-foreground p-6 text-sm">
            Poly works on conversations stored in the cloud. Switch off local-only mode to use it.
          </div>
        ) : (
          <MetaAssistantThread onNavigate={handleNavigate} />
        )}
      </DialogContent>
    </Dialog>
  );
}
