import type { CreateChatCompletionsResponse } from "~/types";
import { isPlainObject } from "~/utils/objects";

type ChatPostProcessing = NonNullable<CreateChatCompletionsResponse["post_processing"]>;
type ChatPostProcessingSteps = Partial<Pick<ChatPostProcessing, "steps" | "total_usage">>;

function isGuardrailsPostProcessing(
	value: unknown,
): value is NonNullable<ChatPostProcessing["guardrails"]> {
	return isPlainObject(value) && typeof value.passed === "boolean";
}

function getStepMetadata(response: unknown): ChatPostProcessingSteps {
	if (!isPlainObject(response)) {
		return {};
	}

	return {
		...(Array.isArray(response.steps) ? { steps: response.steps } : {}),
		...(isPlainObject(response.totalUsage) ? { total_usage: response.totalUsage } : {}),
	};
}

export function buildChatPostProcessing(result: {
	guardrails?: unknown;
	response?: unknown;
}): ChatPostProcessing {
	return {
		...(isGuardrailsPostProcessing(result.guardrails) ? { guardrails: result.guardrails } : {}),
		...getStepMetadata(result.response),
	};
}
