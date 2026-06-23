import { useAnalyticsIdentity } from "~/hooks/use-analytics-identity";
import { useAuthStatus } from "~/hooks/useAuth";

export const AppInitializer = ({ children }: { children: React.ReactNode }) => {
	useAuthStatus();
	useAnalyticsIdentity();

	return <>{children}</>;
};
