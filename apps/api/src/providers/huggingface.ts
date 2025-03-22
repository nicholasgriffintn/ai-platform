import type { ChatCompletionParameters } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";
import { BaseProvider } from "./base";

export class HuggingFaceProvider extends BaseProvider {
	name = "huggingface";
	supportsStreaming = false;

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);

		if (!params.env.HUGGINGFACE_TOKEN || !params.env.AI_GATEWAY_TOKEN) {
			throw new AssistantError(
				"Missing HUGGINGFACE_TOKEN or AI_GATEWAY_TOKEN",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
	}

	/*
		TODO: Need to support requesting later

		{
			"error": "Model HuggingFaceTB/SmolLM2-1.7B-Instruct is currently loading",
			"estimated_time": 136.9101104736328
		}
	*/

	protected getEndpoint(params: ChatCompletionParameters): string {
		return `${params.model}/v1/chat/completions`;
	}

	protected getHeaders(
		params: ChatCompletionParameters,
	): Record<string, string> {
		return {
			"cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
			Authorization: `Bearer ${params.env.HUGGINGFACE_TOKEN || ""}`,
			"Content-Type": "application/json",
			"cf-aig-metadata": JSON.stringify({
				email: params.user?.email || "anonymous@undefined.computer",
			}),
		};
	}
}
