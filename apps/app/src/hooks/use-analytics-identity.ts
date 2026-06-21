import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { useAuthStatus } from "~/hooks/useAuth";
import { syncAnalyticsIdentity } from "~/lib/analytics/client";

export function useAnalyticsIdentity() {
	const { isAuthenticated, user } = useAuthStatus();
	const posthog = usePostHog();

	useEffect(() => {
		syncAnalyticsIdentity({
			isAuthenticated,
			user,
			posthog,
			beacon: typeof window !== "undefined" ? window.Beacon : undefined,
		});
	}, [isAuthenticated, user, posthog]);
}
