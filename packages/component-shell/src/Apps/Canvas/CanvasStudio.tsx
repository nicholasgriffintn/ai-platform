import {
  CanvasGenerationsView,
  CanvasSidebarControls,
} from "@ngriffin_uk/polychat-component-experiences/media";

import { useCanvasStudio } from "./useCanvasStudio.js";

export function CanvasStudio({ projectId }: { projectId?: string }) {
  const canvas = useCanvasStudio({ projectId });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-120px)]">
        <div className="h-full overflow-hidden rounded-2xl border border-border bg-surface/90 backdrop-blur">
          <CanvasSidebarControls canvas={canvas} />
        </div>
      </aside>
      <CanvasGenerationsView canvas={canvas} className="rounded-2xl border border-border" />
    </div>
  );
}
