import type { ReactNode } from "react";

import { useAnalyticsIdentity } from "./hooks/use-analytics-identity.js";
import { useAuthStatus } from "./hooks/useAuth.js";
import { useResponsiveSidebar } from "./hooks/useResponsiveSidebar.js";
import { useApplyTheme } from "./hooks/useTheme.js";

export function AppInitializer({ children }: { children: ReactNode }) {
  useAuthStatus();
  useAnalyticsIdentity();
  useApplyTheme();
  useResponsiveSidebar();

  return <>{children}</>;
}
