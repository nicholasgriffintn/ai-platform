import {
  type FileTarget,
  getFileTargetPath,
  getPlacePaths,
  getProjectFilesPath,
  useProject,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";

import { FileViewer } from "./FileViewer.js";
import { FileViewerDialog } from "./FileViewerDialog.js";

function useFilesBasePath(target: FileTarget): string | null {
  const project = useProject(target.projectId);

  if (!target.projectId) {
    return getPlacePaths("chat").files;
  }

  return project.data ? getProjectFilesPath(project.data.workspaceId, project.data.id) : null;
}

function OverlayViewer({ target, onClose }: { target: FileTarget; onClose: () => void }) {
  const basePath = useFilesBasePath(target);

  if (!basePath) {
    return null;
  }

  return (
    <FileViewer
      target={target}
      basePath={basePath}
      chrome={{ fullPageHref: getFileTargetPath(basePath, target), onClose }}
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
      {openFile ? <OverlayViewer target={openFile} onClose={close} /> : null}
    </FileViewerDialog>
  );
}
