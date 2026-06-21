import { describe, expect, it, vi } from "vitest";

import { captureClientException, syncAnalyticsIdentity, trackClientEvent } from "./client";

describe("client analytics", () => {
	it("routes events through PostHog and Beacon when both providers are available", () => {
		const posthog = { capture: vi.fn() };
		const beacon = { trackEvent: vi.fn(), setUserId: vi.fn() };

		trackClientEvent(
			{
				name: "model_selected",
				category: "feature_usage",
				label: "gpt-4",
				value: 1,
				non_interaction: false,
				properties: {
					authenticated: true,
					user_id: "123",
					ignored: null,
				},
			},
			{ posthog, beacon },
		);

		expect(posthog.capture).toHaveBeenCalledWith("model_selected", {
			category: "feature_usage",
			authenticated: true,
			user_id: "123",
			label: "gpt-4",
			value: 1,
			non_interaction: false,
		});
		expect(beacon.trackEvent).toHaveBeenCalledWith({
			name: "model_selected",
			category: "feature_usage",
			label: "gpt-4",
			value: 1,
			non_interaction: false,
			properties: {
				authenticated: "true",
				user_id: "123",
			},
		});
	});

	it("identifies authenticated users consistently across providers", () => {
		const posthog = { identify: vi.fn(), reset: vi.fn() };
		const beacon = { setUserId: vi.fn(), trackEvent: vi.fn() };

		syncAnalyticsIdentity({
			isAuthenticated: true,
			user: {
				id: "123",
				email: "test@example.com",
				plan_id: "pro",
			},
			posthog,
			beacon,
		});

		expect(posthog.identify).toHaveBeenCalledWith("user:123", {
			user_id: "123",
			email: "test@example.com",
			plan_id: "pro",
		});
		expect(beacon.setUserId).toHaveBeenCalledWith("user:123");
	});

	it("resets PostHog identity when the user is unauthenticated", () => {
		const posthog = { identify: vi.fn(), reset: vi.fn() };

		syncAnalyticsIdentity({
			isAuthenticated: false,
			user: undefined,
			posthog,
		});

		expect(posthog.reset).toHaveBeenCalled();
		expect(posthog.identify).not.toHaveBeenCalled();
	});

	it("captures exceptions through PostHog and emits a standard error event", () => {
		const posthog = { capture: vi.fn(), captureException: vi.fn() };
		const beacon = { trackEvent: vi.fn(), setUserId: vi.fn() };
		const error = new Error("Broken");

		captureClientException(error, { category: "render" }, { posthog, beacon });

		expect(posthog.captureException).toHaveBeenCalledWith(error, { category_detail: "render" });
		expect(posthog.capture).toHaveBeenCalledWith("exception", {
			category: "error",
			error_message: "Broken",
			category_detail: "render",
		});
		expect(beacon.trackEvent).toHaveBeenCalledWith({
			name: "exception",
			category: "error",
			properties: {
				error_message: "Broken",
				category_detail: "render",
			},
		});
	});
});
