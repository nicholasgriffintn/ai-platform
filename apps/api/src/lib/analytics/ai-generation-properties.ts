import {
	AI_INPUT_TOKEN_USAGE_FIELDS,
	AI_OUTPUT_TOKEN_USAGE_FIELDS,
	AI_TOTAL_TOKEN_USAGE_FIELDS,
} from "~/constants/analytics";
import type { Message } from "~/types";
import { omitNullishValues } from "~/utils/objects";
import { readNumberFieldAlias } from "~/utils/recordFields";

import type { AnalyticsProperties } from "./types";

type AiGenerationPropertiesInput = {
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

export function buildAiGenerationProperties(
	input: AiGenerationPropertiesInput,
): AnalyticsProperties {
	const usage = input.usage || {};
	const inputTokens = readNumberFieldAlias(usage, AI_INPUT_TOKEN_USAGE_FIELDS);
	const outputTokens = readNumberFieldAlias(usage, AI_OUTPUT_TOKEN_USAGE_FIELDS);
	const totalTokens =
		readNumberFieldAlias(usage, AI_TOTAL_TOKEN_USAGE_FIELDS) ??
		(inputTokens !== undefined && outputTokens !== undefined
			? inputTokens + outputTokens
			: undefined);
	const outputChoices = input.output
		? [{ role: input.output.role, content: input.output.content }]
		: undefined;

	return {
		...omitNullishValues({
			$ai_trace_id: input.traceId,
			$ai_session_id: input.sessionId,
			$ai_span_id: input.spanId,
			$ai_span_name: input.spanName,
			$ai_model: input.model || "unknown",
			$ai_provider: input.provider || "unknown",
			$ai_input_tokens: inputTokens,
			$ai_output_tokens: outputTokens,
			$ai_total_tokens: totalTokens,
			$ai_latency: typeof input.latencyMs === "number" ? input.latencyMs / 1000 : undefined,
			$ai_stream: input.stream ?? false,
		}),
		...omitNullishValues({
			$ai_input: input.captureContent ? input.input : undefined,
			$ai_output_choices: input.captureContent ? outputChoices : undefined,
		}),
		...input.properties,
	};
}
