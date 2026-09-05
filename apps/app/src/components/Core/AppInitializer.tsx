import { useAnalyticsIdentity } from "~/hooks/use-analytics-identity";
import { useAuthStatus } from "~/hooks/useAuth";
import { useApplyTheme } from "~/hooks/useTheme";

export const AppInitializer = ({ children }: { children: React.ReactNode }) => {
  useAuthStatus();
  useAnalyticsIdentity();
  useApplyTheme();

  return <>{children}</>;
};
