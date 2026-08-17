import type {
	SurfaceAnalytics,
	SurfaceAnalyticsEvent,
} from "@ngriffin_uk/polychat-library-surface";
import { useMemo } from "react";

import { useTrackEvent } from "~/hooks/use-track-event";

/**
 * Bridges the render packages' host-neutral analytics contract onto the web app's event pipeline,
 * so shared components report without knowing which provider is behind it.
 */
export function useAnalyticsAdapter(): SurfaceAnalytics {
	const { trackEvent } = useTrackEvent();

	return useMemo(
		() => ({
			track: (event: SurfaceAnalyticsEvent) => {
				trackEvent({
					name: event.name,
					category: event.category ?? "ui_interaction",
					label: event.label,
					value: event.value,
					properties: event.properties,
				});
			},
		}),
		[trackEvent],
	);
}
