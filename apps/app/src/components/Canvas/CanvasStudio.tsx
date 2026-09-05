import {
  CanvasGenerationsView,
  CanvasSidebarControls,
} from "@ngriffin_uk/polychat-component-experiences/media";

import { useCanvasStudio } from "./useCanvasStudio";

export function CanvasStudio() {
  const canvas = useCanvasStudio();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-120px)]">
        <div className="border-border bg-surface/90 h-full overflow-hidden rounded-2xl border backdrop-blur">
          <CanvasSidebarControls canvas={canvas} />
        </div>
      </aside>
      <CanvasGenerationsView canvas={canvas} className="border-border rounded-2xl border" />
    </div>
  );
}
