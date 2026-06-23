import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { syncAnalyticsIdentity } from "~/lib/analytics/client";
import { useChatStore } from "~/state/stores/chatStore";

export function useAnalyticsIdentity() {
	const { isAuthenticated, user } = useChatStore();
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
