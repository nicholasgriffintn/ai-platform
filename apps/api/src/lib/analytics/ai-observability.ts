import { AI_GENERATION_EVENT_NAME, AI_OBSERVABILITY_EVENT_CATEGORY } from "~/constants/analytics";
import type { Message } from "~/types";

import { buildAiGenerationProperties } from "./ai-generation-properties";
import type { AnalyticsProperties, BackendAnalyticsEvent } from "./types";

export type AiGenerationEventInput = {
	distinctId: string;
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
	captureContent: boolean;
	properties?: AnalyticsProperties;
};

export function buildAiGenerationEvent(input: AiGenerationEventInput): BackendAnalyticsEvent {
	return {
		name: AI_GENERATION_EVENT_NAME,
		category: AI_OBSERVABILITY_EVENT_CATEGORY,
		distinctId: input.distinctId,
		properties: buildAiGenerationProperties(input),
	};
}
