import { lazy, type ReactNode, Suspense, useState } from "react";

import type { PolyPanel, PolyPanelProps } from "./PolyPanel.js";

let loadedPolyPanel: typeof PolyPanel | null = null;

const loadPolyPanel = () =>
  import("./PolyPanel.js").then((module) => {
    loadedPolyPanel = module.PolyPanel;

    return { default: module.PolyPanel };
  });

const SuspendingPolyPanel = lazy(loadPolyPanel);

export function preloadPolyPanel(): void {
  void loadPolyPanel();
}

export function LazyPolyPanel({ fallback, ...props }: PolyPanelProps & { fallback: ReactNode }) {
  const [LoadedPolyPanel] = useState(() => loadedPolyPanel);

  if (LoadedPolyPanel) {
    return <LoadedPolyPanel {...props} />;
  }

  return (
    <Suspense fallback={fallback}>
      <SuspendingPolyPanel {...props} />
    </Suspense>
  );
}
