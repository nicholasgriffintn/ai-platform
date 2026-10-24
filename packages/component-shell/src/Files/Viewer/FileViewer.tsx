import type { FileTarget } from "@ngriffin_uk/polychat-library-react";

import type { FileViewerChrome } from "./FileViewerFrame.js";
import { MemoryViewer } from "./MemoryViewer.js";
import { OutputViewer } from "./OutputViewer.js";
import { SourceViewer } from "./SourceViewer.js";

export function FileViewer({
  target,
  basePath,
  chrome,
  onDeleted,
}: {
  target: FileTarget;
  basePath: string;
  chrome: FileViewerChrome;
  onDeleted: () => void;
}) {
  switch (target.origin) {
    case "output":
      return (
        <OutputViewer
          key={target.id}
          basePath={basePath}
          projectId={target.projectId}
          outputId={target.id}
          chrome={chrome}
          onDeleted={onDeleted}
        />
      );
    case "source":
      return (
        <SourceViewer
          key={target.id}
          basePath={basePath}
          projectId={target.projectId}
          sourceId={target.id}
          chrome={chrome}
          onDeleted={onDeleted}
        />
      );
    case "memory":
      return (
        <MemoryViewer
          key={target.name}
          basePath={basePath}
          projectId={target.projectId}
          name={target.name}
          chrome={chrome}
          onDeleted={onDeleted}
        />
      );
  }
}
