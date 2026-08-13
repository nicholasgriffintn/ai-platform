import { createSurfaceControlsContext } from "@ngriffin_uk/polychat-library-react";

import type { WebNavigationIntent } from "./surface-controls";

export const { SurfaceControlsProvider, useSurfaceControls } = createSurfaceControlsContext<
	WebNavigationIntent,
	File
>();
