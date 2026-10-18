import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import { useMediaQuery } from "@ngriffin_uk/polychat-utility-react";

const DOCK_QUERY = "(min-width: 1280px)";

export type PolyPresentation = "dock" | "window" | null;

export function usePolyPresentation(): PolyPresentation {
  const showPoly = useUIStore((state) => state.showPoly);
  const polyLayout = useUIStore((state) => state.polyLayout);
  const canDock = useMediaQuery(DOCK_QUERY);

  if (!showPoly) {
    return null;
  }

  return polyLayout === "dock" && canDock ? "dock" : "window";
}
