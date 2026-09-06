import type { ReactNode } from "react";

import { useAnalyticsIdentity } from "./hooks/use-analytics-identity";
import { useAuthStatus } from "./hooks/useAuth";
import { useResponsiveSidebar } from "./hooks/useResponsiveSidebar";
import { useApplyTheme } from "./hooks/useTheme";

export function AppInitializer({ children }: { children: ReactNode }) {
  useAuthStatus();
  useAnalyticsIdentity();
  useApplyTheme();
  useResponsiveSidebar();

  return <>{children}</>;
}
