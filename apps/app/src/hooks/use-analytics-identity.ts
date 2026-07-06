import { useEffect } from "react";

import { syncAnalyticsIdentity } from "~/lib/analytics/client";
import { useChatStore } from "~/state/stores/chatStore";
import { usePostHogClient } from "./use-posthog-client";

export function useAnalyticsIdentity() {
	const { isAuthenticated, user } = useChatStore();
	const posthog = usePostHogClient();

	useEffect(() => {
		syncAnalyticsIdentity({
			isAuthenticated,
			user,
			posthog,
			beacon: typeof window !== "undefined" ? window.Beacon : undefined,
		});
	}, [isAuthenticated, user, posthog]);
}
