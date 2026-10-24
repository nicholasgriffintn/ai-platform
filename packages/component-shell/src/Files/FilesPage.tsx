import {
  FILE_LOCATION_SECTIONS,
  type FilesFilter,
  type FilesLocation,
  getFilesFilterPath,
  getFilesPath,
  isFilesFileLocation,
  parseFilesSubpath,
} from "@ngriffin_uk/polychat-library-react";
import { lazy, type ReactNode, Suspense, useState } from "react";

import { PageShell } from "../Shell/PageShell.js";
import { FilesBreadcrumb } from "./FilesBreadcrumb.js";
import { FolderView } from "./FolderView.js";
import { FilesLibrary } from "./Library/FilesLibrary.js";
import { FilesPageViewer } from "./Viewer/FilesPageViewer.js";

const ImageStudio = lazy(async () => ({
  default: (await import("./Studio/ImageStudio.js")).ImageStudio,
}));
const ReplicateStudio = lazy(async () => ({
  default: (await import("./Studio/Replicate/ReplicateStudio.js")).ReplicateStudio,
}));

function useLibraryFilter(location: FilesLocation): FilesFilter {
  const [filter, setFilter] = useState<FilesFilter>(
    location.view === "library"
      ? location.filter
      : isFilesFileLocation(location)
        ? FILE_LOCATION_SECTIONS[location.view]
        : "all",
  );

  if (location.view === "library" && location.filter !== filter) {
    setFilter(location.filter);
  }

  return filter;
}

function FilesView({
  location,
  basePath,
  projectId,
}: {
  location: FilesLocation;
  basePath: string;
  projectId?: string;
}) {
  const libraryFilter = useLibraryFilter(location);

  if (location.view === "library" || isFilesFileLocation(location)) {
    return (
      <>
        <FilesLibrary
          key={`${projectId ?? "personal"}-${libraryFilter}`}
          basePath={basePath}
          projectId={projectId}
          filter={libraryFilter}
        />
        {isFilesFileLocation(location) ? (
          <FilesPageViewer
            location={location}
            basePath={basePath}
            projectId={projectId}
            returnPath={getFilesFilterPath(basePath, libraryFilter)}
          />
        ) : null}
      </>
    );
  }

  switch (location.view) {
    case "folder":
      return (
        <FolderView
          key={location.folderId}
          basePath={basePath}
          projectId={projectId}
          folderId={location.folderId}
        />
      );
    case "studio":
      return (
        <div className="space-y-4">
          <FilesBreadcrumb basePath={basePath} trail={[{ label: "Image studio" }]} />
          <Suspense fallback={null}>
            <ImageStudio projectId={projectId} />
          </Suspense>
        </div>
      );
  }

  return (
    <div className="space-y-4">
      <FilesBreadcrumb basePath={basePath} trail={[{ label: "Replicate" }]} />
      <Suspense fallback={null}>
        <ReplicateStudio
          basePath={getFilesPath(basePath, "replicate")}
          subpath={location.subpath}
          projectId={projectId}
        />
      </Suspense>
    </div>
  );
}

export function FilesPage({
  basePath,
  projectId,
  subpath,
  header,
}: {
  basePath: string;
  projectId?: string;
  subpath: string;
  header?: ReactNode;
}) {
  return (
    <PageShell.Content className="max-w-6xl">
      {header ?? <PageShell.Header title="Files" />}
      <FilesView location={parseFilesSubpath(subpath)} basePath={basePath} projectId={projectId} />
    </PageShell.Content>
  );
}
