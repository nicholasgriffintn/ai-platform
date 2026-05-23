import { getModelConfigByModel } from "~/lib/providers/models";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { RealtimeProvider, RealtimeSessionRequest } from "../index";

const DEFAULT_TRANSCRIPTION_MODEL = "voxtral-mini-transcribe-realtime";
const DEFAULT_WS_URL = "wss://api.mistral.ai";

export class MistralRealtimeProvider implements RealtimeProvider {
	name = "mistral";
	models = [DEFAULT_TRANSCRIPTION_MODEL];

	private async getApiKey(request: RealtimeSessionRequest): Promise<string> {
		return resolveProviderApiKey({
			env: request.env,
			providerName: this.name,
			envKeyName: "MISTRAL_API_KEY",
			userId: request.user.id,
		});
	}

	private async resolveModel(request: RealtimeSessionRequest): Promise<string> {
		const requestedModel = request.model || DEFAULT_TRANSCRIPTION_MODEL;
		if (!this.models.includes(requestedModel)) {
			throw new AssistantError("Invalid model specified", ErrorType.PARAMS_ERROR);
		}

		const modelConfig = await getModelConfigByModel(requestedModel, request.env);
		if (!modelConfig || modelConfig.provider !== this.name) {
			throw new AssistantError(
				`Model configuration not found for ${requestedModel}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return modelConfig.matchingModel;
	}

	async createSession(request: RealtimeSessionRequest): Promise<unknown> {
		if (request.type !== "transcription") {
			throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
		}

		const apiKey = await this.getApiKey(request);
		const model = await this.resolveModel(request);
		const wsBaseUrl = request.env.MISTRAL_BASE_URL || DEFAULT_WS_URL;

		return {
			id: crypto.randomUUID(),
			object: "realtime.transcription.session",
			type: "transcription",
			provider: this.name,
			transport: "websocket",
			url: `${wsBaseUrl}/v1/realtime/transcriptions`,
			input_audio_format: "pcm_s16le",
			input_audio_transcription: {
				model,
				language: request.language,
			},
			client_secret: {
				value: apiKey,
				expires_at: Math.floor(Date.now() / 1000) + 60,
			},
		};
	}
}
