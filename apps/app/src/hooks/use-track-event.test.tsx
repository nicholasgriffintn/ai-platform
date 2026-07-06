import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTrackEvent } from "./use-track-event";

const posthogCapture = vi.fn();
const beaconTrackEvent = vi.fn();

vi.mock("./use-posthog-client", () => ({
	usePostHogClient: () => ({ capture: posthogCapture }),
}));

const chatStore = vi.hoisted(() => ({
	value: {
		isAuthenticated: true,
		user: { id: "123" },
	},
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => chatStore.value,
}));

describe("useTrackEvent", () => {
	beforeEach(() => {
		posthogCapture.mockClear();
		beaconTrackEvent.mockClear();
		window.Beacon = { trackEvent: beaconTrackEvent } as any;
		chatStore.value = {
			isAuthenticated: true,
			user: { id: "123" },
		};
	});

	it("still emits product events when prompt tracking is disabled", () => {
		chatStore.value = {
			isAuthenticated: true,
			user: { id: "123" },
		};

		const { result } = renderHook(() => useTrackEvent());

		result.current.trackFeatureUsage("model_selected", { model: "gpt-4" });

		expect(posthogCapture).toHaveBeenCalledWith("model_selected", {
			category: "feature_usage",
			authenticated: true,
			user_id: "123",
			model: "gpt-4",
		});
		expect(beaconTrackEvent).toHaveBeenCalledWith({
			name: "model_selected",
			category: "feature_usage",
			properties: {
				authenticated: "true",
				user_id: "123",
				model: "gpt-4",
			},
		});
	});
});
