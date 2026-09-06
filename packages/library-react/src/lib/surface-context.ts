import type { WebNavigationIntent } from "./surface-controls";
import { createSurfaceControlsContext } from "./surface-controls-context";

export const { SurfaceControlsProvider, useSurfaceControls } = createSurfaceControlsContext<
  WebNavigationIntent,
  File
>();
