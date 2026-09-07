import { createSurfaceControlsContext } from "./surface-controls-context.js";
import type { WebNavigationIntent } from "./surface-controls.js";

export const { SurfaceControlsProvider, useSurfaceControls } = createSurfaceControlsContext<
  WebNavigationIntent,
  File
>();
