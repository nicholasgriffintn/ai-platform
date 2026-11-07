import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import { lazy, Suspense, useState } from "react";

const loadFileViewerOverlay = () =>
  import("./FileViewerOverlay.js").then((module) => ({ default: module.FileViewerOverlay }));

const FileViewerOverlay = lazy(loadFileViewerOverlay);

export function preloadFileViewerOverlay(): void {
  void loadFileViewerOverlay();
}

export function LazyFileViewerOverlay() {
  const isOpen = useUIStore((state) => state.openFile !== null);
  const [hasOpened, setHasOpened] = useState(isOpen);

  if (isOpen && !hasOpened) {
    setHasOpened(true);
  }

  if (!hasOpened) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <FileViewerOverlay />
    </Suspense>
  );
}
