import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type { FilesFilter } from "@ngriffin_uk/polychat-library-react";
import { BookOpenText, FolderOpen, Puzzle } from "lucide-react";

import { MemorySynthesisPanel } from "../MemorySynthesisPanel.js";
import { RulesLearnedPanel } from "../RulesLearnedPanel.js";
import { CreateDialogs } from "./CreateDialogs.js";
import { CreateTiles } from "./CreateTiles.js";
import { FileActionDialogs } from "./FileActionDialogs.js";
import { FileDropZone } from "./FileDropZone.js";
import { FilesBrowser } from "./FilesBrowser.js";
import { KnowledgeSyncPanel } from "./KnowledgeSyncPanel.js";
import { UploadInput } from "./UploadInput.js";
import { useFileActions } from "./useFileActions.js";
import { useFileCreation } from "./useFileCreation.js";
import { useFilesLibrary } from "./useFilesLibrary.js";

const EMPTY_STATES: Record<FilesFilter, { title: string; message: string; Icon: typeof Puzzle }> = {
  all: {
    title: "An empty nest, for now",
    message: "Drop files here, start a note, or ask a teammate to make something.",
    Icon: FolderOpen,
  },
  made: {
    title: "Nothing made yet",
    message: "Ask a teammate or run an app and the result lands here.",
    Icon: Puzzle,
  },
  sources: {
    title: "No sources yet",
    message: "Drop files here or start a note so Polychat has something to read.",
    Icon: FolderOpen,
  },
  memory: {
    title: "Nothing remembered yet",
    message: "Memories are documents you can read, edit and delete. Start one above.",
    Icon: BookOpenText,
  },
};

export function FilesLibrary({
  basePath,
  projectId,
  filter,
}: {
  basePath: string;
  projectId?: string;
  filter: FilesFilter;
}) {
  const library = useFilesLibrary({ basePath, projectId, filter });
  const creation = useFileCreation({ projectId });
  const actions = useFileActions({ projectId });
  const emptyState = EMPTY_STATES[filter];

  return (
    <FileDropZone
      label="Drop to add to Files"
      onFiles={(files) => void creation.uploadFiles(files)}
    >
      <div className="space-y-8">
        <CreateTiles basePath={basePath} creation={creation} />
        {projectId && (filter === "all" || filter === "sources") ? (
          <KnowledgeSyncPanel projectId={projectId} />
        ) : null}
        <FilesBrowser
          basePath={basePath}
          projectId={projectId}
          filter={filter}
          items={library.items}
          folderItems={library.folderItems}
          folders={library.folders}
          isLoading={library.isLoading}
          error={library.error}
          actions={actions}
          empty={
            <EmptyState
              icon={<emptyState.Icon size={24} className="text-muted-foreground" />}
              title={emptyState.title}
              message={emptyState.message}
              className="min-h-[220px]"
            />
          }
        />
        {filter === "memory" && !projectId ? (
          <div className="space-y-6">
            <MemorySynthesisPanel />
            <RulesLearnedPanel />
          </div>
        ) : null}
      </div>
      <UploadInput creation={creation} />
      <CreateDialogs
        basePath={basePath}
        projectId={projectId}
        creation={creation}
        folders={library.folders}
      />
      <FileActionDialogs actions={actions} />
    </FileDropZone>
  );
}
