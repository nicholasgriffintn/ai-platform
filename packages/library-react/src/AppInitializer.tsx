import type { ReactNode } from "react";

import { useAuthStatus } from "./hooks/useAuth.js";
import { useResponsiveSidebar } from "./hooks/useResponsiveSidebar.js";
import { useApplyTheme } from "./hooks/useTheme.js";
import { useDeviceSync } from "./sync/useDeviceSync.js";

export function AppInitializer({ children }: { children: ReactNode }) {
  useAuthStatus();
  useApplyTheme();
  useResponsiveSidebar();
  useDeviceSync();

  return children;
}
