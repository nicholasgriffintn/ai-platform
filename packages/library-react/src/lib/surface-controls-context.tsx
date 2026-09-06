import type { SurfaceControls } from "@ngriffin_uk/polychat-library-surface";
import { createContext, type ReactNode, useContext } from "react";

export interface SurfaceControlsProviderProps<NavigationIntent, SelectedFile> {
  children?: ReactNode;
  controls: SurfaceControls<NavigationIntent, SelectedFile>;
}

export function createSurfaceControlsContext<NavigationIntent, SelectedFile>() {
  const SurfaceControlsContext = createContext<SurfaceControls<
    NavigationIntent,
    SelectedFile
  > | null>(null);

  function SurfaceControlsProvider({
    children,
    controls,
  }: SurfaceControlsProviderProps<NavigationIntent, SelectedFile>) {
    return (
      <SurfaceControlsContext.Provider value={controls}>{children}</SurfaceControlsContext.Provider>
    );
  }

  function useSurfaceControls(): SurfaceControls<NavigationIntent, SelectedFile> {
    const controls = useContext(SurfaceControlsContext);

    if (!controls) {
      throw new Error("useSurfaceControls must be used within a SurfaceControlsProvider");
    }

    return controls;
  }

  return { SurfaceControlsProvider, useSurfaceControls };
}
