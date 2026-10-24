import { isStudyOutputKind } from "@ngriffin_uk/polychat-component-content";
import { Button, FormDialog, FormInput, FormTextarea } from "@ngriffin_uk/polychat-component-ui";
import {
  type useNotebookActions,
  useOutput,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import type {
  NotebookDetail,
  NotebookStudioRequestInput,
  OutputSummary,
  SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import {
  ArrowLeft,
  LoaderCircle,
  Maximize2,
  Pencil,
  StickyNote,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { outputToFileItem, sourceToFileItem } from "../Files/Library/file-items.js";
import { FileTypeIcon } from "../Files/Library/FilePreview.js";
import { AudioOverviewStage } from "./AudioOverviewStage.js";
import { NotebookStudioDialog } from "./NotebookStudioDialog.js";
import {
  STUDIO_TILES,
  studioTileForOutputKind,
  studioTileForSource,
  type StudioTile,
} from "./studio-kinds.js";
import { StudyOutputStage } from "./StudyOutputStage.js";

type NotebookActions = ReturnType<typeof useNotebookActions>;

type StudioEntry =
  | { type: "output"; at: string; output: OutputSummary }
  | { type: "source"; at: string; source: SourceSummary; isNote: boolean };

function studioEntries(notebook: NotebookDetail): StudioEntry[] {
  return [
    ...notebook.outputs.map((output) => ({
      type: "output" as const,
      at: output.createdAt,
      output,
    })),
    ...notebook.media.map((source) => ({
      type: "source" as const,
      at: source.createdAt,
      source,
      isNote: false,
    })),
    ...notebook.notes.map((source) => ({
      type: "source" as const,
      at: source.createdAt,
      source,
      isNote: true,
    })),
  ].sort((left, right) => right.at.localeCompare(left.at));
}

function StudioTileButton({
  tile,
  disabled,
  onStart,
  onCustomise,
}: {
  tile: StudioTile;
  disabled: boolean;
  onStart: () => void;
  onCustomise: () => void;
}) {
  const Icon = tile.icon;

  return (
    <div className="group relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onStart}
        title={tile.description}
        className="flex h-full w-full cursor-pointer flex-col items-start gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm leading-tight text-foreground transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50 @[17rem]:flex-row @[17rem]:items-center @[17rem]:gap-2"
      >
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">{tile.label}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onCustomise}
        aria-label={`Customise ${tile.label.toLowerCase()}`}
        title="Customise"
        className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-selection hover:text-foreground focus-visible:opacity-100 disabled:hidden"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

function StudioEntryRow({
  entry,
  onOpen,
  onPromote,
}: {
  entry: StudioEntry;
  onOpen: () => void;
  onPromote?: () => void;
}) {
  const item =
    entry.type === "output"
      ? outputToFileItem(entry.output, "")
      : sourceToFileItem(entry.source, "");
  const tile =
    entry.type === "output"
      ? studioTileForOutputKind(entry.output.kind)
      : entry.isNote
        ? undefined
        : studioTileForSource(entry.source);
  const Icon = entry.type === "source" && entry.isNote ? StickyNote : tile?.icon;
  const label = entry.type === "source" && entry.isNote ? "Note" : (tile?.label ?? item.detail);
  const title = entry.type === "output" ? entry.output.title : entry.source.title;

  return (
    <li className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-selection">
      <span className="shrink-0 text-muted-foreground">
        {item.status === "processing" ? (
          <LoaderCircle className="size-4 animate-spin" aria-label="Being made" />
        ) : item.status === "failed" ? (
          <TriangleAlert className="size-4 text-failure" aria-label="Could not be made" />
        ) : Icon ? (
          <Icon className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <FileTypeIcon type={item.type} />
        )}
      </span>
      <button
        type="button"
        onClick={onOpen}
        disabled={item.status === "processing"}
        className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-default"
      >
        <span className="block truncate text-sm text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.status === "processing"
            ? `${label} · being made`
            : item.status === "failed"
              ? `${label} · could not be made`
              : `${label} · ${formatRelativeTime(entry.at)}`}
        </span>
      </button>
      {onPromote ? (
        <Button
          variant="outline"
          size="xs"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={onPromote}
        >
          Use as source
        </Button>
      ) : null}
    </li>
  );
}

interface OpenStudioItem {
  origin: "output" | "source";
  id: string;
  title: string;
}

function OpenOutputStage({
  outputId,
  onAskAbout,
}: {
  outputId: string;
  onAskAbout: (topic: string) => void;
}) {
  const { data: output } = useOutput(outputId);

  return output ? <StudyOutputStage output={output} onAskAbout={onAskAbout} /> : null;
}

function OpenStudioItemPanel({
  item,
  projectId,
  onBack,
  onAskAbout,
}: {
  item: OpenStudioItem;
  projectId?: string;
  onBack: () => void;
  onAskAbout: (topic: string) => void;
}) {
  const setOpenFile = useUIStore((state) => state.setOpenFile);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <Button variant="icon" aria-label="Back to Studio" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h3 className="min-w-0 flex-1 truncate font-medium">{item.title}</h3>
        <Button
          variant="icon"
          aria-label="Open larger"
          title="Open larger"
          onClick={() => setOpenFile({ origin: item.origin, id: item.id, projectId })}
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {item.origin === "output" ? (
          <OpenOutputStage outputId={item.id} onAskAbout={onAskAbout} />
        ) : (
          <AudioOverviewStage sourceId={item.id} />
        )}
      </div>
    </div>
  );
}

function AddNoteDialog({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: NotebookActions;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a note"
      submitText="Save note"
      isLoading={actions.addNote.isPending}
      submitDisabled={!content.trim()}
      onSubmit={async () => {
        try {
          await actions.addNote.mutateAsync({ title: title.trim() || "Note", content });
          setTitle("");
          setContent("");
          onOpenChange(false);
        } catch (error) {
          toast.error(getErrorMessage(error, "That note did not save"));
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <FormInput
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          fullWidth
        />
        <FormTextarea
          label="Note"
          rows={8}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}

export function NotebookStudioPanel({
  notebook,
  actions,
  selectedSourceIds,
  onAskAbout,
}: {
  notebook: NotebookDetail;
  actions: NotebookActions;
  selectedSourceIds: readonly string[];
  onAskAbout: (topic: string) => void;
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
