import { trackProviderMetrics } from "~/lib/monitoring";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";
import { fetchAIResponse } from "../../../lib/fetch";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";

export class CertesiaProvider extends BaseProvider {
	name = "certesia";
	supportsStreaming = false;
	voice_id = "87748186-23bb-4158-a1eb-332911b0b708"; // Wizardman
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "CERTESIA_API_TOKEN";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	protected async getEndpoint(): Promise<string> {
		return "tts/bytes";
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);
		const baseHeaders = this.buildAiGatewayHeaders(params, apiKey);

		return {
			...baseHeaders,
			"X-API-Key": `Bearer ${apiKey}`,
			"Cartesia-Version": "2024-06-10",
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
			transcript: params.message,
			model_id: params.model,
			language: "en",
			voice: {
				mode: "id",
				id: this.voice_id,
			},
			output_format: {
				container: "mp3",
				bit_rate: 128000,
				sample_rate: 44100,
			},
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
