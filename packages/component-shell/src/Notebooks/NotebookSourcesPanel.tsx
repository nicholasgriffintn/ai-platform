import { Button, Checkbox, cn } from "@ngriffin_uk/polychat-component-ui";
import { type NotebookActions, useUIStore } from "@ngriffin_uk/polychat-library-react";
import type { NotebookDetail } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { ChevronRight, LoaderCircle, MessagesSquare, Plus, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { sourceToFileItem } from "../Files/Library/file-items.js";
import { FileTypeIcon } from "../Files/Library/FilePreview.js";
import { NotebookAddSourcesDialog } from "./NotebookAddSourcesDialog.js";
import { NotebookResearchBox } from "./NotebookResearchBox.js";
import { NotebookSyncsRow } from "./NotebookSyncsRow.js";
import type { NotebookSourceSelection } from "./useNotebookSourceSelection.js";

export function NotebookSourcesPanel({
  notebook,
  actions,
  selection,
  onOpenConversation,
}: {
  notebook: NotebookDetail;
  actions: NotebookActions;
  selection: NotebookSourceSelection;
  onOpenConversation: (conversationId: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [showChats, setShowChats] = useState(false);
  const setOpenFile = useUIStore((state) => state.setOpenFile);
  const projectId = notebook.scope.kind === "project" ? notebook.scope.projectId : undefined;

  const remove = async (sourceId: string) => {
    try {
      await actions.removeSource.mutateAsync(sourceId);
    } catch (error) {
      toast.error(getErrorMessage(error, "That source could not be removed"));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <Button
        variant="secondary"
        icon={<Plus className="size-4" />}
        onClick={() => setIsAdding(true)}
        fullWidth
      >
        Add sources
      </Button>
      <NotebookResearchBox actions={actions} />
      {notebook.sources.length > 0 ? (
        <label className="flex cursor-pointer items-center justify-between px-2 text-xs text-muted-foreground">
          <span>Select all</span>
          <Checkbox
            checked={selection.isAllSelected}
            onCheckedChange={(checked) => selection.setAll(checked === true)}
          />
        </label>
      ) : null}
      {notebook.sources.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">
          Saved sources appear here. Add a PDF, a web page, a YouTube video or some text, and every
          chat in this notebook will read from it.
        </p>
      ) : null}
      <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {notebook.sources.map((source) => {
          const item = sourceToFileItem(source, "");
          const isReady = source.status === "available";

          return (
            <li
              key={source.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-selection"
            >
              <span className="shrink-0 text-muted-foreground">
                {source.status === "processing" ? (
                  <LoaderCircle className="size-4 animate-spin" aria-label="Still reading" />
                ) : source.status === "failed" ? (
                  <TriangleAlert className="size-4 text-failure" aria-label="Could not be read" />
                ) : (
                  <FileTypeIcon type={item.type} />
                )}
              </span>
              <button
                type="button"
                onClick={() => setOpenFile({ origin: "source", id: source.id, projectId })}
                className={cn(
                  "min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-foreground",
                  !isReady && "text-muted-foreground",
                )}
                title={source.title}
              >
                {source.title}
              </button>
              <button
                type="button"
                onClick={() => void remove(source.id)}
                aria-label={`Remove ${source.title} from the notebook`}
                title="Remove from notebook"
                className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
              <Checkbox
                aria-label={`Use ${source.title}`}
                disabled={!isReady}
                checked={isReady && selection.isSelected(source.id)}
                onCheckedChange={() => selection.toggle(source.id)}
              />
            </li>
          );
        })}
        {notebook.conversations.length > 0 ? (
          <li className="flex flex-col">
            <button
              type="button"
              aria-expanded={showChats}
              onClick={() => setShowChats((current) => !current)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-selection hover:text-foreground"
            >
              <MessagesSquare className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                Chats in this notebook ({notebook.conversations.length})
              </span>
              <ChevronRight
                className={cn("size-4 shrink-0 transition-transform", showChats && "rotate-90")}
                aria-hidden="true"
              />
            </button>
            {showChats ? (
              <ul className="ml-6 flex flex-col gap-0.5 border-l border-border pl-2">
                {notebook.conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => onOpenConversation(conversation.id)}
                      className="w-full cursor-pointer truncate rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-selection"
                    >
                      {conversation.title || "New conversation"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ) : null}
        <NotebookSyncsRow notebookId={notebook.id} />
      </ul>
      <NotebookAddSourcesDialog
        open={isAdding}
        onOpenChange={setIsAdding}
        notebook={notebook}
        actions={actions}
      />
    </div>
  );
}
