import {
  type FilesFileLocation,
  fileTargetFromLocation,
} from "@ngriffin_uk/polychat-library-react";
import { useNavigate } from "react-router";

import { FileViewer } from "./FileViewer.js";
import { FileViewerDialog } from "./FileViewerDialog.js";

export function FilesPageViewer({
  location,
  basePath,
  projectId,
  returnPath,
}: {
  location: FilesFileLocation;
  basePath: string;
  projectId?: string;
  returnPath: string;
}) {
  const navigate = useNavigate();
  const close = () => void navigate(returnPath);

  return (
    <FileViewerDialog open onClose={close}>
      <FileViewer
        target={fileTargetFromLocation(location, projectId)}
        basePath={basePath}
        chrome={{ onClose: close }}
        onDeleted={close}
      />
    </FileViewerDialog>
  );
}
