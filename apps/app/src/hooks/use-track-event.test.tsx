import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTrackEvent } from "./use-track-event";

const posthogCapture = vi.fn();
const beaconTrackEvent = vi.fn();

vi.mock("posthog-js/react", () => ({
	usePostHog: () => ({ capture: posthogCapture }),
}));

const authStatus = vi.hoisted(() => ({
	value: {
		isAuthenticated: true,
		isLoading: false,
		user: { id: "123" },
		userSettings: { tracking_enabled: true },
	},
}));

vi.mock("~/hooks/useAuth", () => ({
	useAuthStatus: () => authStatus.value,
}));

describe("useTrackEvent", () => {
	beforeEach(() => {
		posthogCapture.mockClear();
		beaconTrackEvent.mockClear();
		window.Beacon = { trackEvent: beaconTrackEvent } as any;
		authStatus.value = {
			isAuthenticated: true,
			isLoading: false,
			user: { id: "123" },
			userSettings: { tracking_enabled: true },
		};
	});

	it("still emits product events when prompt tracking is disabled", () => {
		authStatus.value = {
			isAuthenticated: true,
			isLoading: false,
			user: { id: "123" },
			userSettings: { tracking_enabled: false },
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
