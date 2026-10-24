import { cn, EmptyState, Tabs, TabsList, TabsTrigger } from "@ngriffin_uk/polychat-component-ui";
import {
  type CapabilitySurface,
  getNotebookPath,
  useNotebook,
  useNotebookActions,
} from "@ngriffin_uk/polychat-library-react";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { PageShell } from "../Shell/PageShell.js";
import { NotebookChatPanel } from "./NotebookChatPanel.js";
import { NotebookChatActions, NotebookHeader } from "./NotebookHeader.js";
import { NotebookPanel } from "./NotebookPanel.js";
import { NotebookSettingsDialog } from "./NotebookSettingsDialog.js";
import { NotebookSourcesPanel } from "./NotebookSourcesPanel.js";
import { NotebookStudioPanel } from "./NotebookStudioPanel.js";
import { useNotebookSourceSelection } from "./useNotebookSourceSelection.js";

const NOTEBOOK_PANES = ["sources", "chat", "studio"] as const;

type NotebookPane = (typeof NOTEBOOK_PANES)[number];

const PANE_LABELS: Record<NotebookPane, string> = {
  sources: "Sources",
  chat: "Chat",
  studio: "Studio",
};

export function NotebookPage({
  surface,
  notebookId,
  conversationId,
}: {
  surface: CapabilitySurface;
  notebookId: string;
  conversationId?: string;
}) {
  const navigate = useNavigate();
  const { data: notebook, isLoading, error } = useNotebook(notebookId);
  const actions = useNotebookActions(notebookId);
  const selection = useNotebookSourceSelection(notebook?.sources ?? []);
  const [pane, setPane] = useState<NotebookPane>("chat");
  const [collapsed, setCollapsed] = useState({ sources: false, studio: false });
  const [chat, setChat] = useState(() => ({ key: generateId(), conversationId }));
  const [pendingQuestion, setPendingQuestion] = useState<{ key: string; input: string } | null>(
    null,
  );
  const [isConfiguring, setIsConfiguring] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" aria-label="Opening the notebook" />
      </div>
    );
  }

  if (!notebook) {
    return (
      <PageShell.Content className="max-w-6xl">
        <EmptyState
          title="This notebook has flown"
          message={error?.message ?? "It may have been deleted, or it belongs to someone else."}
        />
      </PageShell.Content>
    );
  }

  const openConversation = (nextConversationId: string | undefined) => {
    setChat({ key: generateId(), conversationId: nextConversationId });
    setPendingQuestion(null);
    setPane("chat");
    void navigate(getNotebookPath(surface, notebookId, nextConversationId), { replace: true });
  };

  const askAbout = (topic: string) => {
    setPane("chat");
    setPendingQuestion({ key: generateId(), input: `Tell me about ${topic}, using the sources.` });
  };

  const toggle = (panel: "sources" | "studio") =>
    setCollapsed((current) => ({ ...current, [panel]: !current[panel] }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <NotebookHeader notebook={notebook} />
      <Tabs
        value={pane}
        onValueChange={(value) => setPane(NOTEBOOK_PANES.find((key) => key === value) ?? "chat")}
        className="px-4 pt-3 lg:hidden"
      >
        <TabsList className="w-full">
          {NOTEBOOK_PANES.map((key) => (
            <TabsTrigger key={key} value={key} className="flex-1">
              {PANE_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 gap-4 p-4",
          collapsed.sources ? "lg:[--sources:3rem]" : "lg:[--sources:clamp(14rem,24%,19rem)]",
          collapsed.studio ? "lg:[--studio:3rem]" : "lg:[--studio:clamp(15rem,26%,22rem)]",
          "lg:grid-cols-[var(--sources)_minmax(0,1fr)_var(--studio)]",
        )}
      >
        <NotebookPanel
          title="Sources"
          side="left"
          collapsed={collapsed.sources}
          onToggle={() => toggle("sources")}
          className={cn("lg:flex", pane === "sources" ? "flex" : "hidden")}
        >
          <NotebookSourcesPanel
            notebook={notebook}
            actions={actions}
            selection={selection}
            onOpenConversation={openConversation}
          />
        </NotebookPanel>
        <NotebookPanel
          title="Chat"
          side="centre"
          actions={
            <NotebookChatActions
              notebook={notebook}
              conversationId={chat.conversationId}
              onSelectConversation={openConversation}
              onOpenSettings={() => setIsConfiguring(true)}
            />
          }
          className={cn("lg:flex", pane === "chat" ? "flex" : "hidden")}
        >
          <NotebookChatPanel
            key={chat.key}
            notebook={notebook}
            conversationId={chat.conversationId}
            selectedSourceIds={selection.selectedIds}
            pendingQuestion={pendingQuestion}
            actions={actions}
            onConversationChange={(nextConversationId) =>
              void navigate(getNotebookPath(surface, notebookId, nextConversationId), {
                replace: true,
              })
            }
          />
        </NotebookPanel>
        <NotebookPanel
          title="Studio"
          side="right"
          collapsed={collapsed.studio}
          onToggle={() => toggle("studio")}
          className={cn("lg:flex", pane === "studio" ? "flex" : "hidden")}
        >
          <NotebookStudioPanel
            notebook={notebook}
            actions={actions}
            selectedSourceIds={selection.selectedIds}
            onAskAbout={askAbout}
          />
        </NotebookPanel>
      </div>
      {isConfiguring ? (
        <NotebookSettingsDialog
          open
          onOpenChange={setIsConfiguring}
          notebook={notebook}
          actions={actions}
        />
      ) : null}
    </div>
  );
}
