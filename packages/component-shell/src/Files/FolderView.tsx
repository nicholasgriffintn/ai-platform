import { Button, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { READING_FORMS, type SourceCollection } from "@ngriffin_uk/polychat-schemas";
import { Folder, Upload } from "lucide-react";
import { useNavigate } from "react-router";

import { FilesBreadcrumb } from "./FilesBreadcrumb.js";
import { FolderLedger } from "./Folders/FolderLedger.js";
import { FolderMenu } from "./Folders/FolderMenu.js";
import { CreateDialogs } from "./Library/CreateDialogs.js";
import { FileActionDialogs } from "./Library/FileActionDialogs.js";
import { FileDropZone } from "./Library/FileDropZone.js";
import { FilesBrowser } from "./Library/FilesBrowser.js";
import { UploadInput } from "./Library/UploadInput.js";
import { useFileActions } from "./Library/useFileActions.js";
import { useFileCreation } from "./Library/useFileCreation.js";
import { useFilesLibrary } from "./Library/useFilesLibrary.js";
import { PodcastFeedControls } from "./Sources/PodcastFeedControls.js";

function describeFolder(folder: SourceCollection): string {
  if (folder.kind === "topic") {
    return "A topic Poly keeps. New files about it are filed here on their own.";
  }

  if (folder.readAs) {
    return `Every file added here is read as a ${READING_FORMS[folder.readAs].singular}, with the figures below.`;
  }

  if (folder.kind === "entity") {
    return `Files about this ${folder.description ?? "subject"}, filed here on their own.`;
  }

  return (
    folder.description ??
    (folder.kind === "podcast"
      ? "A podcast show. Episodes published here appear in its feed."
      : "Everything here also stays in Files.")
  );
}

export function FolderView({
  basePath,
  projectId,
  folderId,
}: {
  basePath: string;
  projectId?: string;
  folderId: string;
}) {
  const navigate = useNavigate();
  const library = useFilesLibrary({ basePath, projectId, filter: "all", folderId });
  const creation = useFileCreation({ projectId, folderId });
  const actions = useFileActions({
    projectId,
    onDeleted: (item) => {
      if (item.origin === "folder") {
        void navigate(basePath);
      }
    },
  });
  const folder = library.collectionFolders.find((candidate) => candidate.id === folderId);

  if (library.areFoldersLoading) {
    return <CardGridLoadingSkeleton count={4} label="Loading folder" />;
  }

  if (!folder) {
    return (
      <div className="space-y-4">
        <FilesBreadcrumb basePath={basePath} trail={[{ label: "Folder" }]} />
        <EmptyState title="Folder unavailable" message="It may have been deleted." />
      </div>
    );
  }

  const isShow = folder.kind === "podcast";

  return (
    <FileDropZone
      label={`Drop to add to ${folder.title}`}
      onFiles={(files) => void creation.uploadFiles(files)}
    >
      <div className="space-y-6">
        <FilesBreadcrumb
          basePath={basePath}
          trail={[{ label: folder.title }]}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload size={15} />}
                isLoading={creation.isUploading}
                onClick={creation.openUploadPicker}
              >
                Upload
              </Button>
              {isShow ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => creation.openDialog("podcast")}
                >
                  New episode
                </Button>
              ) : null}
              <FolderMenu
                folder={folder}
                folders={library.folders}
                basePath={basePath}
                actions={actions}
              />
            </>
          }
        />
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
            <Folder size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold text-foreground">{folder.title}</h2>
            <p className="text-sm text-muted-foreground">{describeFolder(folder)}</p>
          </div>
        </div>
        {isShow ? <PodcastFeedControls show={folder} /> : null}
        {folder.readAs ? (
          <FolderLedger
            folder={{ ...folder, readAs: folder.readAs }}
            basePath={basePath}
            projectId={projectId}
          />
        ) : null}
        <FilesBrowser
          basePath={basePath}
          projectId={projectId}
          items={library.items}
          folderItems={[]}
          folders={library.folders}
          isLoading={library.isLoading}
          error={library.error}
          actions={actions}
          empty={
            <EmptyState
              icon={<Folder size={24} className="text-muted-foreground" />}
              title="Nothing in here yet"
              message={
                isShow
                  ? "Make an episode and publish it to this show."
                  : "Drop files here, or use Add to folder on anything in Files."
              }
              className="min-h-[220px]"
            />
          }
        />
      </div>
      <UploadInput creation={creation} />
      <CreateDialogs
        basePath={basePath}
        projectId={projectId}
        creation={creation}
        folders={library.folders}
        showId={isShow ? folder.id : undefined}
      />
      <FileActionDialogs actions={actions} />
    </FileDropZone>
  );
}
