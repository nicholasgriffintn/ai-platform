import {
  type FilesLocation,
  getFilesPath,
  parseFilesSubpath,
} from "@ngriffin_uk/polychat-library-react";
import { lazy, type ReactNode, Suspense } from "react";

import { PageShell } from "../Shell/PageShell.js";
import { FilesBreadcrumb } from "./FilesBreadcrumb.js";
import { FolderView } from "./FolderView.js";
import { FilesLibrary } from "./Library/FilesLibrary.js";
import { MemoryDocumentDetail } from "./MemoryDocumentDetail.js";
import { OutputDetail } from "./OutputDetail.js";
import { SourceDetail } from "./Sources/SourceDetail.js";

const ImageStudio = lazy(async () => ({
  default: (await import("./Studio/ImageStudio.js")).ImageStudio,
}));
const ReplicateStudio = lazy(async () => ({
  default: (await import("./Studio/Replicate/ReplicateStudio.js")).ReplicateStudio,
}));

function FilesView({
  location,
  basePath,
  projectId,
}: {
  location: FilesLocation;
  basePath: string;
  projectId?: string;
}) {
  switch (location.view) {
    case "library":
      return (
        <FilesLibrary
          key={`${projectId ?? "personal"}-${location.filter}`}
          basePath={basePath}
          projectId={projectId}
          filter={location.filter}
        />
      );
    case "folder":
      return (
        <FolderView
          key={location.folderId}
          basePath={basePath}
          projectId={projectId}
          folderId={location.folderId}
        />
      );
    case "output":
      return (
        <OutputDetail basePath={basePath} projectId={projectId} outputId={location.outputId} />
      );
    case "source":
      return (
        <SourceDetail basePath={basePath} projectId={projectId} sourceId={location.sourceId} />
      );
    case "memory":
      return (
        <MemoryDocumentDetail
          key={location.name}
          basePath={basePath}
          projectId={projectId}
          name={location.name}
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
