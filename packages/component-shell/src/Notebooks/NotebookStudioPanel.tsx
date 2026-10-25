import { isStudyOutputKind } from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { type NotebookActions, useUIStore } from "@ngriffin_uk/polychat-library-react";
import type { NotebookDetail, NotebookStudioRequestInput } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { StickyNote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AddNoteDialog } from "./AddNoteDialog.js";
import { NotebookStudioDialog } from "./NotebookStudioDialog.js";
import { OpenStudioItemPanel } from "./OpenStudioItemPanel.js";
import { studioEntries, type OpenStudioItem, type StudioEntry } from "./studio-entries.js";
import { STUDIO_TILES, type StudioTile } from "./studio-kinds.js";
import { StudioEntryRow } from "./StudioEntryRow.js";
import { StudioTileButton } from "./StudioTileButton.js";

export function NotebookStudioPanel({
  notebook,
  actions,
  selectedSourceIds,
  onAskAbout,
  onAsk,
}: {
  notebook: NotebookDetail;
  actions: NotebookActions;
  selectedSourceIds: readonly string[];
  onAskAbout: (topic: string) => void;
  onAsk: (prompt: string) => void;
}) {
  const [customising, setCustomising] = useState<StudioTile | null>(null);
  const [openItem, setOpenItem] = useState<OpenStudioItem | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const setOpenFile = useUIStore((state) => state.setOpenFile);
  const projectId = notebook.scope.kind === "project" ? notebook.scope.projectId : undefined;
  const entries = studioEntries(notebook);
  const hasSources = selectedSourceIds.length > 0;

  const start = async (request: NotebookStudioRequestInput) => {
    try {
      await actions.studio.mutateAsync({ ...request, sourceIds: [...selectedSourceIds] });
      setCustomising(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "That could not be started"));
    }
  };

  const openEntry = (entry: StudioEntry) => {
    if (entry.type === "output" && isStudyOutputKind(entry.output.kind)) {
      setOpenItem({ origin: "output", id: entry.output.id, title: entry.output.title });

      return;
    }

    if (entry.type === "source" && entry.source.kind === "podcast") {
      setOpenItem({ origin: "source", id: entry.source.id, title: entry.source.title });

      return;
    }

    setOpenFile(
      entry.type === "output"
        ? { origin: "output", id: entry.output.id, projectId }
        : { origin: "source", id: entry.source.id, projectId },
    );
  };

  if (openItem) {
    return (
      <OpenStudioItemPanel
        item={openItem}
        projectId={projectId}
        onBack={() => setOpenItem(null)}
        onAskAbout={onAskAbout}
        onAsk={onAsk}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-3">
      <div className="@container grid grid-cols-2 gap-2">
        {STUDIO_TILES.map((tile) => (
          <StudioTileButton
            key={tile.kind}
            tile={tile}
            disabled={!hasSources || actions.studio.isPending}
            onStart={() => void start({ kind: tile.kind })}
            onCustomise={() => setCustomising(tile)}
          />
        ))}
      </div>
      {!hasSources ? (
        <p className="text-xs text-muted-foreground">Tick at least one source to make something.</p>
      ) : null}
      <div className="flex items-center justify-between">
        <h3 className="polychat-eyebrow">Made here</h3>
        <Button
          variant="outline"
          size="xs"
          icon={<StickyNote className="size-3.5" />}
          onClick={() => setIsAddingNote(true)}
        >
          Add note
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Studio output lands here. Pick a tile, or save a reply from the chat as a note.
        </p>
      ) : null}
      <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {entries.map((entry) => (
          <StudioEntryRow
            key={entry.type === "output" ? entry.output.id : entry.source.id}
            entry={entry}
            onOpen={() => openEntry(entry)}
            onPromote={
              entry.type === "source" && entry.isNote
                ? () =>
                    actions.promoteNote.mutate(entry.source.id, {
                      onError: (error) =>
                        toast.error(getErrorMessage(error, "That note could not become a source")),
                    })
                : undefined
            }
          />
        ))}
      </ul>
      {customising ? (
        <NotebookStudioDialog
          tile={customising}
          sourceCount={selectedSourceIds.length}
          isStarting={actions.studio.isPending}
          onOpenChange={(open) => !open && setCustomising(null)}
          onStart={start}
        />
      ) : null}
      <AddNoteDialog open={isAddingNote} onOpenChange={setIsAddingNote} actions={actions} />
    </div>
  );
}
