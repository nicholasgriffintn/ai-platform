import type { ExecutionContext } from "@cloudflare/workers-types";
import { PostHog } from "posthog-node";
import { describe, expect, it, vi } from "vitest";

import { buildAiGenerationEvent } from "./ai-observability";
import { createBackendAnalytics } from "./core";
import { buildAnalyticsDistinctId } from "./identity";

class TestPostHog extends PostHog {
	constructor(
		private readonly onCapture: (props: Parameters<PostHog["capture"]>[0]) => void,
		private readonly onFlush: () => Promise<void> = async () => {},
	) {
		super("phc_test", { host: "https://us.i.posthog.com" });
	}

	override capture(props: Parameters<PostHog["capture"]>[0]): void {
		this.onCapture(props);
	}

	override flush(): Promise<void> {
		return this.onFlush();
	}
}

function createTestPostHog({
	capture,
	flush,
}: {
	capture: (props: Parameters<PostHog["capture"]>[0]) => void;
	flush?: () => Promise<void>;
}): PostHog {
	return new TestPostHog(capture, flush);
}

describe("backend analytics", () => {
	it("returns no providers when analytics env vars are absent", () => {
		const analytics = createBackendAnalytics({ env: {} });

		expect(analytics.providers).toEqual([]);
	});

	it("captures standard events through Analytics Engine when configured", () => {
		const analyticsEngine = {
			writeDataPoint: vi.fn(),
		};
		const analytics = createBackendAnalytics({
			env: {
				ANALYTICS: analyticsEngine,
			},
			now: () => 123456,
		});

		analytics.capture({
			name: "server_event",
			category: "usage",
			distinctId: "user:123",
			value: 2,
			properties: { feature: "chat" },
		});

		expect(analytics.providers).toEqual(["analytics_engine"]);
		expect(analyticsEngine.writeDataPoint).toHaveBeenCalledWith({
			blobs: [
				"usage",
				"server_event",
				"success",
				"None",
				"user:123",
				JSON.stringify({
					distinctId: "user:123",
					feature: "chat",
				}),
			],
			doubles: [2, 123456],
			indexes: ["user:123"],
		});
	});

	it("captures standard events through configured PostHog and Beacon providers", () => {
		const posthogCapture = vi.fn();
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

		const analytics = createBackendAnalytics({
			env: {
				POSTHOG_PROJECT_API_KEY: "phc_test",
				POSTHOG_HOST: "us.i.posthog.com",
				BEACON_BACKEND_ENABLED: "true",
				BEACON_ENDPOINT: "https://beacon.polychat.app",
				BEACON_SITE_ID: "polychat-api",
			},
			createPostHogClient: (apiKey, options) => {
				expect(apiKey).toBe("phc_test");
				expect(options.host).toBe("https://us.i.posthog.com");
				return createTestPostHog({ capture: posthogCapture });
			},
			fetcher,
		});

		analytics.capture({
			name: "server_event",
			category: "backend",
			distinctId: "user:123",
			properties: { feature: "chat", count: 1 },
		});

		expect(analytics.providers).toEqual(["posthog", "beacon"]);
		expect(posthogCapture).toHaveBeenCalledWith({
			distinctId: "user:123",
			event: "server_event",
			properties: {
				category: "backend",
				feature: "chat",
				count: 1,
			},
		});
		expect(fetcher).toHaveBeenCalledWith(
			"https://beacon.polychat.app/api/events/collect",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: expect.stringContaining('"event_name":"server_event"'),
			}),
		);
	});

	it("schedules a PostHog flush after capture when an execution context is available", () => {
		const posthogCapture = vi.fn();
		const posthogFlush = vi.fn().mockResolvedValue(undefined);
		const waitUntil = vi.fn();
		const executionCtx = {
			waitUntil,
			passThroughOnException: vi.fn(),
			props: {},
		} satisfies ExecutionContext;
		const analytics = createBackendAnalytics({
			env: {
				POSTHOG_PROJECT_API_KEY: "phc_test",
			},
			executionCtx,
			createPostHogClient: () =>
				createTestPostHog({
					capture: posthogCapture,
					flush: async () => {
						await posthogFlush();
					},
				}),
		});

		analytics.capture({
			name: "server_event",
			category: "backend",
			distinctId: "user:123",
		});

		expect(posthogCapture).toHaveBeenCalledOnce();
		expect(posthogFlush).toHaveBeenCalledOnce();
		expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
	});

	it("omits nullish PostHog properties before capture", () => {
		const posthogCapture = vi.fn();
		const analytics = createBackendAnalytics({
			env: {
				POSTHOG_PROJECT_API_KEY: "phc_test",
			},
			createPostHogClient: () => createTestPostHog({ capture: posthogCapture }),
		});

		analytics.capture({
			name: "$ai_generation",
			category: "ai_observability",
			distinctId: "user:123",
			properties: {
				$groups: undefined,
				$ai_trace_id: "trace-1",
				empty: null,
			},
		});

		expect(posthogCapture).toHaveBeenCalledWith({
			distinctId: "user:123",
			event: "$ai_generation",
			properties: {
				category: "ai_observability",
				$ai_trace_id: "trace-1",
			},
		});
	});

	it("records metrics through all configured backend analytics providers", () => {
		const analyticsEngine = {
			writeDataPoint: vi.fn(),
		};
		const posthogCapture = vi.fn();
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		const analytics = createBackendAnalytics({
			env: {
				ANALYTICS: analyticsEngine,
				POSTHOG_PROJECT_API_KEY: "phc_test",
				BEACON_BACKEND_ENABLED: "true",
				BEACON_SITE_ID: "polychat-api",
			},
			createPostHogClient: () => createTestPostHog({ capture: posthogCapture }),
			fetcher,
		});

		(analytics as any).recordMetric({
			traceId: "trace-1",
			timestamp: 123,
			type: "performance",
			name: "ai_provider_response",
			value: 45,
			metadata: { provider: "openai" },
			status: "success",
		});

		expect(analyticsEngine.writeDataPoint).toHaveBeenCalledWith(
			expect.objectContaining({
				blobs: expect.arrayContaining(["performance", "ai_provider_response", "success"]),
			}),
		);
		expect(posthogCapture).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "ai_provider_response",
				distinctId: "trace-1",
			}),
		);
		expect(fetcher).toHaveBeenCalledWith(
			"https://beacon.polychat.app/api/events/collect",
			expect.objectContaining({
				body: expect.stringContaining('"event_name":"ai_provider_response"'),
			}),
		);
	});

	it("captures AI generation metadata without prompt content when prompt tracking is disabled", () => {
		const posthogCapture = vi.fn();
		const analytics = createBackendAnalytics({
			env: {
				POSTHOG_PROJECT_API_KEY: "phc_test",
				POSTHOG_CAPTURE_AI_CONTENT: "true",
			},
			createPostHogClient: () => createTestPostHog({ capture: posthogCapture }),
		});

		(analytics as any).captureAiGeneration({
			user: { id: 123 },
			userTrackingEnabled: false,
			traceId: "chat-1",
			model: "gpt-5-mini",
			provider: "openai",
			input: [{ role: "user", content: "secret prompt" }],
			output: { role: "assistant", content: "secret answer" },
		});

		expect(posthogCapture).toHaveBeenCalledWith({
			distinctId: "user:123",
			event: "$ai_generation",
			properties: {
				category: "ai_observability",
				$ai_trace_id: "chat-1",
				$ai_model: "gpt-5-mini",
				$ai_provider: "openai",
				$ai_stream: false,
			},
		});
	});

	it("builds PostHog AI generation events without prompt content by default", () => {
		const event = buildAiGenerationEvent({
			distinctId: "user:123",
			traceId: "chat_1",
			model: "gpt-5-mini",
			provider: "openai",
			input: [{ role: "user", content: "secret prompt" }],
			output: { role: "assistant", content: "secret answer" },
			usage: {
				prompt_tokens: 10,
				completion_tokens: 20,
				total_tokens: 30,
			},
			latencyMs: 1500,
			stream: false,
			captureContent: false,
		});

		expect(event).toEqual({
			name: "$ai_generation",
			category: "ai_observability",
			distinctId: "user:123",
			properties: {
				$ai_trace_id: "chat_1",
				$ai_model: "gpt-5-mini",
				$ai_provider: "openai",
				$ai_input_tokens: 10,
				$ai_output_tokens: 20,
				$ai_latency: 1.5,
				$ai_stream: false,
				$ai_total_tokens: 30,
			},
		});
	});

	it("includes AI prompt and response content only when explicitly enabled", () => {
		const event = buildAiGenerationEvent({
			distinctId: "user:123",
			traceId: "chat_1",
			model: "gpt-5-mini",
			provider: "openai",
			input: [{ role: "user", content: "visible prompt" }],
			output: { role: "assistant", content: "visible answer" },
			usage: {},
			captureContent: true,
		});

		expect(event.properties).toMatchObject({
			$ai_input: [{ role: "user", content: "visible prompt" }],
			$ai_output_choices: [{ role: "assistant", content: "visible answer" }],
		});
	});

	it("uses stable user and anonymous distinct ids", () => {
		expect(buildAnalyticsDistinctId({ user: { id: 123 } })).toBe("user:123");
		expect(buildAnalyticsDistinctId({ anonymousUser: { id: "anon-1" } })).toBe("anonymous:anon-1");
		expect(buildAnalyticsDistinctId({})).toBe("anonymous:server");
	});
});
