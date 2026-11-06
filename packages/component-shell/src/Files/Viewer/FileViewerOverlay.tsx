import {
  getFileTargetPath,
  getPlacePaths,
  getProjectFilesPath,
  type StoredFileTarget,
  useProject,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";

import { FileViewer } from "./FileViewer.js";
import { FileViewerDialog } from "./FileViewerDialog.js";
import { MediaViewer } from "./MediaViewer.js";

function useFilesBasePath(target: StoredFileTarget): string | null {
  const project = useProject(target.projectId);

  if (!target.projectId) {
    return getPlacePaths("chat").files;
  }

  return project.data ? getProjectFilesPath(project.data.workspaceId, project.data.id) : null;
}

function OverlayViewer({ target, onClose }: { target: StoredFileTarget; onClose: () => void }) {
  const basePath = useFilesBasePath(target);
  const setOpenFile = useUIStore((state) => state.setOpenFile);

  if (!basePath) {
    return null;
  }

  return (
    <FileViewer
      target={target}
      basePath={basePath}
      chrome={{
        fullPageHref: getFileTargetPath(basePath, target),
        onClose,
        onOpenFile: setOpenFile,
      }}
      onDeleted={onClose}
    />
  );
}

export function FileViewerOverlay() {
  const openFile = useUIStore((state) => state.openFile);
  const setOpenFile = useUIStore((state) => state.setOpenFile);
  const close = () => setOpenFile(null);

  return (
    <FileViewerDialog open={openFile !== null} onClose={close}>
      {openFile?.origin === "media" ? <MediaViewer target={openFile} onClose={close} /> : null}
      {openFile && openFile.origin !== "media" ? (
        <OverlayViewer target={openFile} onClose={close} />
      ) : null}
    </FileViewerDialog>
  );
}
