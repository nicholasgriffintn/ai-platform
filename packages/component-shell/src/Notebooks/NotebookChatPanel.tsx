import { ConversationThread } from "@ngriffin_uk/polychat-component-conversation";
import { getMessageTextContent } from "@ngriffin_uk/polychat-library-chat/messages";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  ArtifactWorkbenchProvider,
  type ChatSuggestion,
  ComposerDraftProvider,
  ConversationScopeProvider,
  noteFromReply,
  type NotebookActions,
  useLocalComposerDraft,
  useLocalConversationScope,
} from "@ngriffin_uk/polychat-library-react";
import { DEFAULT_MODEL_TIER, type NotebookDetail } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

function guideSuggestions(notebook: NotebookDetail): ChatSuggestion[] | null {
  return (
    notebook.guide?.questions.map((question, index) => ({
      id: `notebook-guide-${index}`,
      label: question,
      prompt: question,
      category: "research",
    })) ?? null
  );
}

export function NotebookChatPanel({
  notebook,
  conversationId,
  selectedSourceIds,
  pendingQuestion,
  actions,
  onConversationChange,
}: {
  notebook: NotebookDetail;
  conversationId?: string;
  selectedSourceIds: readonly string[];
  pendingQuestion: { key: string; input: string } | null;
  actions: NotebookActions;
  onConversationChange: (conversationId: string | undefined) => void;
}) {
  const scope = useLocalConversationScope(conversationId, onConversationChange);
  const draft = useLocalComposerDraft();
  const modelTier = useChatStore((state) => state.modelTier);
  const projectId = notebook.scope.kind === "project" ? notebook.scope.projectId : undefined;
  const isWritingGuide = notebook.guideStatus === "writing";

  return (
    <ConversationScopeProvider scope={scope}>
      <ComposerDraftProvider draft={draft}>
        <ArtifactWorkbenchProvider>
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <ConversationThread
              modeConfig={{
                surface: "chat",
                welcomeTitle: notebook.name,
                welcomeDescription:
                  notebook.sources.length === 0
                    ? "Add a source on the left and this notebook will answer from it."
                    : "Ask about your sources, or ask Studio to make something from them.",
                welcomeOpening:
                  notebook.guide && notebook.guideStatus === "current"
                    ? { label: "Summary", markdown: notebook.guide.summary }
                    : undefined,
                welcomeLoading: isWritingGuide,
                welcomeSuggestions: guideSuggestions(notebook),
                welcomeCapabilitySuggestions: false,
                submitSuggestions: true,
                initialAutoSubmit: pendingQuestion ?? undefined,
                inputPlaceholder: {
                  newConversation: `Ask about ${selectedSourceIds.length === 1 ? "1 source" : `${selectedSourceIds.length} sources`}`,
                  followUp: "Ask a follow-up",
                },
                analyticsSource: "notebook",
                onSaveToNote: (message) => {
                  const content = getMessageTextContent(message)?.trim();

                  if (!content) {
                    return;
                  }

                  actions.addNote.mutate(noteFromReply(content), {
                    onSuccess: () => toast.success("Saved to the notebook's notes"),
                    onError: (error) =>
                      toast.error(getErrorMessage(error, "That reply could not be saved")),
                  });
                },
                requestOptions: {
                  conversation_notebook: {
                    id: notebook.id,
                    source_ids: [...selectedSourceIds],
                  },
                  model_tier: modelTier ?? DEFAULT_MODEL_TIER,
                  ...(projectId ? { metadata: { project_id: projectId } } : {}),
                },
              }}
            />
          </div>
        </ArtifactWorkbenchProvider>
      </ComposerDraftProvider>
    </ConversationScopeProvider>
  );
}
