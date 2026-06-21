import type { ExecutionContext } from "@cloudflare/workers-types";
import type { AnalyticsEvent } from "@assistant/schemas";
import type { PostHog, PostHogOptions } from "posthog-node";

import type { AnonymousUser, IEnv, IUser, Message } from "~/types";

export type AnalyticsProperties = Record<string, unknown>;

export type BackendAnalyticsEvent = Omit<AnalyticsEvent, "properties"> & {
	distinctId: string;
	properties?: AnalyticsProperties;
};

export type AnalyticsEngineMetric = {
	traceId: string;
	timestamp: number;
	type: string;
	name: string;
	value: number;
	metadata: Record<string, unknown>;
	status: string;
	error?: string;
};

export type BeaconFetcher = (input: string, init: RequestInit) => Promise<Response>;

export type BackendAiGenerationCaptureInput = {
	traceId: string;
	sessionId?: string;
	spanId?: string;
	spanName?: string;
	model?: string;
	provider?: string;
	input?: Array<Pick<Message, "role" | "content">>;
	output?: Pick<Message, "role" | "content">;
	usage?: Record<string, unknown>;
	latencyMs?: number;
	stream?: boolean;
	properties?: AnalyticsProperties;
	user?: IUser;
	anonymousUser?: AnonymousUser;
	userTrackingEnabled?: boolean | null;
};

export type BackendAnalyticsEnv = Partial<
	Pick<
		IEnv,
		| "ANALYTICS"
		| "POSTHOG_PROJECT_API_KEY"
		| "POSTHOG_HOST"
		| "POSTHOG_BACKEND_ENABLED"
		| "POSTHOG_AI_OBSERVABILITY_ENABLED"
		| "POSTHOG_CAPTURE_AI_CONTENT"
		| "AI_OBSERVABILITY_ENABLED"
		| "BEACON_BACKEND_ENABLED"
		| "BEACON_ENDPOINT"
		| "BEACON_SITE_ID"
		| "ENV"
	>
>;

export type BackendAnalyticsOptions = {
	env: BackendAnalyticsEnv;
	executionCtx?: ExecutionContext;
	createPostHogClient?: (apiKey: string, options: PostHogOptions) => PostHog;
	fetcher?: BeaconFetcher;
	now?: () => number;
};

export type BackendAnalytics = {
	providers: string[];
	capture: (event: BackendAnalyticsEvent) => void;
	recordMetric: (metric: AnalyticsEngineMetric) => void;
	captureAiGeneration: (input: BackendAiGenerationCaptureInput) => void;
};

export type AnalyticsProvider = {
	name: string;
	capture: (event: BackendAnalyticsEvent) => void;
	recordMetric?: (metric: AnalyticsEngineMetric) => void;
};
