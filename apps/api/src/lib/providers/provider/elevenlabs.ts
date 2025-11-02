import { trackProviderMetrics } from "~/lib/monitoring";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";
import { fetchAIResponse } from "../lib/fetch";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";

export class ElevenLabsProvider extends BaseProvider {
	name = "elevenlabs";
	supportsStreaming = false;
	private readonly voiceId = "JBFqnCBsd6RMkjVDRZzb";
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "ELEVENLABS_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	protected async getEndpoint(): Promise<string> {
		return `v1/text-to-speech/${this.voiceId}`;
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);
		const baseHeaders = this.buildAiGatewayHeaders(params, apiKey);

		return {
			...baseHeaders,
			"xi-api-key": `Bearer ${apiKey}`,
		};
	}

	async getResponse(
		params: ChatCompletionParameters,
		userId?: number,
	): Promise<any> {
		this.validateParams(params);

		const endpoint = await this.getEndpoint();
		const headers = await this.getHeaders(params);

		const body = {
			text: params.message,
			model_id: params.model,
			output_format: "mp3_44100_128",
		};

		return trackProviderMetrics({
			provider: this.name,
			model: params.model as string,
			operation: async () => {
				const data = await fetchAIResponse(
					this.isOpenAiCompatible,
					this.name,
					endpoint,
					headers,
					body,
					params.env,
				);

				return await this.formatResponse(data, params);
			},
			analyticsEngine: params.env?.ANALYTICS,
			settings: this.buildMetricsSettings(params),
			userId,
			completion_id: params.completion_id,
		});
	}
}
